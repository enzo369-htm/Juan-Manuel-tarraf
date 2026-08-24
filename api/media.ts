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

function hasR2() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  )
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

      const filename = request.headers.get('x-filename') || `obra-${Date.now()}.jpg`
      const mime = request.headers.get('content-type') || 'application/octet-stream'
      const section = request.headers.get('x-section') || ''
      const body = new Uint8Array(await request.arrayBuffer())
      if (!body.length) {
        return Response.json({ error: 'Archivo vacío' }, { status: 400 })
      }

      const id = crypto.randomUUID()
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-')
      const key = `works/${id}-${safeName}`
      let url = `/uploads/${key}`

      if (hasR2()) {
        const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
        const accountId = process.env.R2_ACCOUNT_ID as string
        const client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
          },
        })
        await client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: mime,
          }),
        )
        const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '')
        url = base
          ? `${base}/${key}`
          : `https://${process.env.R2_BUCKET}.${accountId}.r2.cloudflarestorage.com/${key}`
      }

      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(dbUrl)
      await sql`
        insert into media (id, r2_key, url, mime)
        values (${id}, ${hasR2() ? key : null}, ${url}, ${mime})
      `

      let placementId: string | null = null
      if (section) {
        const placed = (await sql`
          insert into placements (section_slug, media_id, x, y, width, z_index)
          values (${section}, ${id}, 8, 8, 24, 0)
          returning id
        `) as { id: string }[]
        placementId = placed[0]?.id ?? null
      }

      return Response.json({
        id,
        url,
        placementId,
        warning: hasR2() ? undefined : 'R2 no configurado',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de servidor'
      return Response.json({ error: message }, { status: 500 })
    }
  },
}
