import { SESSION_COOKIE, signSession } from '../../server/http'

export const runtime = 'nodejs'

function expectedPassword() {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'tarraf')
}

function cookieHeader(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string }
  const expected = expectedPassword()
  if (!expected || body.password !== expected) {
    return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookieHeader(signSession()),
    },
  })
}

export default async function handler(
  req: { on?: (event: string, cb: (chunk?: unknown) => void) => void; body?: unknown },
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (body: string) => void
  },
) {
  let body: { password?: string } = {}
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    body = req.body as { password?: string }
  } else {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on?.('data', (chunk) => chunks.push(Buffer.from(chunk as Buffer)))
      req.on?.('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on?.('error', reject)
    })
    body = raw ? (JSON.parse(raw) as { password?: string }) : {}
  }

  const expected = expectedPassword()
  if (!expected || body.password !== expected) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Contraseña incorrecta' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Set-Cookie', cookieHeader(signSession()))
  res.end(JSON.stringify({ ok: true }))
}
