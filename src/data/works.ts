import { sections, WORLD } from './sections'
import type { Section, SectionId } from './sections'

export type Work = {
  id: SectionId
  src: string
  x: number
  y: number
  width: number
  height: number
  placeholder: string
  label: string
}

export { WORLD }
export type { SectionId }

export const works: Work[] = sections.map((section: Section) => ({
  id: section.id,
  src: section.src,
  x: section.x,
  y: section.y,
  width: section.width,
  height: section.height,
  placeholder: section.placeholder,
  label: section.label,
}))
