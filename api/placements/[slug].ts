const COOKIE = 'jt_admin'
const CANVAS_SLUGS = new Set(['trabajos', 'exposiciones', 'archivos'])
const MAX_CANVASES = 3

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

type PlaceRow = {
  id: string
  canvas_id: string | null
  media_id: string
  x: number
  y: number
  width: number
  z_index: number
  url: string
}

type CanvasRow = {
  id: string
  sort_order: number
  height_ratio: number
}

function toPieces(rows: PlaceRow[]) {
  return rows.map((row, i) => {
    const legacy = row.width > 90
    const col = i % 2
    const rowI = Math.floor(i / 2)
    return {
      id: row.id,
      mediaId: row.media_id,
      src: row.url,
      x: legacy ? (col === 0 ? 8 : 58) : row.x,
      y: legacy ? 4 + (rowI % 6) * 14 : row.y,
      width: legacy ? 24 : row.width,
      z: row.z_index,
    }
  })
}

async function loadCanvases(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
  slug: string,
) {
  let canvasRows = (await sql`
    select id, sort_order, height_ratio
    from section_canvases
    where section_slug = ${slug}
    order by sort_order
  `) as CanvasRow[]

  if (canvasRows.length === 0) {
    let heightRatio = 1.2
    try {
      const ratioRows = (await sql`
        select height_ratio from sections where slug = ${slug}
      `) as { height_ratio: number }[]
      heightRatio = ratioRows[0]?.height_ratio ?? 1.2
    } catch {
      heightRatio = 1.2
    }
    await sql`
      insert into section_canvases (section_slug, sort_order, height_ratio)
      values (${slug}, 0, ${heightRatio})
    `
    canvasRows = (await sql`
      select id, sort_order, height_ratio
      from section_canvases
      where section_slug = ${slug}
      order by sort_order
    `) as CanvasRow[]
  }

  const firstId = canvasRows[0]?.id
  if (firstId) {
    await sql`
      update placements
      set canvas_id = ${firstId}
      where section_slug = ${slug} and canvas_id is null
    `
  }

  const placeRows = (await sql`
    select p.id, p.canvas_id, p.media_id, p.x, p.y, p.width, p.z_index, m.url
    from placements p
    join media m on m.id = p.media_id
    where p.section_slug = ${slug}
    order by p.z_index, p.created_at
  `) as PlaceRow[]

  return canvasRows.map((canvas) => ({
    id: canvas.id,
    heightRatio: canvas.height_ratio ?? 1.2,
    pieces: toPieces(placeRows.filter((row) => row.canvas_id === canvas.id)),
  }))
}

export default {
  async fetch(request: Request) {
    try {
      const slug = slugOf(request)
      if (!slug || !CANVAS_SLUGS.has(slug)) {
        return Response.json({ error: 'Sección inválida' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') {
          return Response.json({
            canvases: [{ id: 'legacy', heightRatio: 1.2, pieces: [] }],
            pieces: [],
            heightRatio: 1.2,
          })
        }
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        try {
          const canvases = await loadCanvases(sql, slug)
          return Response.json({
            canvases,
            pieces: canvases[0]?.pieces ?? [],
            heightRatio: canvases[0]?.heightRatio ?? 1.2,
          })
        } catch {
          const rows = (await sql`
            select p.id, p.media_id, p.x, p.y, p.width, p.z_index, m.url
            from placements p
            join media m on m.id = p.media_id
            where p.section_slug = ${slug}
            order by p.z_index, p.created_at
          `) as PlaceRow[]
          const pieces = toPieces(rows)
          return Response.json({
            canvases: [{ id: 'legacy', heightRatio: 1.2, pieces }],
            pieces,
            heightRatio: 1.2,
          })
        }
      }

      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }

      if (request.method === 'POST') {
        const existing = (await sql`
          select id from section_canvases where section_slug = ${slug}
        `) as { id: string }[]
        if (existing.length >= MAX_CANVASES) {
          return Response.json({ error: 'Máximo 3 lienzos por sección' }, { status: 400 })
        }
        const nextOrder = existing.length
        const created = (await sql`
          insert into section_canvases (section_slug, sort_order, height_ratio)
          values (${slug}, ${nextOrder}, 1.2)
          returning id, height_ratio
        `) as { id: string; height_ratio: number }[]
        return Response.json({
          canvas: {
            id: created[0].id,
            heightRatio: created[0].height_ratio,
            pieces: [],
          },
        })
      }

      if (request.method === 'DELETE') {
        const canvasId = new URL(request.url).searchParams.get('canvasId') || ''
        if (!isUuid(canvasId)) {
          return Response.json({ error: 'Lienzo inválido' }, { status: 400 })
        }
        const existing = (await sql`
          select id from section_canvases where section_slug = ${slug}
        `) as { id: string }[]
        if (existing.length <= 1) {
          return Response.json({ error: 'Tiene que quedar al menos un lienzo' }, { status: 400 })
        }
        await sql`
          delete from section_canvases
          where id = ${canvasId} and section_slug = ${slug}
        `
        const leftover = (await sql`
          select id from section_canvases
          where section_slug = ${slug}
          order by sort_order
        `) as { id: string }[]
        for (let i = 0; i < leftover.length; i++) {
          await sql`
            update section_canvases set sort_order = ${i} where id = ${leftover[i].id}
          `
        }
        return Response.json({ ok: true })
      }

      if (request.method === 'PUT') {
        type PieceIn = {
          id: string
          mediaId?: string
          x: number
          y: number
          width: number
        }
        const body = (await request.json().catch(() => ({}))) as {
          canvases?: { id: string; heightRatio?: number; pieces?: PieceIn[] }[]
          pieces?: PieceIn[]
          heightRatio?: number
        }

        const canvases: { id: string; heightRatio?: number; pieces?: PieceIn[] }[] =
          body.canvases && body.canvases.length > 0
            ? body.canvases.slice(0, MAX_CANVASES)
            : [
                {
                  id: 'legacy',
                  heightRatio: body.heightRatio,
                  pieces: body.pieces ?? [],
                },
              ]

        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i]
          if (!isUuid(canvas.id)) continue
          const ratio =
            typeof canvas.heightRatio === 'number' && Number.isFinite(canvas.heightRatio)
              ? Math.min(2.5, Math.max(0.6, canvas.heightRatio))
              : 1.2
          await sql`
            update section_canvases
            set height_ratio = ${ratio}, sort_order = ${i}
            where id = ${canvas.id} and section_slug = ${slug}
          `
          const keepIds = (canvas.pieces ?? []).map((piece) => piece.id).filter(isUuid)
          if (keepIds.length === 0) {
            await sql`delete from placements where canvas_id = ${canvas.id} and section_slug = ${slug}`
          } else {
            await sql`
              delete from placements
              where canvas_id = ${canvas.id}
                and section_slug = ${slug}
                and not (id = any(${keepIds}))
            `
          }
          for (const piece of canvas.pieces ?? []) {
            if (isUuid(piece.id)) {
              await sql`
                update placements
                set x = ${piece.x},
                    y = ${piece.y},
                    width = ${piece.width}
                where id = ${piece.id} and section_slug = ${slug}
              `
              continue
            }
            if (piece.mediaId && isUuid(piece.mediaId)) {
              await sql`
                insert into placements (section_slug, media_id, canvas_id, x, y, width, z_index)
                values (${slug}, ${piece.mediaId}, ${canvas.id}, ${piece.x}, ${piece.y}, ${piece.width}, 0)
              `
            }
          }
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
