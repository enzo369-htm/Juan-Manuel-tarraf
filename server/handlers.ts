import { randomUUID } from 'node:crypto'
import { sql } from './db'
import { hasDatabase, hasR2 } from './env'
import {
  type ApiRequest,
  type ApiResponse,
  clearSessionCookie,
  isAuthed,
  pathOf,
  readBody,
  readJson,
  requireAuth,
  sendJson,
  setSessionCookie,
  signSession,
} from './http'

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

async function loadHero(db: ReturnType<typeof sql>) {
  const rows = (await db`
    select g.section_slug as slug, g.x, g.y, g.width, g.media_id, m.url, g.updated_at
    from hero_gates g
    left join media m on m.id = g.media_id
    order by g.section_slug
  `) as HeroRow[]
  let backgroundUrl = BG_FALLBACK
  let backgroundMediaId: string | undefined
  try {
    const bg = (await db`
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

export async function handleApi(req: ApiRequest, res: ApiResponse) {
  const method = (req.method ?? 'GET').toUpperCase()
  const path = pathOf(req)

  try {
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await readJson<{ password?: string }>(req)
      const expected = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'tarraf')
      if (!expected || body.password !== expected) {
        sendJson(res, 401, { error: 'Contraseña incorrecta' })
        return
      }
      setSessionCookie(res, signSession())
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      clearSessionCookie(res)
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/api/auth/me' && method === 'GET') {
      sendJson(res, 200, { ok: isAuthed(req) })
      return
    }

    if (path === '/api/hero' && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      sendJson(res, 200, await loadHero(sql()))
      return
    }

    if (path === '/api/hero' && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{
        positions?: Record<string, { x: number; y: number; width: number; mediaId?: string }>
        backgroundMediaId?: string
      }>(req)
      const db = sql()
      for (const [slug, pos] of Object.entries(body.positions ?? {})) {
        if (!/^[a-z]+$/.test(slug)) continue
        const mediaId =
          typeof pos.mediaId === 'string' && isUuid(pos.mediaId) ? pos.mediaId : null
        if (mediaId) {
          await db`
            update hero_gates
            set x = ${Math.round(pos.x)},
                y = ${Math.round(pos.y)},
                width = ${Math.round(pos.width)},
                media_id = ${mediaId},
                updated_at = now()
            where section_slug = ${slug}
          `
        } else {
          await db`
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
          await db`
            insert into hero_background (id, media_id, updated_at)
            values (1, ${body.backgroundMediaId}, now())
            on conflict (id) do update
            set media_id = excluded.media_id, updated_at = now()
          `
        } catch {
          sendJson(res, 503, { error: 'Falta correr db/010_hero_background.sql en Neon' })
          return
        }
      }
      sendJson(res, 200, await loadHero(db))
      return
    }

    if (path === '/api/hero/reset' && method === 'POST') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const db = sql()
      await db`update hero_gates set x = 1204, y = 833, width = 340, updated_at = now() where section_slug = 'trabajos'`
      await db`update hero_gates set x = 1451, y = 765, width = 280, updated_at = now() where section_slug = 'bio'`
      await db`update hero_gates set x = 990, y = 1170, width = 360, updated_at = now() where section_slug = 'textos'`
      await db`update hero_gates set x = 1789, y = 236, width = 300, updated_at = now() where section_slug = 'exposiciones'`
      await db`update hero_gates set x = 293, y = 1508, width = 270, updated_at = now() where section_slug = 'archivos'`
      await db`update hero_gates set x = 2408, y = 1609, width = 250, updated_at = now() where section_slug = 'contacto'`
      sendJson(res, 200, await loadHero(db))
      return
    }

    const copyMatch = path.match(/^\/api\/copy\/([a-z]+)$/)
    if (copyMatch && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 200, { slug: copyMatch[1], body: '', portraitUrl: '' })
        return
      }
      try {
        const rows = (await sql()`
          select section_slug as slug, body, portrait_url
          from section_copy
          where section_slug = ${copyMatch[1]}
        `) as { slug: string; body: string; portrait_url: string | null }[]
        const row = rows[0]
        sendJson(res, 200, {
          slug: row?.slug ?? copyMatch[1],
          body: row?.body ?? '',
          portraitUrl: row?.portrait_url ?? '',
        })
      } catch {
        const rows = (await sql()`
          select section_slug as slug, body from section_copy where section_slug = ${copyMatch[1]}
        `) as { slug: string; body: string }[]
        sendJson(res, 200, { slug: copyMatch[1], body: rows[0]?.body ?? '', portraitUrl: '' })
      }
      return
    }

    if (copyMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{ body?: string; portraitUrl?: string }>(req)
      const text = body.body ?? ''
      const db = sql()
      const portraitUrl =
        copyMatch[1] === 'bio' && typeof body.portraitUrl === 'string' ? body.portraitUrl : null
      if (portraitUrl !== null) {
        await db`
          insert into section_copy (section_slug, body, portrait_url)
          values (${copyMatch[1]}, ${text}, ${portraitUrl})
          on conflict (section_slug) do update
          set body = excluded.body, portrait_url = excluded.portrait_url
        `
        sendJson(res, 200, { slug: copyMatch[1], body: text, portraitUrl })
        return
      }
      await db`
        insert into section_copy (section_slug, body)
        values (${copyMatch[1]}, ${text})
        on conflict (section_slug) do update set body = excluded.body
      `
      sendJson(res, 200, { slug: copyMatch[1], body: text, portraitUrl: '' })
      return
    }

    const placeMatch = path.match(/^\/api\/placements\/([a-z]+)$/)
    if (placeMatch && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 200, { canvases: [], pieces: [], heightRatio: 1.2 })
        return
      }
      const db = sql()
      let canvasRows: {
        id: string
        height_ratio: number
        kind?: string | null
        title?: string | null
        description?: string | null
      }[] = []
      try {
        canvasRows = (await db`
          select id, height_ratio, kind, title, description from section_canvases
          where section_slug = ${placeMatch[1]}
          order by sort_order
        `) as typeof canvasRows
      } catch {
        try {
          canvasRows = (await db`
            select id, height_ratio from section_canvases
            where section_slug = ${placeMatch[1]}
            order by sort_order
          `) as typeof canvasRows
        } catch {
          canvasRows = []
        }
      }
      const rows = (await db`
        select p.id, p.canvas_id, p.media_id, p.x, p.y, p.width, p.z_index, m.url
        from placements p
        join media m on m.id = p.media_id
        where p.section_slug = ${placeMatch[1]}
        order by p.z_index, p.created_at
      `) as { id: string; canvas_id: string | null; media_id: string; x: number; y: number; width: number; z_index: number; url: string }[]
      const toPiece = (row: (typeof rows)[number]) => ({
        id: row.id,
        mediaId: row.media_id,
        src: row.url,
        x: row.width > 100 ? 8 : row.x,
        y: row.width > 100 ? 8 : row.y,
        width: row.width > 100 ? 24 : row.width,
        z: row.z_index,
      })
      const canvases = canvasRows.map((canvas, index) => {
        const kind = canvas.kind === 'text' ? 'text' : 'canvas'
        return {
          id: canvas.id,
          kind,
          title: canvas.title ?? '',
          description: canvas.description ?? '',
          heightRatio: canvas.height_ratio ?? 1.2,
          pieces:
            kind === 'text'
              ? []
              : rows
                  .filter((row) => row.canvas_id === canvas.id || (index === 0 && !row.canvas_id))
                  .map(toPiece),
        }
      })
      sendJson(res, 200, {
        canvases,
        pieces: canvases.find((block) => block.kind === 'canvas')?.pieces ?? [],
        heightRatio: canvases.find((block) => block.kind === 'canvas')?.heightRatio ?? 1.2,
      })
      return
    }

    if (placeMatch && method === 'POST') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const payload = await readJson<{ kind?: string }>(req)
      const kind = payload.kind === 'text' ? 'text' : 'canvas'
      const db = sql()
      let existing: { id: string; kind?: string | null }[] = []
      try {
        existing = (await db`
          select id, kind from section_canvases where section_slug = ${placeMatch[1]}
        `) as typeof existing
      } catch {
        existing = (await db`
          select id from section_canvases where section_slug = ${placeMatch[1]}
        `) as typeof existing
      }
      const ofKind = existing.filter((row) => (row.kind || 'canvas') === kind)
      if (ofKind.length >= 4) {
        sendJson(res, 400, {
          error: kind === 'text' ? 'Máximo 4 textos por sección' : 'Máximo 4 lienzos por sección',
        })
        return
      }
      try {
        const created = (await db`
          insert into section_canvases (section_slug, sort_order, height_ratio, kind, title, description)
          values (${placeMatch[1]}, ${existing.length}, 1.2, ${kind}, '', '')
          returning id, height_ratio, kind, title, description
        `) as { id: string; height_ratio: number; kind: string; title: string; description: string }[]
        const row = created[0]
        sendJson(res, 200, {
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
        sendJson(res, 503, { error: 'Falta correr db/009_section_blocks.sql' })
      }
      return
    }

    if (placeMatch && method === 'DELETE') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const url = new URL(req.url ?? '', 'http://local')
      const canvasId = url.searchParams.get('canvasId') || ''
      if (!/^[0-9a-f-]{36}$/i.test(canvasId)) {
        sendJson(res, 400, { error: 'Bloque inválido' })
        return
      }
      const db = sql()
      await db`
        delete from section_canvases
        where id = ${canvasId} and section_slug = ${placeMatch[1]}
      `
      const leftover = (await db`
        select id from section_canvases
        where section_slug = ${placeMatch[1]}
        order by sort_order
      `) as { id: string }[]
      for (let i = 0; i < leftover.length; i++) {
        await db`update section_canvases set sort_order = ${i} where id = ${leftover[i].id}`
      }
      sendJson(res, 200, { ok: true })
      return
    }

    if (placeMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{
        canvases?: {
          id: string
          kind?: string
          title?: string
          description?: string
          heightRatio?: number
          pieces?: { id: string; x: number; y: number; width: number }[]
        }[]
        pieces?: { id: string; x: number; y: number; width: number }[]
        heightRatio?: number
      }>(req)
      const db = sql()
      const canvases = Array.isArray(body.canvases) ? body.canvases : []
      for (const canvas of canvases) {
        if (!/^[0-9a-f-]{36}$/i.test(canvas.id)) continue
        const title = typeof canvas.title === 'string' ? canvas.title.slice(0, 200) : ''
        const description =
          typeof canvas.description === 'string' ? canvas.description.slice(0, 1200) : ''
        const ratio =
          typeof canvas.heightRatio === 'number' && Number.isFinite(canvas.heightRatio)
            ? Math.min(2.5, Math.max(0.6, canvas.heightRatio))
            : 1.2
        try {
          await db`
            update section_canvases
            set height_ratio = ${ratio}, title = ${title}, description = ${description}
            where id = ${canvas.id} and section_slug = ${placeMatch[1]}
          `
        } catch {
          try {
            await db`
              update section_canvases set height_ratio = ${ratio}
              where id = ${canvas.id} and section_slug = ${placeMatch[1]}
            `
          } catch {
            /* section_canvases still missing until db/004 */
          }
        }
        if (canvas.kind === 'text' || !Array.isArray(canvas.pieces)) continue
        for (const piece of canvas.pieces) {
          await db`
            update placements
            set x = ${piece.x},
                y = ${piece.y},
                width = ${piece.width}
            where id = ${piece.id} and section_slug = ${placeMatch[1]}
          `
        }
      }
      sendJson(res, 200, { ok: true, canvases })
      return
    }

    if (path === '/api/media' && method === 'POST') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const filename = String(req.headers['x-filename'] ?? `obra-${Date.now()}.jpg`)
      const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
      const section = String(req.headers['x-section'] ?? '')
      const body = await readBody(req)
      if (!body.length) {
        sendJson(res, 400, { error: 'Archivo vacío' })
        return
      }
      if (body.length > 12 * 1024 * 1024) {
        sendJson(res, 413, { error: 'La imagen es demasiado grande' })
        return
      }

      const id = randomUUID()
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-')
      const key = `works/${id}-${safeName}`
      let url = `/uploads/${key}`

      if (hasR2()) {
        const { uploadToR2 } = await import('./r2')
        url = await uploadToR2(key, body, mime)
      }

      const db = sql()
      await db`
        insert into media (id, r2_key, url, mime)
        values (${id}, ${hasR2() ? key : null}, ${url}, ${mime})
      `

      let placementId: string | null = null
      if (section) {
        const placed = (await db`
          insert into placements (section_slug, media_id, x, y, width, z_index)
          values (${section}, ${id}, 8, 8, 24, 0)
          returning id
        `) as { id: string }[]
        placementId = placed[0]?.id ?? null
      }

      sendJson(res, 200, {
        id,
        url,
        placementId,
        warning: hasR2() ? undefined : 'R2 no configurado: la URL no es pública hasta que subas a R2',
      })
      return
    }

    if (path === '/api/texts' && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 200, { texts: [] })
        return
      }
      const rows = await sql()`
        select id, title, description, created_at from texts order by created_at desc
      `
      sendJson(res, 200, { texts: rows })
      return
    }

    if (path === '/api/texts' && method === 'POST') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const payload = await readJson<{ title?: string; description?: string; body?: string }>(req)
      const title = (payload.title ?? '').trim()
      if (!title) {
        sendJson(res, 400, { error: 'El título es obligatorio' })
        return
      }
      const created = await sql()`
        insert into texts (title, description, body)
        values (${title}, ${payload.description ?? ''}, ${payload.body ?? ''})
        returning id, title, description, body, created_at
      `
      sendJson(res, 200, { text: created[0] })
      return
    }

    const textMatch = path.match(/^\/api\/texts\/([0-9a-f-]+)$/i)
    if (textMatch && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const rows = await sql()`
        select id, title, description, body, created_at from texts where id = ${textMatch[1]}
      `
      if (!rows[0]) {
        sendJson(res, 404, { error: 'No encontrado' })
        return
      }
      sendJson(res, 200, { text: rows[0] })
      return
    }

    if (textMatch && (method === 'PUT' || method === 'DELETE')) {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      if (method === 'DELETE') {
        await sql()`delete from texts where id = ${textMatch[1]}`
        sendJson(res, 200, { ok: true })
        return
      }
      const payload = await readJson<{ title?: string; description?: string; body?: string }>(req)
      const title = (payload.title ?? '').trim()
      if (!title) {
        sendJson(res, 400, { error: 'El título es obligatorio' })
        return
      }
      const updated = await sql()`
        update texts
        set title = ${title},
            description = ${payload.description ?? ''},
            body = ${payload.body ?? ''}
        where id = ${textMatch[1]}
        returning id, title, description, body, created_at
      `
      if (!updated[0]) {
        sendJson(res, 404, { error: 'No encontrado' })
        return
      }
      sendJson(res, 200, { text: updated[0] })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de servidor'
    sendJson(res, 500, { error: message })
  }
}
