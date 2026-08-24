import { SESSION_COOKIE } from '../../server/http'

export const runtime = 'nodejs'

const clearCookie = `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`

export function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearCookie,
    },
  })
}

export default function handler(
  _req: unknown,
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Set-Cookie', clearCookie)
  res.end(JSON.stringify({ ok: true }))
}
