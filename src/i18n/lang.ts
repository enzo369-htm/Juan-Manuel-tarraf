export type Lang = 'es' | 'en'

const STORAGE_KEY = 'jt-lang'

export function isLang(value: unknown): value is Lang {
  return value === 'es' || value === 'en'
}

export function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLang(stored)) return stored
  } catch {
    /* private mode */
  }
  return 'es'
}

export function writeStoredLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* private mode */
  }
}

/** English if it has text; otherwise Spanish. */
export function pick(es: string | undefined | null, en: string | undefined | null, lang: Lang) {
  if (lang === 'en' && en?.trim()) return en
  return es ?? ''
}
