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
        const rows = await sql`
          select id, title, description, created_at
          from texts
          order by created_at desc
        `
        return Response.json({ texts: rows })
      }

      if (request.method === 'POST') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          title?: string
          description?: string
          body?: string
        }
        const title = (body.title ?? '').trim()
        if (!title) {
          return Response.json({ error: 'El título es obligatorio' }, { status: 400 })
        }
        const created = await sql`
          insert into texts (title, description, body)
          values (${title}, ${body.description ?? ''}, ${body.body ?? ''})
          returning id, title, description, body, created_at
        `
        return Response.json({ text: created[0] })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
