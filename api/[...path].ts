import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleApi } from '../server/handlers'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const parts = req.query.path
  const suffix = Array.isArray(parts) ? parts.join('/') : (parts ?? '')
  req.url = `/api/${suffix}`
  void handleApi(req, res)
}
