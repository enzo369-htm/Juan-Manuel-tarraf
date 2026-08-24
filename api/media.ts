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

function sniffImage(body: Uint8Array) {
  if (body.length < 12) return null
  if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg'
  if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return 'image/png'
  if (body[0] === 0x47 && body[1] === 0x49 && body[2] === 0x46) return 'image/gif'
  if (
    body[0] === 0x52 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x46 &&
    body[8] === 0x57 &&
    body[9] === 0x45 &&
    body[10] === 0x42 &&
    body[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
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
      const section = request.headers.get('x-section') || ''
      const allowedSections = new Set(['trabajos', 'exposiciones', 'archivos'])
      if (section && !allowedSections.has(section)) {
        return Response.json({ error: 'Sección inválida' }, { status: 400 })
      }
      const body = new Uint8Array(await request.arrayBuffer())
      if (!body.length) {
        return Response.json({ error: 'Archivo vacío' }, { status: 400 })
      }
      if (body.length > 12 * 1024 * 1024) {
        return Response.json({ error: 'La imagen es demasiado grande' }, { status: 413 })
      }
      const mime = sniffImage(body)
      if (!mime) {
        return Response.json({ error: 'Solo se aceptan JPEG, PNG, WebP o GIF' }, { status: 400 })
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

      const canvasId = request.headers.get('x-canvas-id') || ''
      let placementId: string | null = null
      if (section) {
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(canvasId)
        try {
          const placed = uuid
            ? ((await sql`
                insert into placements (section_slug, media_id, canvas_id, x, y, width, z_index)
                values (${section}, ${id}, ${canvasId}, 8, 8, 24, 0)
                returning id
              `) as { id: string }[])
            : ((await sql`
                insert into placements (section_slug, media_id, x, y, width, z_index)
                values (${section}, ${id}, 8, 8, 24, 0)
                returning id
              `) as { id: string }[])
          placementId = placed[0]?.id ?? null
        } catch {
          const placed = (await sql`
            insert into placements (section_slug, media_id, x, y, width, z_index)
            values (${section}, ${id}, 8, 8, 24, 0)
            returning id
          `) as { id: string }[]
          placementId = placed[0]?.id ?? null
        }
      }

      const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '')
      return Response.json({
        id,
        url,
        placementId,
        warning: !hasR2()
          ? 'R2 no configurado'
          : publicBase
            ? undefined
            : 'Falta R2_PUBLIC_BASE_URL: se subió el archivo pero la URL no es pública',
      })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Error de servidor' }, { status: 500 })
    }
  },
}
