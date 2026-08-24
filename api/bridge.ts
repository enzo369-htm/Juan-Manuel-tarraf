import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi } from '../server/handlers'

type NodeReq = IncomingMessage & { body?: unknown }

export async function handleWeb(request: Request) {
  const url = new URL(request.url)
  const raw = Buffer.from(await request.arrayBuffer())
  const headerMap: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headerMap[key] = value
  })

  return new Promise<Response>((resolve) => {
    const resHeaders: Record<string, string> = {}
    const req = {
      method: request.method,
      url: `${url.pathname}${url.search}`,
      headers: headerMap,
      body: raw.length ? raw : undefined,
      on(event: string, cb: (chunk?: Buffer) => void) {
        if (event === 'data' && raw.length) queueMicrotask(() => cb(raw))
        if (event === 'end') queueMicrotask(() => cb())
        return req
      },
    } as unknown as NodeReq

    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name: string, value: string) {
        resHeaders[name.toLowerCase()] = value
      },
      end(payload?: string) {
        res.headersSent = true
        resolve(
          new Response(payload ?? '', {
            status: res.statusCode,
            headers: resHeaders,
          }),
        )
      },
    }

    void handleApi(req, res as unknown as ServerResponse)
  })
}
