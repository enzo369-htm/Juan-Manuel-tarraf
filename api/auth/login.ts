const COOKIE = 'jt_admin'
const loginAttempts = new Map<string, { count: number; started: number }>()

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

function tooManyAttempts(ip: string) {
  const now = Date.now()
  const row = loginAttempts.get(ip)
  if (!row || now - row.started > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, started: now })
    return false
  }
  row.count += 1
  return row.count > 12
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

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
    if (tooManyAttempts(clientIp(request))) {
      return Response.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 })
    }
    const body = (await request.json().catch(() => ({}))) as { password?: string }
    const expected =
      process.env.ADMIN_PASSWORD || (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production' ? '' : 'tarraf')
    if (!expected || body.password !== expected) {
      return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }
    const secret =
      process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-only-secret'
    const payload = String(Date.now() + 1000 * 60 * 60 * 24 * 7)
    const token = `${payload}.${await hmacHex(secret, payload)}`
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`,
      },
    })
  },
}
