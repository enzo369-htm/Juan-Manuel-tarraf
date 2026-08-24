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
      const rows = (await sql()`
        select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
        from hero_gates g
        left join media m on m.id = g.media_id
        order by g.section_slug
      `) as HeroRow[]
      sendJson(res, 200, toHeroLayout(rows))
      return
    }

    if (path === '/api/hero' && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{
        positions: Record<string, { x: number; y: number; width: number }>
      }>(req)
      const db = sql()
      for (const [slug, pos] of Object.entries(body.positions ?? {})) {
        await db`
          update hero_gates
          set x = ${Math.round(pos.x)},
              y = ${Math.round(pos.y)},
              width = ${Math.round(pos.width)},
              updated_at = now()
          where section_slug = ${slug}
        `
      }
      const rows = (await db`
        select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
        from hero_gates g
        left join media m on m.id = g.media_id
        order by g.section_slug
      `) as HeroRow[]
      sendJson(res, 200, toHeroLayout(rows))
      return
    }

    if (path === '/api/hero/reset' && method === 'POST') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const db = sql()
      await db`update hero_gates set x = 1605, y = 1110, width = 340, updated_at = now() where section_slug = 'trabajos'`
      await db`update hero_gates set x = 1935, y = 1020, width = 280, updated_at = now() where section_slug = 'bio'`
      await db`update hero_gates set x = 1320, y = 1560, width = 360, updated_at = now() where section_slug = 'textos'`
      await db`update hero_gates set x = 2385, y = 315, width = 300, updated_at = now() where section_slug = 'exposiciones'`
      await db`update hero_gates set x = 390, y = 2010, width = 270, updated_at = now() where section_slug = 'archivos'`
      await db`update hero_gates set x = 3210, y = 2145, width = 250, updated_at = now() where section_slug = 'contacto'`
      const rows = (await db`
        select g.section_slug as slug, g.x, g.y, g.width, m.url, g.updated_at
        from hero_gates g
        left join media m on m.id = g.media_id
      `) as HeroRow[]
      sendJson(res, 200, toHeroLayout(rows))
      return
    }

    const copyMatch = path.match(/^\/api\/copy\/([a-z]+)$/)
    if (copyMatch && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 200, { slug: copyMatch[1], body: '' })
        return
      }
      const rows = (await sql()`
        select section_slug as slug, body from section_copy where section_slug = ${copyMatch[1]}
      `) as { slug: string; body: string }[]
      sendJson(res, 200, rows[0] ?? { slug: copyMatch[1], body: '' })
      return
    }

    if (copyMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{ body?: string }>(req)
      const db = sql()
      await db`
        insert into section_copy (section_slug, body)
        values (${copyMatch[1]}, ${body.body ?? ''})
        on conflict (section_slug) do update set body = excluded.body
      `
      sendJson(res, 200, { slug: copyMatch[1], body: body.body ?? '' })
      return
    }

    const placeMatch = path.match(/^\/api\/placements\/([a-z]+)$/)
    if (placeMatch && method === 'GET') {
      if (!hasDatabase()) {
        sendJson(res, 200, { canvases: [{ id: 'legacy', heightRatio: 1.2, pieces: [] }], pieces: [], heightRatio: 1.2 })
        return
      }
      const db = sql()
      let canvasRows: { id: string; height_ratio: number }[] = []
      try {
        canvasRows = (await db`
          select id, height_ratio from section_canvases
          where section_slug = ${placeMatch[1]}
          order by sort_order
        `) as { id: string; height_ratio: number }[]
      } catch {
        canvasRows = []
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
      const canvases = canvasRows.length
        ? canvasRows.map((canvas, index) => ({
            id: canvas.id,
            heightRatio: canvas.height_ratio ?? 1.2,
            pieces: rows.filter((row) => row.canvas_id === canvas.id || (index === 0 && !row.canvas_id)).map(toPiece),
          }))
        : [{ id: 'legacy', heightRatio: 1.2, pieces: rows.map(toPiece) }]
      sendJson(res, 200, {
        canvases,
        pieces: canvases[0]?.pieces ?? [],
        heightRatio: canvases[0]?.heightRatio ?? 1.2,
      })
      return
    }

    if (placeMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return
      if (!hasDatabase()) {
        sendJson(res, 503, { error: 'DATABASE_URL no configurada' })
        return
      }
      const body = await readJson<{
        canvases?: { id: string; heightRatio?: number; pieces?: { id: string; x: number; y: number; width: number }[] }[]
        pieces?: { id: string; x: number; y: number; width: number }[]
        heightRatio?: number
      }>(req)
      const db = sql()
      const canvases = body.canvases?.length
        ? body.canvases
        : [{ id: 'legacy', heightRatio: body.heightRatio, pieces: body.pieces }]
      for (const canvas of canvases) {
        if (typeof canvas.heightRatio === 'number' && /^[0-9a-f-]{36}$/i.test(canvas.id)) {
          const ratio = Math.min(2.5, Math.max(0.6, canvas.heightRatio))
          try {
            await db`
              update section_canvases set height_ratio = ${ratio}
              where id = ${canvas.id} and section_slug = ${placeMatch[1]}
            `
          } catch {
            /* section_canvases still missing until db/004 */
          }
        }
        if (!Array.isArray(canvas.pieces)) continue
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
