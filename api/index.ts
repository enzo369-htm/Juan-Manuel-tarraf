import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleApi } from '../server/handlers'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const raw = req.query.path
    const fromQuery = Array.isArray(raw)
      ? raw.filter(Boolean).join('/')
      : (raw ?? '')
    const incoming = (req.url ?? '').split('?')[0] ?? ''
    const suffix = fromQuery || incoming.replace(/^\/api\/?/, '')
    req.url = suffix ? `/api/${suffix}` : '/api'
    await handleApi(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de servidor'
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}
