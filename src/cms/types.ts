import type { SectionId } from '../data/sections'

export type PiecePosition = {
  x: number
  y: number
  width: number
  src?: string
}

export type HeroLayout = {
  version: 1
  updatedAt: string
  positions: Record<SectionId, PiecePosition>
}

export type LayoutRepository = {
  load(): Promise<HeroLayout>
  save(layout: HeroLayout): Promise<HeroLayout>
}
