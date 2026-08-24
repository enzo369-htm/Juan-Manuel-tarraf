export default {
  fetch() {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'jt_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      },
    })
  },
}
