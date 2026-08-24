import { defaultLayout } from './defaults'
import type { HeroLayout } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
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
  try {
    return await request<HeroLayout>('/api/hero')
  } catch {
    return defaultLayout()
  }
}

export async function apiSaveHero(layout: HeroLayout): Promise<HeroLayout> {
  return request<HeroLayout>('/api/hero', {
    method: 'PUT',
    body: JSON.stringify({ positions: layout.positions }),
  })
}

export async function apiResetHero(): Promise<HeroLayout> {
  return request<HeroLayout>('/api/hero/reset', { method: 'POST' })
}

export async function apiGetCopy(slug: string) {
  return request<{ slug: string; body: string }>(`/api/copy/${slug}`)
}

export async function apiSaveCopy(slug: string, body: string) {
  return request<{ slug: string; body: string }>(`/api/copy/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({ body }),
  })
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
  heightRatio: number
  pieces: CanvasPiece[]
}

export async function apiGetPlacements(slug: string) {
  const data = await request<{
    canvases?: SectionCanvas[]
    pieces?: CanvasPiece[]
    heightRatio?: number
  }>(`/api/placements/${slug}`)
  const canvases =
    data.canvases && data.canvases.length > 0
      ? data.canvases
      : [{ id: 'legacy', heightRatio: data.heightRatio ?? 1.2, pieces: data.pieces ?? [] }]
  return { canvases }
}

export async function apiSavePlacements(slug: string, canvases: SectionCanvas[]) {
  return request<{ ok: boolean; canvases?: SectionCanvas[] }>(`/api/placements/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({ canvases }),
  })
}

export async function apiAddCanvas(slug: string) {
  return request<{ canvas: SectionCanvas }>(`/api/placements/${slug}`, { method: 'POST' })
}

export async function apiDeleteCanvas(slug: string, canvasId: string) {
  return request<{ ok: boolean }>(`/api/placements/${slug}?canvasId=${canvasId}`, {
    method: 'DELETE',
  })
}

export async function apiUploadMedia(file: File, section?: string, canvasId?: string) {
  const { downscaleImage } = await import('./downscaleImage')
  const payload = await downscaleImage(file)
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
  let data: {
    id?: string
    url?: string
    placementId?: string
    error?: string
    warning?: string
  } = {}
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {}
  } catch {
    throw new Error(raw.slice(0, 180) || `Error ${res.status}`)
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}
