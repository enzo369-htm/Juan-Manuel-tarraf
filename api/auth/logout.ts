import { clearCookie } from '../session'

export default {
  async fetch() {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': clearCookie(),
      },
    })
  },
}
