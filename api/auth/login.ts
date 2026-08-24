import { expectedPassword, sessionCookie } from '../session'

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
    const body = (await request.json().catch(() => ({}))) as { password?: string }
    const expected = expectedPassword()
    if (!expected || body.password !== expected) {
      return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': await sessionCookie(),
      },
    })
  },
}
