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

function slugOf(request: Request) {
  const url = new URL(request.url)
  const fromPath = url.pathname.match(/\/api\/placements\/([a-z]+)/)?.[1]
  return fromPath || url.searchParams.get('slug') || ''
}

type PlaceRow = {
  id: string
  x: number
  y: number
  width: number
  z_index: number
  url: string
}

function toPieces(rows: PlaceRow[]) {
  return rows.map((row, i) => {
    const legacy = row.width > 90
    const col = i % 2
    const rowI = Math.floor(i / 2)
    return {
      id: row.id,
      src: row.url,
      x: legacy ? (col === 0 ? 8 : 58) : row.x,
      y: legacy ? 4 + (rowI % 6) * 14 : row.y,
      width: legacy ? 24 : row.width,
      z: row.z_index,
    }
  })
}

export default {
  async fetch(request: Request) {
    try {
      const slug = slugOf(request)
      if (!slug) {
        return Response.json({ error: 'Sección inválida' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') {
          return Response.json({ pieces: [], heightRatio: 1.2 })
        }
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        let heightRatio = 1.2
        try {
          const ratioRows = (await sql`
            select height_ratio from sections where slug = ${slug}
          `) as { height_ratio: number }[]
          heightRatio = ratioRows[0]?.height_ratio ?? 1.2
        } catch {
          heightRatio = 1.2
        }
        const rows = (await sql`
          select p.id, p.x, p.y, p.width, p.z_index, m.url
          from placements p
          join media m on m.id = p.media_id
          where p.section_slug = ${slug}
          order by p.z_index, p.created_at
        `) as PlaceRow[]
        return Response.json({ heightRatio, pieces: toPieces(rows) })
      }

      if (request.method === 'PUT') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const body = (await request.json().catch(() => ({}))) as {
          pieces?: { id: string; x: number; y: number; width: number }[]
          heightRatio?: number
        }
        if (typeof body.heightRatio === 'number' && Number.isFinite(body.heightRatio)) {
          const ratio = Math.min(2.5, Math.max(0.6, body.heightRatio))
          try {
            await sql`
              update sections set height_ratio = ${ratio} where slug = ${slug}
            `
          } catch {
            /* height_ratio still missing until db/003 is applied */
          }
        }
        for (const piece of body.pieces ?? []) {
          await sql`
            update placements
            set x = ${piece.x},
                y = ${piece.y},
                width = ${piece.width}
            where id = ${piece.id} and section_slug = ${slug}
          `
        }
        return Response.json({ ok: true })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de servidor'
      return Response.json({ error: message }, { status: 500 })
    }
  },
}
