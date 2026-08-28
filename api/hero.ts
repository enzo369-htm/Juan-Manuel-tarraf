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
  media_id: string | null
  url: string
  updated_at: string
}

const BG_FALLBACK = '/works/img fondo hero.jpg'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function toHeroLayout(
  rows: HeroRow[],
  backgroundUrl = BG_FALLBACK,
  backgroundMediaId?: string,
) {
  const positions: Record<
    string,
    { x: number; y: number; width: number; src?: string; mediaId?: string }
  > = {}
  let updatedAt = new Date(0).toISOString()
  for (const row of rows) {
    positions[row.slug] = {
      x: row.x,
      y: row.y,
      width: row.width,
      src: row.url,
      mediaId: row.media_id || undefined,
    }
    if (row.updated_at > updatedAt) updatedAt = row.updated_at
  }
  return { version: 1 as const, updatedAt, positions, backgroundUrl, backgroundMediaId }
}

async function loadHero(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
) {
  const rows = (await sql`
    select g.section_slug as slug, g.x, g.y, g.width, g.media_id, m.url, g.updated_at
    from hero_gates g
    left join media m on m.id = g.media_id
    order by g.section_slug
  `) as HeroRow[]
  let backgroundUrl = BG_FALLBACK
  let backgroundMediaId: string | undefined
  try {
    const bg = (await sql`
      select b.media_id, m.url
      from hero_background b
      left join media m on m.id = b.media_id
      where b.id = 1
    `) as { media_id: string | null; url: string | null }[]
    if (bg[0]?.url) backgroundUrl = bg[0].url
    if (bg[0]?.media_id) backgroundMediaId = bg[0].media_id
  } catch {
    /* db/010_hero_background.sql still missing */
  }
  return toHeroLayout(rows, backgroundUrl, backgroundMediaId)
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
        const layout = await loadHero(sql)
        return Response.json(layout, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      if (request.method === 'PUT') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          positions?: Record<
            string,
            { x: number; y: number; width: number; mediaId?: string }
          >
          backgroundMediaId?: string
        }
        for (const [slug, pos] of Object.entries(body.positions ?? {})) {
          if (!/^[a-z]+$/.test(slug)) continue
          const mediaId =
            typeof pos.mediaId === 'string' && isUuid(pos.mediaId) ? pos.mediaId : null
          if (mediaId) {
            await sql`
              update hero_gates
              set x = ${Math.round(pos.x)},
                  y = ${Math.round(pos.y)},
                  width = ${Math.round(pos.width)},
                  media_id = ${mediaId},
                  updated_at = now()
              where section_slug = ${slug}
            `
          } else {
            await sql`
              update hero_gates
              set x = ${Math.round(pos.x)},
                  y = ${Math.round(pos.y)},
                  width = ${Math.round(pos.width)},
                  updated_at = now()
              where section_slug = ${slug}
            `
          }
        }
        if (typeof body.backgroundMediaId === 'string' && isUuid(body.backgroundMediaId)) {
          try {
            await sql`
              insert into hero_background (id, media_id, updated_at)
              values (1, ${body.backgroundMediaId}, now())
              on conflict (id) do update
              set media_id = excluded.media_id, updated_at = now()
            `
          } catch {
            return Response.json(
              { error: 'Falta correr db/010_hero_background.sql en Neon' },
              { status: 503 },
            )
          }
        }
        const layout = await loadHero(sql)
        return Response.json(layout, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
