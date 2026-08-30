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

function isMissingTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code === '42P01') return true
  const message = error instanceof Error ? error.message : String(error)
  return /exhibitions/i.test(message) && /does not exist|undefined_table/i.test(message)
}

function toExhibition(row: {
  id: string
  title: string
  description: string
  sort_order: number
  created_at: string
  cover_media_id: string | null
  cover_url: string | null
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    coverMediaId: row.cover_media_id || undefined,
    coverUrl: row.cover_url || undefined,
  }
}

export default {
  async fetch(request: Request) {
    try {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') return Response.json({ exhibitions: [] })
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select e.id, e.title, e.description, e.sort_order, e.created_at,
                   e.cover_media_id, m.url as cover_url
            from exhibitions e
            left join media m on m.id = e.cover_media_id
            order by e.sort_order, e.created_at desc
          `) as Parameters<typeof toExhibition>[0][]
          return Response.json(
            { exhibitions: rows.map(toExhibition) },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          if (isMissingTable(error)) {
            return Response.json({ exhibitions: [] }, { headers: { 'Cache-Control': 'no-store' } })
          }
          throw error
        }
      }

      if (request.method === 'POST') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          title?: string
          description?: string
          coverMediaId?: string
        }
        const title = (body.title ?? '').trim()
        if (!title) {
          return Response.json({ error: 'El título es obligatorio' }, { status: 400 })
        }
        const cover =
          typeof body.coverMediaId === 'string' && isUuid(body.coverMediaId)
            ? body.coverMediaId
            : null
        try {
          const count = (await sql`select count(*)::int as n from exhibitions`) as { n: number }[]
          const created = (await sql`
            insert into exhibitions (title, description, cover_media_id, sort_order)
            values (${title}, ${body.description ?? ''}, ${cover}, ${count[0]?.n ?? 0})
            returning id, title, description, sort_order, created_at, cover_media_id
          `) as {
            id: string
            title: string
            description: string
            sort_order: number
            created_at: string
            cover_media_id: string | null
          }[]
          const row = created[0]
          let coverUrl: string | null = null
          if (row.cover_media_id) {
            const media = (await sql`
              select url from media where id = ${row.cover_media_id}
            `) as { url: string }[]
            coverUrl = media[0]?.url ?? null
          }
          return Response.json({
            exhibition: toExhibition({ ...row, cover_url: coverUrl }),
          })
        } catch (error) {
          if (isMissingTable(error)) {
            return Response.json(
              { error: 'Falta correr db/011_exhibitions.sql en Neon' },
              { status: 503 },
            )
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
