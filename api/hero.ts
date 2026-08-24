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

type HeroRow = {
  slug: string
  x: number
  y: number
  width: number
  url: string
  updated_at: string
}

function toHeroLayout(rows: HeroRow[]) {
  const positions: Record<string, { x: number; y: number; width: number; src?: string }> = {}
  let updatedAt = new Date(0).toISOString()
  for (const row of rows) {
    positions[row.slug] = { x: row.x, y: row.y, width: row.width, src: row.url }
    if (row.updated_at > updatedAt) updatedAt = row.updated_at
  }
  return { version: 1 as const, updatedAt, positions }
}

export default {
  async fetch(request: Request) {
    try {
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        const rows = (await sql`
          select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
          from hero_gates g
          left join media m on m.id = g.media_id
          order by g.section_slug
        `) as HeroRow[]
        return Response.json(toHeroLayout(rows))
      }

      if (request.method === 'PUT') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          positions?: Record<string, { x: number; y: number; width: number }>
        }
        for (const [slug, pos] of Object.entries(body.positions ?? {})) {
          if (!/^[a-z]+$/.test(slug)) continue
          await sql`
            update hero_gates
            set x = ${Math.round(pos.x)},
                y = ${Math.round(pos.y)},
                width = ${Math.round(pos.width)},
                updated_at = now()
            where section_slug = ${slug}
          `
        }
        const rows = (await sql`
          select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
          from hero_gates g
          left join media m on m.id = g.media_id
          order by g.section_slug
        `) as HeroRow[]
        return Response.json(toHeroLayout(rows))
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
