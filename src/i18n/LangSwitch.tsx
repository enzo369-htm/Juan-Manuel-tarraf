import { useLanguage } from './LanguageContext'

type Props = {
  className?: string
}

export function LangSwitch({ className = '' }: Props) {
  const { lang, setLang } = useLanguage()

  return (
    <div className={`lang-switch${className ? ` ${className}` : ''}`} role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'es' ? 'is-on' : ''}
        aria-pressed={lang === 'es'}
        onClick={() => setLang('es')}
      >
        ES
      </button>
      <span aria-hidden>/</span>
      <button
        type="button"
        className={lang === 'en' ? 'is-on' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  )
}
