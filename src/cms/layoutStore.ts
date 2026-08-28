import { sections, type SectionId } from '../data/sections'
import { clampPiece, defaultLayout } from './defaults'
import type { HeroLayout, LayoutRepository } from './types'

export const LAYOUT_STORAGE_KEY = 'jt.hero-layout.v2'
export const LAYOUT_EVENT = 'jt:hero-layout'

function isSectionId(id: string): id is SectionId {
  return sections.some((s) => s.id === id)
}

function parseLayout(raw: string | null): HeroLayout | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<HeroLayout>
    if (data.version !== 1 || !data.positions || typeof data.positions !== 'object') {
      return null
    }

    const fallback = defaultLayout()
    const positions = { ...fallback.positions }

    for (const [id, pos] of Object.entries(data.positions)) {
      if (!isSectionId(id) || !pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
        continue
      }
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue
      const section = sections.find((s) => s.id === id)!
      const width =
        typeof pos.width === 'number' && Number.isFinite(pos.width) ? pos.width : section.width
      positions[id] = {
        ...clampPiece(id, pos.x, pos.y, width),
        ...(typeof pos.src === 'string' && pos.src ? { src: pos.src } : {}),
        ...(typeof pos.mediaId === 'string' && pos.mediaId ? { mediaId: pos.mediaId } : {}),
      }
    }

    return {
      version: 1,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : fallback.updatedAt,
      positions,
      backgroundUrl:
        typeof data.backgroundUrl === 'string' && data.backgroundUrl
          ? data.backgroundUrl
          : fallback.backgroundUrl,
      backgroundMediaId:
        typeof data.backgroundMediaId === 'string' ? data.backgroundMediaId : fallback.backgroundMediaId,
    }
  } catch {
    return null
  }
}

export function readCachedLayout(): HeroLayout | null {
  try {
    return parseLayout(localStorage.getItem(LAYOUT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeCachedLayout(layout: HeroLayout) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Local persistence. Swap this module's export for a Neon repository later
 * without touching the admin UI.
 */
export const layoutRepository: LayoutRepository = {
  async load() {
    return readCachedLayout() ?? defaultLayout()
  },

  async save(layout) {
    const next: HeroLayout = {
      version: 1,
      updatedAt: new Date().toISOString(),
      positions: layout.positions,
      backgroundUrl: layout.backgroundUrl,
      backgroundMediaId: layout.backgroundMediaId,
    }
    writeCachedLayout(next)
    return next
  },
}

export async function resetLayout() {
  localStorage.removeItem(LAYOUT_STORAGE_KEY)
  window.dispatchEvent(new Event(LAYOUT_EVENT))
  return defaultLayout()
}
