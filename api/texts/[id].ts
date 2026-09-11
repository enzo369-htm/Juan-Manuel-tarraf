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

function idOf(request: Request) {
  const url = new URL(request.url)
  const fromPath = url.pathname.match(/\/api\/texts\/([0-9a-f-]+)/i)?.[1]
  return fromPath || url.searchParams.get('id') || ''
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
      const id = idOf(request)
      if (!isUuid(id)) {
        return Response.json({ error: 'Texto inválido' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select t.id, t.title, t.description, t.body, t.title_en, t.description_en, t.body_en, t.created_at,
                   t.cover_media_id, m.url as cover_url
            from texts t
            left join media m on m.id = t.cover_media_id
            where t.id = ${id}
          `) as TextRow[]
          if (!rows[0]) {
            return Response.json({ error: 'No encontrado' }, { status: 404 })
          }
          return Response.json({ text: toText(rows[0]) })
        } catch (error) {
          if (!isUndefinedColumn(error) && !isMissingTextCover(error)) throw error
          try {
            const rows = (await sql`
              select t.id, t.title, t.description, t.body, t.created_at,
                     t.cover_media_id, m.url as cover_url
              from texts t
              left join media m on m.id = t.cover_media_id
              where t.id = ${id}
            `) as TextRow[]
            if (!rows[0]) {
              return Response.json({ error: 'No encontrado' }, { status: 404 })
            }
            return Response.json({ text: toText(rows[0]) })
          } catch (retryError) {
            if (!isUndefinedColumn(retryError) && !isMissingTextCover(retryError)) throw retryError
            const rows = (await sql`
              select id, title, description, body, created_at
              from texts
              where id = ${id}
            `) as TextRow[]
            if (!rows[0]) {
              return Response.json({ error: 'No encontrado' }, { status: 404 })
            }
            return Response.json({ text: toText(rows[0]) })
          }
        }
      }

      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }

      if (request.method === 'PUT') {
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
            : undefined
        try {
          let updated: { id: string }[]
          try {
            updated = cover
              ? ((await sql`
                  update texts
                  set title = ${title},
                      description = ${body.description ?? ''},
                      body = ${body.body ?? ''},
                      title_en = ${body.titleEn ?? ''},
                      description_en = ${body.descriptionEn ?? ''},
                      body_en = ${body.bodyEn ?? ''},
                      cover_media_id = ${cover}
                  where id = ${id}
                  returning id
                `) as { id: string }[])
              : ((await sql`
                  update texts
                  set title = ${title},
                      description = ${body.description ?? ''},
                      body = ${body.body ?? ''},
                      title_en = ${body.titleEn ?? ''},
                      description_en = ${body.descriptionEn ?? ''},
                      body_en = ${body.bodyEn ?? ''}
                  where id = ${id}
                  returning id
                `) as { id: string }[])
          } catch (error) {
            if (isMissingTextCover(error)) {
              return Response.json(
                { error: 'Falta correr db/016_text_cover.sql en Neon' },
                { status: 503 },
              )
            }
            if (!isUndefinedColumn(error)) throw error
            updated = cover
              ? ((await sql`
                  update texts
                  set title = ${title},
                      description = ${body.description ?? ''},
                      body = ${body.body ?? ''},
                      cover_media_id = ${cover}
                  where id = ${id}
                  returning id
                `) as { id: string }[])
              : ((await sql`
                  update texts
                  set title = ${title},
                      description = ${body.description ?? ''},
                      body = ${body.body ?? ''}
                  where id = ${id}
                  returning id
                `) as { id: string }[])
          }
          if (!updated[0]) {
            return Response.json({ error: 'No encontrado' }, { status: 404 })
          }
          try {
            const rows = (await sql`
              select t.id, t.title, t.description, t.body, t.title_en, t.description_en, t.body_en, t.created_at,
                     t.cover_media_id, m.url as cover_url
              from texts t
              left join media m on m.id = t.cover_media_id
              where t.id = ${id}
            `) as TextRow[]
            return Response.json({ text: toText(rows[0]) })
          } catch (retryError) {
            if (!isUndefinedColumn(retryError)) throw retryError
            const rows = (await sql`
              select t.id, t.title, t.description, t.body, t.created_at,
                     t.cover_media_id, m.url as cover_url
              from texts t
              left join media m on m.id = t.cover_media_id
              where t.id = ${id}
            `) as TextRow[]
            return Response.json({ text: toText(rows[0]) })
          }
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

      if (request.method === 'DELETE') {
        await sql`delete from texts where id = ${id}`
        return Response.json({ ok: true })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
