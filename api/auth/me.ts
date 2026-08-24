import { SESSION_COOKIE, parseCookieString, sessionValid } from '../../server/http'

export const runtime = 'nodejs'

function okFromCookie(header: string) {
  return sessionValid(parseCookieString(header)[SESSION_COOKIE])
}

export function GET(request: Request) {
  return Response.json({ ok: okFromCookie(request.headers.get('cookie') ?? '') })
}

export default function handler(
  req: { headers?: { cookie?: string } },
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: okFromCookie(req.headers?.cookie ?? '') }))
}
