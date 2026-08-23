import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleApi } from '../server/handlers'

export const config = { api: { bodyParser: false } }

export default function handler(req: VercelRequest, res: VercelResponse) {
  void handleApi(req, res)
}
