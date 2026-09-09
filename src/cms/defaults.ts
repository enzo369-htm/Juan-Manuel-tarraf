import { HERO_BG_FALLBACK, sections, WORLD, type SectionId } from '../data/sections'
import type { HeroLayout, PiecePosition } from './types'

export const MIN_PIECE_WIDTH = 120
export const MAX_PIECE_WIDTH = 820
/** 0 = blanco, 255 = negro. 233 ≈ el negro actual del sitio. */
export const DEFAULT_LABEL_INK = 233

export function clampLabelInk(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LABEL_INK
  return Math.round(Math.min(255, Math.max(0, value)))
}

export function labelInkColor(ink: number) {
  const gray = 255 - clampLabelInk(ink)
  return `rgb(${gray}, ${gray}, ${gray})`
}

export function defaultPositions(): Record<SectionId, PiecePosition> {
  return Object.fromEntries(
    sections.map((s) => [s.id, { x: s.x, y: s.y, width: s.width }]),
  ) as Record<SectionId, PiecePosition>
}

export function defaultLayout(): HeroLayout {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    positions: defaultPositions(),
    backgroundUrl: HERO_BG_FALLBACK,
    labelInk: DEFAULT_LABEL_INK,
  }
}

export function aspectOf(id: SectionId) {
  const section = sections.find((s) => s.id === id)
  if (!section) return 1
  return section.height / section.width
}

export function clampWidth(width: number) {
  return Math.round(Math.min(MAX_PIECE_WIDTH, Math.max(MIN_PIECE_WIDTH, width)))
}

export function clampPiece(
  id: SectionId,
  x: number,
  y: number,
  width: number,
  aspect?: number,
): PiecePosition {
  const nextWidth = clampWidth(width)
  const height = Math.round(nextWidth * (aspect && aspect > 0 ? aspect : aspectOf(id)))
  return {
    x: Math.round(Math.min(WORLD.width - nextWidth, Math.max(0, x))),
    y: Math.round(Math.min(WORLD.height - height, Math.max(0, y))),
    width: nextWidth,
  }
}

export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): Pick<PiecePosition, 'x' | 'y'> {
  return {
    x: Math.round(Math.min(WORLD.width - width, Math.max(0, x))),
    y: Math.round(Math.min(WORLD.height - height, Math.max(0, y))),
  }
}
