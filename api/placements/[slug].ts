const COOKIE = 'jt_admin'
const CANVAS_SLUGS = new Set(['trabajos', 'exposiciones', 'archivos'])
const MAX_PER_KIND = 4

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

function exhibitionIdOf(request: Request, body?: { exhibitionId?: string }) {
  const fromBody = typeof body?.exhibitionId === 'string' ? body.exhibitionId : ''
  const fromQuery = new URL(request.url).searchParams.get('exhibitionId') || ''
  const value = fromBody || fromQuery
  return isUuid(value) ? value : ''
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
  ficha?: string | null
}

type CanvasRow = {
  id: string
  sort_order: number
  height_ratio: number
  kind?: string | null
  title?: string | null
  description?: string | null
}

function clampPct(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function clip(value: string, max: number) {
  return value.slice(0, max)
}

async function readPlacementRows(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
  slug: string,
) {
  try {
    return (await sql`
      select p.id, p.canvas_id, p.media_id, p.x, p.y, p.width, p.z_index, p.ficha, m.url
      from placements p
      join media m on m.id = p.media_id
      where p.section_slug = ${slug}
      order by p.z_index, p.created_at
    `) as PlaceRow[]
  } catch {
    return (await sql`
      select p.id, p.canvas_id, p.media_id, p.x, p.y, p.width, p.z_index, m.url
      from placements p
      join media m on m.id = p.media_id
      where p.section_slug = ${slug}
      order by p.z_index, p.created_at
    `) as PlaceRow[]
  }
}

function toPieces(rows: PlaceRow[]) {
  return rows.map((row, i) => {
    const legacy = row.width > 100
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
      ficha: row.ficha ?? '',
    }
  })
}

function toBlock(canvas: CanvasRow, pieces: ReturnType<typeof toPieces>) {
  const kind = canvas.kind === 'text' ? 'text' : 'canvas'
  return {
    id: canvas.id,
    kind,
    title: canvas.title ?? '',
    description: canvas.description ?? '',
    heightRatio: canvas.height_ratio ?? 1.2,
    pieces: kind === 'text' ? [] : pieces,
  }
}

