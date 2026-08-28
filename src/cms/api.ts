import type { HeroLayout } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const raw = await res.text()
  let data: T & { error?: string } = {} as T & { error?: string }
  try {
    data = raw ? (JSON.parse(raw) as T & { error?: string }) : data
  } catch {
    throw new Error(raw.slice(0, 180) || `Error ${res.status}`)
  }
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
  return data
}

export async function apiMe() {
  return request<{ ok: boolean }>('/api/auth/me')
}

export async function apiLogin(password: string) {
  return request<{ ok: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function apiLogout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export async function apiGetHero(): Promise<HeroLayout> {
  return request<HeroLayout>('/api/hero')
}

export async function apiSaveHero(layout: HeroLayout): Promise<HeroLayout> {
  return request<HeroLayout>('/api/hero', {
    method: 'PUT',
    body: JSON.stringify({
      positions: layout.positions,
      backgroundMediaId: layout.backgroundMediaId,
    }),
  })
}

export async function apiResetHero(): Promise<HeroLayout> {
  return request<HeroLayout>('/api/hero/reset', { method: 'POST' })
}

export async function apiGetCopy(slug: string) {
  return request<{ slug: string; body: string; portraitUrl?: string }>(`/api/copy/${slug}`)
}

export async function apiSaveCopy(slug: string, body: string, portraitUrl?: string) {
  return request<{ slug: string; body: string; portraitUrl?: string }>(`/api/copy/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({
      body,
      ...(portraitUrl !== undefined ? { portraitUrl } : {}),
    }),
  })
}

export type TextEntry = {
  id: string
  title: string
  description: string
  body?: string
  created_at: string
}

export async function apiListTexts() {
  return request<{ texts: TextEntry[] }>('/api/texts')
}

export async function apiGetText(id: string) {
  return request<{ text: TextEntry }>(`/api/texts/${id}`)
}

export async function apiCreateText(payload: { title: string; description: string; body: string }) {
  return request<{ text: TextEntry }>('/api/texts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function apiSaveText(
  id: string,
  payload: { title: string; description: string; body: string },
) {
  return request<{ text: TextEntry }>(`/api/texts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function apiDeleteText(id: string) {
  return request<{ ok: boolean }>(`/api/texts/${id}`, { method: 'DELETE' })
}

export type CanvasPiece = {
  id: string
  src: string
  x: number
  y: number
  width: number
  z?: number
  mediaId?: string
}

export type SectionCanvas = {
  id: string
  kind?: 'text' | 'canvas'
  title?: string
  description?: string
  heightRatio: number
  pieces: CanvasPiece[]
}

export async function apiGetPlacements(slug: string) {
  const data = await request<{
    canvases?: SectionCanvas[]
    pieces?: CanvasPiece[]
    heightRatio?: number
  }>(`/api/placements/${slug}`)
  return { canvases: data.canvases ?? [] }
}

export async function apiSavePlacements(slug: string, canvases: SectionCanvas[]) {
  return request<{ ok: boolean; canvases?: SectionCanvas[] }>(`/api/placements/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({ canvases }),
  })
}

export async function apiAddCanvas(slug: string, kind: 'text' | 'canvas' = 'canvas') {
  return request<{ canvas: SectionCanvas }>(`/api/placements/${slug}`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  })
}

export async function apiDeleteCanvas(slug: string, canvasId: string) {
  return request<{ ok: boolean }>(`/api/placements/${slug}?canvasId=${canvasId}`, {
    method: 'DELETE',
  })
}

type UploadedMedia = {
  id?: string
  url?: string
  placementId?: string
  error?: string
  warning?: string
}

async function postMediaFile(payload: File, section?: string, canvasId?: string) {
  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': payload.type || 'application/octet-stream',
      'x-filename': payload.name,
      ...(section ? { 'x-section': section } : {}),
      ...(canvasId ? { 'x-canvas-id': canvasId } : {}),
    },
    body: payload,
  })
  const raw = await res.text()
  let data: UploadedMedia = {}
  try {
    data = raw ? (JSON.parse(raw) as UploadedMedia) : {}
  } catch {
    throw new Error(raw.slice(0, 180) || `Error ${res.status}`)
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export async function apiUploadMedia(
  file: File,
  section?: string,
  canvasId?: string,
  opts?: { maxDim?: number; quality?: number },
) {
  const { downscaleImage } = await import('./downscaleImage')
  const payload = await downscaleImage(file, opts?.maxDim ?? 2400, opts?.quality ?? 0.82)
  return postMediaFile(payload, section, canvasId)
}

/** Hero gates and background: no x-section (must not create a series placement). */
export async function apiUploadHeroMedia(file: File) {
  const { prepareHeroImage, HERO_UPLOAD_MAX_BYTES } = await import('./downscaleImage')
  const payload = await prepareHeroImage(file)
  if (payload.size > HERO_UPLOAD_MAX_BYTES) {
    throw new Error('La imagen es demasiado pesada. Probá un JPEG más liviano (máx. ~4 MB).')
  }
  return postMediaFile(payload)
}
