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
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
      }
      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)
      await sql`update hero_gates set x = 1605, y = 1110, width = 340, updated_at = now() where section_slug = 'trabajos'`
      await sql`update hero_gates set x = 1935, y = 1020, width = 280, updated_at = now() where section_slug = 'bio'`
      await sql`update hero_gates set x = 1320, y = 1560, width = 360, updated_at = now() where section_slug = 'textos'`
      await sql`update hero_gates set x = 2385, y = 315, width = 300, updated_at = now() where section_slug = 'exposiciones'`
      await sql`update hero_gates set x = 390, y = 2010, width = 270, updated_at = now() where section_slug = 'archivos'`
      await sql`update hero_gates set x = 3210, y = 2145, width = 250, updated_at = now() where section_slug = 'contacto'`
      const rows = (await sql`
        select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
        from hero_gates g
        left join media m on m.id = g.media_id
      `) as HeroRow[]
      return Response.json(toHeroLayout(rows))
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