async function readCanvases(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>,
  slug: string,
  exhibitionId = '',
) {
  let canvasRows: CanvasRow[] = []
  try {
    canvasRows = exhibitionId
      ? ((await sql`
          select id, sort_order, height_ratio, kind, title, description
          from section_canvases
          where section_slug = ${slug} and exhibition_id = ${exhibitionId}
          order by sort_order
        `) as CanvasRow[])
      : slug === 'exposiciones'
        ? ((await sql`
            select id, sort_order, height_ratio, kind, title, description
            from section_canvases
            where section_slug = ${slug} and exhibition_id is null
            order by sort_order
          `) as CanvasRow[])
        : ((await sql`
            select id, sort_order, height_ratio, kind, title, description
            from section_canvases
            where section_slug = ${slug}
            order by sort_order
          `) as CanvasRow[])
  } catch {
    try {
      canvasRows = (await sql`
        select id, sort_order, height_ratio
        from section_canvases
        where section_slug = ${slug}
        order by sort_order
      `) as CanvasRow[]
    } catch {
      canvasRows = []
    }
  }

  const placeRows = await readPlacementRows(sql, slug)

  return canvasRows.map((canvas, index) =>
    toBlock(
      canvas,
      toPieces(
        placeRows.filter(
          (row) => row.canvas_id === canvas.id || (index === 0 && !row.canvas_id && canvas.kind !== 'text'),
        ),
      ),
    ),
  )
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
          return Response.json({ canvases: [], pieces: [], heightRatio: 1.2 })
        }
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      if (request.method === 'GET') {
        const exhibitionId = exhibitionIdOf(request)
        const canvases = await readCanvases(sql, slug, exhibitionId)
        return Response.json({
          canvases,
          pieces: canvases.find((block) => block.kind === 'canvas')?.pieces ?? [],
          heightRatio: canvases.find((block) => block.kind === 'canvas')?.heightRatio ?? 1.2,
        })
      }

      if (!(await isAuthed(request))) {
        return Response.json({ error: 'No autorizado' }, { status: 401 })
      }

      if (request.method === 'POST') {
        const payload = (await request.json().catch(() => ({}))) as {
          kind?: string
          exhibitionId?: string
        }
        const exhibitionId = exhibitionIdOf(request, payload)
        const kind = payload.kind === 'text' ? 'text' : 'canvas'
        let existing: { id: string; kind?: string | null }[] = []
        try {
          existing = exhibitionId
            ? ((await sql`
                select id, kind from section_canvases
                where section_slug = ${slug} and exhibition_id = ${exhibitionId}
              `) as { id: string; kind?: string | null }[])
            : slug === 'exposiciones'
              ? ((await sql`
                  select id, kind from section_canvases
                  where section_slug = ${slug} and exhibition_id is null
                `) as { id: string; kind?: string | null }[])
              : ((await sql`
                  select id, kind from section_canvases where section_slug = ${slug}
                `) as { id: string; kind?: string | null }[])
        } catch {
          existing = (await sql`
            select id from section_canvases where section_slug = ${slug}
          `) as { id: string }[]
        }
        const ofKind = existing.filter((row) => (row.kind || 'canvas') === kind)
        if (ofKind.length >= MAX_PER_KIND) {
          return Response.json(
            { error: kind === 'text' ? 'Máximo 4 textos por sección' : 'Máximo 4 lienzos por sección' },
            { status: 400 },
          )
        }
        const nextOrder = existing.length
        try {
          const created = exhibitionId
            ? ((await sql`
                insert into section_canvases
                  (section_slug, exhibition_id, sort_order, height_ratio, kind, title, description)
                values (${slug}, ${exhibitionId}, ${nextOrder}, 1.2, ${kind}, '', '')
                returning id, height_ratio, kind, title, description
              `) as { id: string; height_ratio: number; kind: string; title: string; description: string }[])
            : ((await sql`
                insert into section_canvases (section_slug, sort_order, height_ratio, kind, title, description)
                values (${slug}, ${nextOrder}, 1.2, ${kind}, '', '')
                returning id, height_ratio, kind, title, description
              `) as { id: string; height_ratio: number; kind: string; title: string; description: string }[])
          const row = created[0]
          return Response.json({
            canvas: {
              id: row.id,
              kind: row.kind === 'text' ? 'text' : 'canvas',
              title: row.title ?? '',
              description: row.description ?? '',
              heightRatio: row.height_ratio,
              pieces: [],
            },
          })
        } catch {
          return Response.json(
            { error: 'Falta correr db/009_section_blocks.sql en Neon' },
            { status: 503 },
          )
        }
      }

      if (request.method === 'DELETE') {
        const canvasId = new URL(request.url).searchParams.get('canvasId') || ''
        const exhibitionId = exhibitionIdOf(request)
        if (!isUuid(canvasId)) {
          return Response.json({ error: 'Bloque inválido' }, { status: 400 })
        }
        await sql`
          delete from section_canvases
          where id = ${canvasId} and section_slug = ${slug}
        `
        const leftover = exhibitionId
          ? ((await sql`
              select id from section_canvases
              where section_slug = ${slug} and exhibition_id = ${exhibitionId}
              order by sort_order
            `) as { id: string }[])
          : ((await sql`
              select id from section_canvases
              where section_slug = ${slug}
              order by sort_order
            `) as { id: string }[])
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
          ficha?: string
        }
        type BlockIn = {
          id: string
          kind?: string
          title?: string
          description?: string
          heightRatio?: number
          pieces?: PieceIn[]
        }
        const body = (await request.json().catch(() => ({}))) as {
          canvases?: BlockIn[]
          pieces?: PieceIn[]
          heightRatio?: number
          exhibitionId?: string
        }
        const exhibitionId = exhibitionIdOf(request, body)

        const canvases: BlockIn[] = Array.isArray(body.canvases) ? body.canvases : []

        const textCount = canvases.filter((block) => block.kind === 'text').length
        const canvasCount = canvases.length - textCount
        if (textCount > MAX_PER_KIND || canvasCount > MAX_PER_KIND) {
          return Response.json({ error: 'Máximo 4 textos y 4 lienzos por sección' }, { status: 400 })
        }

        const saved = await readCanvases(sql, slug, exhibitionId)
        for (let i = 0; i < canvases.length; i++) {
          const canvas = canvases[i]
          const kind = canvas.kind === 'text' ? 'text' : 'canvas'
          const title = clip(typeof canvas.title === 'string' ? canvas.title : '', 200)
          const description = clip(
            typeof canvas.description === 'string' ? canvas.description : '',
            1200,
          )
          const ratio =
            typeof canvas.heightRatio === 'number' && Number.isFinite(canvas.heightRatio)
              ? Math.min(2.5, Math.max(0.6, canvas.heightRatio))
              : 1.2
          let canvasId = isUuid(canvas.id) ? canvas.id : saved[i]?.id
          if (!canvasId) {
            const created = exhibitionId
              ? ((await sql`
                  insert into section_canvases
                    (section_slug, exhibition_id, sort_order, height_ratio, kind, title, description)
                  values (${slug}, ${exhibitionId}, ${i}, ${ratio}, ${kind}, ${title}, ${description})
                  returning id
                `) as { id: string }[])
              : ((await sql`
                  insert into section_canvases (section_slug, sort_order, height_ratio, kind, title, description)
                  values (${slug}, ${i}, ${ratio}, ${kind}, ${title}, ${description})
                  returning id
                `) as { id: string }[])
            canvasId = created[0]?.id
          }
          if (!canvasId) {
            return Response.json({ error: 'No se pudo guardar el bloque' }, { status: 500 })
          }
          try {
            await sql`
              update section_canvases
              set height_ratio = ${ratio},
                  sort_order = ${i},
                  title = ${title},
                  description = ${description}
              where id = ${canvasId} and section_slug = ${slug}
            `
          } catch {
            await sql`
              update section_canvases
              set height_ratio = ${ratio}, sort_order = ${i}
              where id = ${canvasId} and section_slug = ${slug}
            `
          }
          if (kind === 'text' || !Array.isArray(canvas.pieces)) continue
          const keepIds = canvas.pieces.map((piece) => piece.id).filter(isUuid)
          if (keepIds.length === 0) {
            await sql`delete from placements where canvas_id = ${canvasId} and section_slug = ${slug}`
          } else {
            await sql`
              delete from placements
              where canvas_id = ${canvasId}
                and section_slug = ${slug}
                and not (id = any(${keepIds}))
            `
          }
          for (const piece of canvas.pieces) {
            const x = clampPct(piece.x, 0, 95)
            const y = clampPct(piece.y, 0, 98)
            const width = clampPct(piece.width, 5, 90)
            const ficha = clip(typeof piece.ficha === 'string' ? piece.ficha : '', 2000)
            if (isUuid(piece.id)) {
              try {
                await sql`
                  update placements
                  set x = ${x},
                      y = ${y},
                      width = ${width},
                      canvas_id = ${canvasId},
                      ficha = ${ficha}
                  where id = ${piece.id} and section_slug = ${slug}
                `
              } catch {
                await sql`
                  update placements
                  set x = ${x},
                      y = ${y},
                      width = ${width},
                      canvas_id = ${canvasId}
                  where id = ${piece.id} and section_slug = ${slug}
                `
              }
              continue
            }
            if (piece.mediaId && isUuid(piece.mediaId)) {
              await sql`
                insert into placements (section_slug, media_id, canvas_id, x, y, width, z_index)
                values (${slug}, ${piece.mediaId}, ${canvasId}, ${x}, ${y}, ${width}, 0)
              `
            }
          }
        }
        const canvasesOut = await readCanvases(sql, slug, exhibitionId)
        return Response.json({
          ok: true,
          canvases: canvasesOut,
          pieces: canvasesOut.find((block) => block.kind === 'canvas')?.pieces ?? [],
          heightRatio: canvasesOut.find((block) => block.kind === 'canvas')?.heightRatio ?? 1.2,
        })
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
