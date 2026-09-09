import { ensureI18nColumns } from '../../server/i18n-schema'

const COOKIE = 'jt_admin'
const COPY_SLUGS = new Set(['bio', 'textos', 'contacto'])

type CopyRow = {
  slug: string
  body: string
  body_en?: string | null
  portrait_url?: string | null
  instagram_handle?: string | null
  instagram_url?: string | null
  email?: string | null
  portrait_scale?: number | null
}

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
  return url.pathname.match(/\/api\/copy\/([a-z]+)/)?.[1] || url.searchParams.get('slug') || ''
}

function toCopy(slug: string, row?: CopyRow) {
  return {
    slug: row?.slug ?? slug,
    body: row?.body ?? '',
    bodyEn: row?.body_en ?? '',
    portraitUrl: row?.portrait_url ?? '',
    instagramHandle: row?.instagram_handle ?? '',
    instagramUrl: row?.instagram_url ?? '',
    email: row?.email ?? '',
    portraitScale: clampPortraitScale(row?.portrait_scale),
  }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function clampPortraitScale(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(140, Math.max(60, Math.round(n)))
}

export default {
  async fetch(request: Request) {
    try {
      const slug = slugOf(request)
      if (!slug || !COPY_SLUGS.has(slug)) {
        return Response.json({ error: 'Sección inválida' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') return Response.json(toCopy(slug))
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)
      await ensureI18nColumns(sql)

      const ensureContactColumns = async () => {
        await sql`alter table section_copy add column if not exists instagram_handle text not null default ''`
        await sql`alter table section_copy add column if not exists instagram_url text not null default ''`
        await sql`alter table section_copy add column if not exists email text not null default ''`
      }

      const ensurePortraitScale = async () => {
        await sql`alter table section_copy add column if not exists portrait_scale int not null default 100`
      }

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select section_slug as slug, body, body_en, portrait_url, instagram_handle, instagram_url, email, portrait_scale
            from section_copy
            where section_slug = ${slug}
          `) as CopyRow[]
          return Response.json(toCopy(slug, rows[0]))
        } catch {
          try {
            await ensureContactColumns()
            await ensurePortraitScale()
            const rows = (await sql`
              select section_slug as slug, body, body_en, portrait_url, instagram_handle, instagram_url, email, portrait_scale
              from section_copy
              where section_slug = ${slug}
            `) as CopyRow[]
            return Response.json(toCopy(slug, rows[0]))
          } catch {
            try {
              const rows = (await sql`
                select section_slug as slug, body, portrait_url
                from section_copy
                where section_slug = ${slug}
              `) as CopyRow[]
              return Response.json(toCopy(slug, rows[0]))
            } catch {
              const rows = (await sql`
                select section_slug as slug, body from section_copy where section_slug = ${slug}
              `) as CopyRow[]
              return Response.json(toCopy(slug, rows[0]))
            }
          }
        }
      }

      if (request.method === 'PUT') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const payload = (await request.json().catch(() => ({}))) as {
          body?: string
          bodyEn?: string
          portraitUrl?: string
          portraitScale?: number
          instagramHandle?: string
          instagramUrl?: string
          email?: string
        }

        if (slug === 'contacto') {
          const instagramHandle = asText(payload.instagramHandle)
          const instagramUrl = asText(payload.instagramUrl)
          const email = asText(payload.email)
          const saveContact = async () => {
            await sql`
              insert into section_copy (section_slug, body, instagram_handle, instagram_url, email)
              values (${slug}, '', ${instagramHandle}, ${instagramUrl}, ${email})
              on conflict (section_slug) do update
              set instagram_handle = excluded.instagram_handle,
                  instagram_url = excluded.instagram_url,
                  email = excluded.email
            `
          }
          try {
            await saveContact()
          } catch {
            try {
              await ensureContactColumns()
              await saveContact()
            } catch {
              return Response.json(
                { error: 'Falta correr db/013_contact.sql en Neon' },
                { status: 503 },
              )
            }
          }
          return Response.json(toCopy(slug, {
            slug,
            body: '',
            instagram_handle: instagramHandle,
            instagram_url: instagramUrl,
            email,
          }))
        }

        const text = typeof payload.body === 'string' ? payload.body : ''
        const textEn = typeof payload.bodyEn === 'string' ? payload.bodyEn : ''
        const portraitUrl =
          slug === 'bio' && typeof payload.portraitUrl === 'string' ? payload.portraitUrl : null

        if (portraitUrl !== null) {
          const portraitScale = clampPortraitScale(payload.portraitScale)
          const saveBio = async () => {
            await sql`
            insert into section_copy (section_slug, body, body_en, portrait_url, portrait_scale)
            values (${slug}, ${text}, ${textEn}, ${portraitUrl}, ${portraitScale})
            on conflict (section_slug) do update
            set body = excluded.body,
                body_en = excluded.body_en,
                portrait_url = excluded.portrait_url,
                portrait_scale = excluded.portrait_scale
            `
          }
          try {
            await saveBio()
          } catch {
            try {
              await ensurePortraitScale()
              await saveBio()
            } catch {
              return Response.json(
                { error: 'Falta correr db/008_bio_portrait.sql en Neon' },
                { status: 503 },
              )
            }
          }
          return Response.json(
            toCopy(slug, {
              slug,
              body: text,
              body_en: textEn,
              portrait_url: portraitUrl,
              portrait_scale: portraitScale,
            }),
          )
        }

        await sql`
          insert into section_copy (section_slug, body, body_en)
          values (${slug}, ${text}, ${textEn})
          on conflict (section_slug) do update set body = excluded.body, body_en = excluded.body_en
        `
        try {
          const rows = (await sql`
            select section_slug as slug, body, portrait_url, instagram_handle, instagram_url, email
            from section_copy
            where section_slug = ${slug}
          `) as CopyRow[]
          return Response.json(toCopy(slug, rows[0] ?? { slug, body: text }))
        } catch {
          return Response.json(toCopy(slug, { slug, body: text }))
        }
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
