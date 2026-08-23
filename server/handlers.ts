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
import { uploadToR2 } from './r2'

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
      await db`update hero_gates set x = 2140, y = 1480, width = 340, updated_at = now() where section_slug = 'trabajos'`
      await db`update hero_gates set x = 2580, y = 1360, width = 280, updated_at = now() where section_slug = 'bio'`
      await db`update hero_gates set x = 1760, y = 2080, width = 360, updated_at = now() where section_slug = 'textos'`
      await db`update hero_gates set x = 3180, y = 420, width = 300, updated_at = now() where section_slug = 'exposiciones'`
      await db`update hero_gates set x = 520, y = 2680, width = 270, updated_at = now() where section_slug = 'archivos'`
      await db`update hero_gates set x = 4280, y = 2860, width = 250, updated_at = now() where section_slug = 'contacto'`
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
        sendJson(res, 200, { pieces: [] })
        return
      }
      const rows = (await sql()`
        select p.id, p.x, p.y, p.width, p.z_index, m.url
        from placements p
        join media m on m.id = p.media_id
        where p.section_slug = ${placeMatch[1]}
        order by p.z_index, p.created_at
      `) as { id: string; x: number; y: number; width: number; z_index: number; url: string }[]
      sendJson(res, 200, {
        pieces: rows.map((row) => ({
          id: row.id,
          src: row.url,
          x: row.x,
          y: row.y,
          width: row.width,
          z: row.z_index,
        })),
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
        pieces: { id: string; x: number; y: number; width: number }[]
      }>(req)
      const db = sql()
      for (const piece of body.pieces ?? []) {
        await db`
          update placements
          set x = ${Math.round(piece.x)},
              y = ${Math.round(piece.y)},
              width = ${Math.round(piece.width)}
          where id = ${piece.id} and section_slug = ${placeMatch[1]}
        `
      }
      sendJson(res, 200, { ok: true })
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
          values (${section}, ${id}, 80, 80, 280, 0)
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

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de servidor'
    sendJson(res, 500, { error: message })
  }
}
