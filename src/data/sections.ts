export type SectionId =
  | 'bio'
  | 'trabajos'
  | 'exposiciones'
  | 'textos'
  | 'archivos'
  | 'contacto'

export type Section = {
  id: SectionId
  label: string
  src: string
  natW: number
  natH: number
  x: number
  y: number
  width: number
  height: number
  placeholder: string
}

/** Large field so six pieces still require travel */
export const WORLD = {
  width: 5200,
  height: 3800,
} as const

function sized(width: number, natW: number, natH: number) {
  return {
    width,
    height: Math.round(width * (natH / natW)),
  }
}

/**
 * Six gate-paintings. Distances from the opening viewport are intentional:
 * trabajos + bio sit near the start; textos a little further;
 * exposiciones / archivos / contacto require a longer drift.
 */
export const sections: Section[] = [
  {
    id: 'trabajos',
    label: 'Trabajos',
    src: '/works/juan_pintura_3_ALTA.jpg',
    natW: 2307,
    natH: 3081,
    x: 2140,
    y: 1480,
    ...sized(340, 2307, 3081),
    placeholder: '#d8d0c6',
  },
  {
    id: 'bio',
    label: 'Bio',
    src: '/works/a-nocturno-tarraf.jpg',
    natW: 1182,
    natH: 1280,
    x: 2580,
    y: 1360,
    ...sized(280, 1182, 1280),
    placeholder: '#cfc8be',
  },
  {
    id: 'textos',
    label: 'Textos',
    src: '/works/02.jpg',
    natW: 1725,
    natH: 1275,
    x: 1760,
    y: 2080,
    ...sized(360, 1725, 1275),
    placeholder: '#d4cbc0',
  },
  {
    id: 'exposiciones',
    label: 'Exposiciones',
    src: '/works/3948_baja.jpg',
    natW: 1644,
    natH: 1765,
    x: 3180,
    y: 420,
    ...sized(300, 1644, 1765),
    placeholder: '#c9c2b8',
  },
  {
    id: 'archivos',
    label: 'Archivos',
    src: '/works/3953_baja.jpg',
    natW: 1604,
    natH: 1970,
    x: 520,
    y: 2680,
    ...sized(270, 1604, 1970),
    placeholder: '#d2c9bf',
  },
  {
    id: 'contacto',
    label: 'Contacto',
    src: '/works/3965_baja.jpg',
    natW: 1618,
    natH: 1861,
    x: 4280,
    y: 2860,
    ...sized(250, 1618, 1861),
    placeholder: '#cfc6bc',
  },
]

export function getSection(id: string | null): Section | undefined {
  if (!id) return
  return sections.find((s) => s.id === id)
}
