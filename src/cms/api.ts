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

export type Exhibition = {
  id: string
  title: string
  description: string
  sortOrder: number
  createdAt: string
  coverMediaId?: string
  coverUrl?: string
}

export async function apiListExhibitions() {
  return request<{ exhibitions: Exhibition[] }>('/api/exhibitions')
}

export async function apiGetExhibition(id: string) {
  return request<{ exhibition: Exhibition }>(`/api/exhibitions/${id}`)
}

export async function apiCreateExhibition(payload: {
  title: string
  description?: string
  coverMediaId?: string
}) {
  return request<{ exhibition: Exhibition }>('/api/exhibitions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function apiSaveExhibition(
  id: string,
  payload: { title: string; description?: string; coverMediaId?: string },
) {
  return request<{ exhibition: Exhibition }>(`/api/exhibitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function apiDeleteExhibition(id: string) {
  return request<{ ok: boolean }>(`/api/exhibitions/${id}`, { method: 'DELETE' })
}

function placementsPath(slug: string, exhibitionId?: string, extra?: string) {
  const params = new URLSearchParams()
  if (exhibitionId) params.set('exhibitionId', exhibitionId)
  if (extra) {
    const more = new URLSearchParams(extra)
    more.forEach((value, key) => params.set(key, value))
  }
  const query = params.toString()
  return `/api/placements/${slug}${query ? `?${query}` : ''}`
}

export async function apiGetPlacements(slug: string, exhibitionId?: string) {
  const data = await request<{
    canvases?: SectionCanvas[]
    pieces?: CanvasPiece[]
    heightRatio?: number
  }>(placementsPath(slug, exhibitionId))
  return { canvases: data.canvases ?? [] }
}

export async function apiSavePlacements(
  slug: string,
  canvases: SectionCanvas[],
  exhibitionId?: string,
) {
  return request<{ ok: boolean; canvases?: SectionCanvas[] }>(placementsPath(slug, exhibitionId), {
    method: 'PUT',
    body: JSON.stringify({ canvases, exhibitionId }),
  })
}

export async function apiAddCanvas(
  slug: string,
  kind: 'text' | 'canvas' = 'canvas',
  exhibitionId?: string,
) {
  return request<{ canvas: SectionCanvas }>(placementsPath(slug, exhibitionId), {
    method: 'POST',
    body: JSON.stringify({ kind, exhibitionId }),
  })
}

export async function apiDeleteCanvas(slug: string, canvasId: string, exhibitionId?: string) {
  return request<{ ok: boolean }>(
    placementsPath(slug, exhibitionId, `canvasId=${canvasId}`),
    { method: 'DELETE' },
  )
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
