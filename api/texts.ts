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

function isUndefinedColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code === '42703') return true
  const message = error instanceof Error ? error.message : String(error)
  return /undefined_column|column .+ does not exist/i.test(message)
}

function isMissingTextCover(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = error instanceof Error ? error.message : String(error)
  return /cover_media_id/i.test(message) && /does not exist|undefined_column/i.test(message)
}

type TextRow = {
  id: string
  title: string
  description: string
  body?: string
  title_en?: string | null
  description_en?: string | null
  body_en?: string | null
  created_at: string
  cover_media_id?: string | null
  cover_url?: string | null
}

function toText(row: TextRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    body: row.body,
    titleEn: row.title_en ?? '',
    descriptionEn: row.description_en ?? '',
    bodyEn: row.body_en ?? '',
    created_at: row.created_at,
    coverMediaId: row.cover_media_id || undefined,
    coverUrl: row.cover_url || undefined,
  }
}

export default {
  async fetch(request: Request) {
    try {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') return Response.json({ texts: [] })
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select t.id, t.title, t.description, t.title_en, t.description_en, t.created_at,
                   t.cover_media_id, m.url as cover_url
            from texts t
            left join media m on m.id = t.cover_media_id
            order by t.created_at desc
          `) as TextRow[]
          return Response.json({ texts: rows.map(toText) })
        } catch (error) {
          if (!isUndefinedColumn(error) && !isMissingTextCover(error)) throw error
          try {
            const rows = (await sql`
              select t.id, t.title, t.description, t.created_at,
                     t.cover_media_id, m.url as cover_url
              from texts t
              left join media m on m.id = t.cover_media_id
              order by t.created_at desc
            `) as TextRow[]
            return Response.json({ texts: rows.map(toText) })
          } catch (retryError) {
            if (!isUndefinedColumn(retryError) && !isMissingTextCover(retryError)) throw retryError
            const rows = (await sql`
              select id, title, description, created_at
              from texts
              order by created_at desc
            `) as TextRow[]
            return Response.json({ texts: rows.map(toText) })
          }
        }
      }

      if (request.method === 'POST') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          title?: string
          description?: string
          body?: string
          titleEn?: string
          descriptionEn?: string
          bodyEn?: string
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
          let created: TextRow[]
          try {
            created = (await sql`
              insert into texts (title, description, body, title_en, description_en, body_en, cover_media_id)
              values (${title}, ${body.description ?? ''}, ${body.body ?? ''}, ${body.titleEn ?? ''}, ${body.descriptionEn ?? ''}, ${body.bodyEn ?? ''}, ${cover})
              returning id, title, description, body, title_en, description_en, body_en, created_at, cover_media_id
            `) as TextRow[]
          } catch (error) {
            if (isMissingTextCover(error)) {
              return Response.json(
                { error: 'Falta correr db/016_text_cover.sql en Neon' },
                { status: 503 },
              )
            }
            if (!isUndefinedColumn(error)) throw error
            created = (await sql`
              insert into texts (title, description, body, cover_media_id)
              values (${title}, ${body.description ?? ''}, ${body.body ?? ''}, ${cover})
              returning id, title, description, body, created_at, cover_media_id
            `) as TextRow[]
          }
          let coverUrl: string | undefined
          if (created[0]?.cover_media_id) {
            const media = (await sql`
              select url from media where id = ${created[0].cover_media_id}
            `) as { url: string }[]
            coverUrl = media[0]?.url
          }
          return Response.json({
            text: toText({ ...created[0], cover_url: coverUrl ?? null }),
          })
        } catch (error) {
          if (isMissingTextCover(error)) {
            return Response.json(
              { error: 'Falta correr db/016_text_cover.sql en Neon' },
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
