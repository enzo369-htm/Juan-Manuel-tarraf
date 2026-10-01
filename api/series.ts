const COOKIE = 'jt_admin'

function cookies(header: string) {
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    out[name] = decodeURIComponent(rest.join('='))
  }
  return out
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthed(request: Request) {
  const token = cookies(request.headers.get('cookie') ?? '')[COOKIE]
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-only-secret'
  return (await hmacHex(secret, payload)) === sig && Number(payload) > Date.now()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function idOf(request: Request) {
  const url = new URL(request.url)
  return url.searchParams.get('id') || ''
}

function isUndefinedColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code === '42703') return true
  const message = error instanceof Error ? error.message : String(error)
  return /undefined_column|column .+ does not exist/i.test(message)
}

function isMissingTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code === '42P01') return true
  const message = error instanceof Error ? error.message : String(error)
  return /work_series/i.test(message) && /does not exist|undefined_table/i.test(message)
}

function clip(value: string, max: number) {
  return value.slice(0, max)
}

type SeriesRow = {
  id: string
  title: string
  description: string
  title_en?: string | null
  description_en?: string | null
  sort_order: number
  created_at: string
}

function toSeries(row: SeriesRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    titleEn: row.title_en ?? '',
    descriptionEn: row.description_en ?? '',
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

const MISSING = { error: 'Falta correr db/018_work_series.sql en Neon' }

export default {
  async fetch(request: Request) {
    try {
      const id = idOf(request)
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET' && !id) return Response.json({ series: [] })
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET' && id) {
        if (!isUuid(id)) return Response.json({ error: 'Serie inválida' }, { status: 400 })
        try {
          const rows = (await sql`
            select id, title, description, title_en, description_en, sort_order, created_at
            from work_series
            where id = ${id}
          `) as SeriesRow[]
          if (!rows[0]) return Response.json({ error: 'No encontrado' }, { status: 404 })
          return Response.json({ series: toSeries(rows[0]) }, { headers: { 'Cache-Control': 'no-store' } })
        } catch (error) {
          if (isMissingTable(error) || isUndefinedColumn(error)) {
            return Response.json(MISSING, { status: 503 })
          }
          throw error
        }
      }

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select id, title, description, title_en, description_en, sort_order, created_at
            from work_series
            order by sort_order, created_at
          `) as SeriesRow[]
          return Response.json(
            { series: rows.map(toSeries) },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          if (isMissingTable(error) || isUndefinedColumn(error)) {
            return Response.json(MISSING, { status: 503 })
          }
          throw error
        }
      }

      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }

      if (request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          title?: string
          description?: string
          titleEn?: string
          descriptionEn?: string
        }
        const title = clip((body.title ?? '').trim(), 200)
        if (!title) return Response.json({ error: 'El título es obligatorio' }, { status: 400 })
        const description = clip(body.description ?? '', 6000)
        const titleEn = clip(body.titleEn ?? '', 200)
        const descriptionEn = clip(body.descriptionEn ?? '', 6000)
        try {
          const count = (await sql`select count(*)::int as n from work_series`) as { n: number }[]
          const created = (await sql`
            insert into work_series (title, description, title_en, description_en, sort_order)
            values (${title}, ${description}, ${titleEn}, ${descriptionEn}, ${count[0]?.n ?? 0})
            returning id, title, description, title_en, description_en, sort_order, created_at
          `) as SeriesRow[]
          return Response.json({ series: toSeries(created[0]) })
        } catch (error) {
          if (isMissingTable(error) || isUndefinedColumn(error)) {
            return Response.json(MISSING, { status: 503 })
          }
          throw error
        }
      }

      if (request.method === 'PUT' || request.method === 'DELETE') {
        if (!isUuid(id)) return Response.json({ error: 'Serie inválida' }, { status: 400 })
        try {
          if (request.method === 'DELETE') {
            await sql`delete from work_series where id = ${id}`
            return Response.json({ ok: true })
          }
          const body = (await request.json().catch(() => ({}))) as {
            title?: string
            description?: string
            titleEn?: string
            descriptionEn?: string
          }
          const title = clip((body.title ?? '').trim(), 200)
          if (!title) return Response.json({ error: 'El título es obligatorio' }, { status: 400 })
          const description = clip(body.description ?? '', 6000)
          const titleEn = clip(body.titleEn ?? '', 200)
          const descriptionEn = clip(body.descriptionEn ?? '', 6000)
          const updated = (await sql`
            update work_series
            set title = ${title},
                description = ${description},
                title_en = ${titleEn},
                description_en = ${descriptionEn}
            where id = ${id}
            returning id, title, description, title_en, description_en, sort_order, created_at
          `) as SeriesRow[]
          if (!updated[0]) return Response.json({ error: 'No encontrado' }, { status: 404 })
          return Response.json({ series: toSeries(updated[0]) })
        } catch (error) {
          if (isMissingTable(error) || isUndefinedColumn(error)) {
            return Response.json(MISSING, { status: 503 })
          }
          throw error
        }
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
