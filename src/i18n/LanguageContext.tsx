import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readStoredLang, writeStoredLang, type Lang } from './lang'
import { UI } from './ui'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  ui: (typeof UI)[Lang]
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')

  useEffect(() => {
    setLangState(readStoredLang())
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next)
        writeStoredLang(next)
      },
      ui: UI[lang],
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
