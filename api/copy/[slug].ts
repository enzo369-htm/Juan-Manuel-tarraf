const COOKIE = 'jt_admin'
const COPY_SLUGS = new Set(['bio', 'textos', 'contacto'])

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

export default {
  async fetch(request: Request) {
    try {
      const slug = slugOf(request)
      if (!slug || !COPY_SLUGS.has(slug)) {
        return Response.json({ error: 'Sección inválida' }, { status: 400 })
      }

      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        if (request.method === 'GET') return Response.json({ slug, body: '', portraitUrl: '' })
        return Response.json({ error: 'DATABASE_URL no configurada' }, { status: 503 })
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)

      const toCopy = (row?: { slug: string; body: string; portrait_url?: string | null }) => ({
        slug: row?.slug ?? slug,
        body: row?.body ?? '',
        portraitUrl: row?.portrait_url ?? '',
      })

      if (request.method === 'GET') {
        try {
          const rows = (await sql`
            select section_slug as slug, body, portrait_url
            from section_copy
            where section_slug = ${slug}
          `) as { slug: string; body: string; portrait_url: string | null }[]
          return Response.json(toCopy(rows[0]))
        } catch {
          const rows = (await sql`
            select section_slug as slug, body from section_copy where section_slug = ${slug}
          `) as { slug: string; body: string }[]
          return Response.json({ slug, body: rows[0]?.body ?? '', portraitUrl: '' })
        }
      }

      if (request.method === 'PUT') {
        if (!(await isAuthed(request))) {
          return Response.json({ error: 'No autorizado' }, { status: 401 })
        }
        const payload = (await request.json().catch(() => ({}))) as {
          body?: string
          portraitUrl?: string
        }
        const text = typeof payload.body === 'string' ? payload.body : ''
        const portraitUrl =
          slug === 'bio' && typeof payload.portraitUrl === 'string' ? payload.portraitUrl : null

        if (portraitUrl !== null) {
          try {
            await sql`
              insert into section_copy (section_slug, body, portrait_url)
              values (${slug}, ${text}, ${portraitUrl})
              on conflict (section_slug) do update
              set body = excluded.body, portrait_url = excluded.portrait_url
            `
            return Response.json({ slug, body: text, portraitUrl })
          } catch {
            return Response.json(
              { error: 'Falta correr db/008_bio_portrait.sql en Neon' },
              { status: 503 },
            )
          }
        }

        await sql`
          insert into section_copy (section_slug, body)
          values (${slug}, ${text})
          on conflict (section_slug) do update set body = excluded.body
        `
        try {
          const rows = (await sql`
            select section_slug as slug, body, portrait_url
            from section_copy
            where section_slug = ${slug}
          `) as { slug: string; body: string; portrait_url: string | null }[]
          return Response.json(toCopy(rows[0] ?? { slug, body: text, portrait_url: '' }))
        } catch {
          return Response.json({ slug, body: text, portraitUrl: '' })
        }
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
