const COOKIE = 'jt_admin'

export default {
  fetch() {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`,
      },
    })
  },
}
