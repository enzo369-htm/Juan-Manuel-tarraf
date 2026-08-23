import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'jt_admin'

export type ApiRequest = IncomingMessage & { url?: string }
export type ApiResponse = ServerResponse

export function sendJson(res: ApiResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parsedBody(req: ApiRequest) {
  return (req as ApiRequest & { body?: unknown }).body
}

export async function readJson<T>(req: ApiRequest): Promise<T> {
  const existing = parsedBody(req)
  if (existing != null && existing !== '') {
    if (typeof existing === 'string') {
      return (existing ? JSON.parse(existing) : {}) as T
    }
    if (Buffer.isBuffer(existing)) {
      const raw = existing.toString('utf8')
      return (raw ? JSON.parse(raw) : {}) as T
    }
    if (typeof existing === 'object') return existing as T
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({} as T)
        return
      }
      try {
        resolve(JSON.parse(raw) as T)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export async function readBody(req: ApiRequest): Promise<Buffer> {
  const existing = parsedBody(req)
  if (Buffer.isBuffer(existing)) return existing
  if (typeof existing === 'string') return Buffer.from(existing)

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function parseCookies(req: ApiRequest) {
  const header = req.headers.cookie ?? ''
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    out[name] = decodeURIComponent(rest.join('='))
  }
  return out
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-only-secret'
}

export function signSession() {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7
  const payload = String(exp)
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function sessionValid(token: string | undefined) {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  return Number(payload) > Date.now()
}

export function isAuthed(req: ApiRequest) {
  return sessionValid(parseCookies(req)[SESSION_COOKIE])
}

export function requireAuth(req: ApiRequest, res: ApiResponse) {
  if (isAuthed(req)) return true
  sendJson(res, 401, { error: 'No autorizado' })
  return false
}

export function setSessionCookie(res: ApiResponse, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`,
  )
}

export function clearSessionCookie(res: ApiResponse) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`)
}

export function pathOf(req: ApiRequest) {
  return (req.url ?? '').split('?')[0] ?? ''
}
