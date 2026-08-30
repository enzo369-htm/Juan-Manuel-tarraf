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
  const fromPath = url.pathname.match(/\/api\/exhibitions\/([0-9a-f-]+)/i)?.[1]
  return fromPath || url.searchParams.get('id') || ''
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

async function loadOne(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
  id: string,
) {
  const rows = (await sql`
    select e.id, e.title, e.description, e.sort_order, e.created_at,
           e.cover_media_id, m.url as cover_url
    from exhibitions e
    left join media m on m.id = e.cover_media_id
    where e.id = ${id}
  `) as Parameters<typeof toExhibition>[0][]
  return rows[0] ? toExhibition(rows[0]) : null
}

export default {
  async fetch(request: Request) {
    try {
      const id = idOf(request)
      if (!isUuid(id)) {
        return Response.json({ error: 'Exposición inválida' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        try {
          const exhibition = await loadOne(sql, id)
          if (!exhibition) {
            return Response.json({ error: 'No encontrado' }, { status: 404 })
          }
          return Response.json({ exhibition }, { headers: { 'Cache-Control': 'no-store' } })
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

      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }

      if (request.method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as {
          title?: string
          description?: string
          coverMediaId?: string
        }
        const title = (body.title ?? '').trim()
        if (!title) {
          return Response.json({ error: 'El título es obligatorio' }, { status: 400 })
        }
        try {
          const cover =
            typeof body.coverMediaId === 'string' && isUuid(body.coverMediaId)
              ? body.coverMediaId
              : undefined
          const updated = cover
            ? ((await sql`
                update exhibitions
                set title = ${title},
                    description = ${body.description ?? ''},
                    cover_media_id = ${cover}
                where id = ${id}
                returning id
              `) as { id: string }[])
            : ((await sql`
                update exhibitions
                set title = ${title},
                    description = ${body.description ?? ''}
                where id = ${id}
                returning id
              `) as { id: string }[])
          if (!updated[0]) {
            return Response.json({ error: 'No encontrado' }, { status: 404 })
          }
          const exhibition = await loadOne(sql, id)
          return Response.json({ exhibition })
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

      if (request.method === 'DELETE') {
        try {
          await sql`delete from exhibitions where id = ${id}`
          return Response.json({ ok: true })
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
