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
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
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
}

export async function apiGetPlacements(slug: string) {
  return request<{ pieces: CanvasPiece[] }>(`/api/placements/${slug}`)
}

export async function apiSavePlacements(slug: string, pieces: CanvasPiece[]) {
  return request<{ ok: boolean }>(`/api/placements/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({ pieces }),
  })
}

export async function apiUploadMedia(file: File, section?: string) {
  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-filename': file.name,
      ...(section ? { 'x-section': section } : {}),
    },
    body: file,
  })
  const data = (await res.json()) as {
    id?: string
    url?: string
    placementId?: string
    error?: string
    warning?: string
  }
  if (!res.ok) throw new Error(data.error || 'No se pudo subir')
  return data
}
