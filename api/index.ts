export const runtime = 'nodejs'

export function GET() {
  return Response.json({ ok: true, service: 'juan-tarraf-api' })
}

export default function handler(
  _req: unknown,
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true, service: 'juan-tarraf-api' }))
}
