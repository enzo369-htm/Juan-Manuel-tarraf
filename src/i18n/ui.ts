import type { SectionId } from '../data/sections'
import type { Lang } from './lang'

export const NAV = [
  { id: 'trabajos' as const, es: 'Trabajos', en: 'Works' },
  { id: 'exposiciones' as const, es: 'Exposiciones', en: 'Exhibitions' },
  { id: 'textos' as const, es: 'Textos', en: 'Texts' },
  { id: 'archivos' as const, es: 'Archivos', en: 'Archives' },
  { id: 'bio' as const, es: 'Bio', en: 'Bio' },
  { id: 'contacto' as const, es: 'Contacto', en: 'Contact' },
]

export function navLabel(id: SectionId, lang: Lang) {
  const item = NAV.find((entry) => entry.id === id)
  if (!item) return id
  return lang === 'en' ? item.en : item.es
}

export const UI = {
  es: {
    view: 'Ver →',
    read: 'Leer →',
    exploreMouse: 'Mové el cursor para explorar',
    exploreTouch: 'Arrastrá para explorar',
    emptyExhibitions: 'Todavía no hay exposiciones publicadas.',
    emptyTexts: 'Todavía no hay textos publicados.',
    exhibitionsLoadError: 'No se pudieron cargar las exposiciones.',
    textsLoadError: 'No se pudieron cargar los textos.',
    exhibitionMissing: 'Esa exposición no está.',
    backToExhibitions: 'Volver a exposiciones',
    exhibitionEmpty: 'Espacio de esta exposición. El contenido se carga desde el CMS.',
    textMissing: 'Ese texto no está.',
    contactEmpty: 'Espacio de contacto. El contenido se carga desde el CMS.',
    emptySection: (label: string) =>
      `Espacio de ${label.toLowerCase()}. El contenido se carga desde el CMS.`,
    heroAria: 'Espacio de entrada',
    exhibitions: 'Exposiciones',
    texts: 'Textos',
  },
  en: {
    view: 'View →',
    read: 'Read →',
    exploreMouse: 'Move the cursor to explore',
    exploreTouch: 'Drag to explore',
    emptyExhibitions: 'No exhibitions published yet.',
    emptyTexts: 'No texts published yet.',
    exhibitionsLoadError: 'Exhibitions could not be loaded.',
    textsLoadError: 'Texts could not be loaded.',
    exhibitionMissing: 'That exhibition is not here.',
    backToExhibitions: 'Back to exhibitions',
    exhibitionEmpty: 'This exhibition space. Content is loaded from the CMS.',
    textMissing: 'That text is not here.',
    contactEmpty: 'Contact space. Content is loaded from the CMS.',
    emptySection: (label: string) => `This ${label.toLowerCase()} space. Content is loaded from the CMS.`,
    heroAria: 'Entrance space',
    exhibitions: 'Exhibitions',
    texts: 'Texts',
  },
} as const
