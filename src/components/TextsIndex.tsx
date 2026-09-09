import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiListTexts, type TextEntry } from '../cms/api'
import { pick } from '../i18n/lang'
import { useLanguage } from '../i18n/LanguageContext'
import { SiteNav } from './SiteNav'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function TextsIndex() {
  const { lang, ui } = useLanguage()
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    void apiListTexts()
      .then((data) => {
        if (cancelled) return
        setTexts(data.texts)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="section-view" aria-label={ui.texts}>
      <SiteNav />

      <div className="texts-index">
        <header className="texts-index__head">
          <h1 className="texts-index__kicker">{ui.texts}</h1>
        </header>
        {failed && <p className="section-view__note">{ui.textsLoadError}</p>}
        {ready && !failed && texts.length === 0 && (
          <p className="section-view__note">{ui.emptyTexts}</p>
        )}
        <ul className="texts-index__list">
          {texts.map((entry) => {
            const title = pick(entry.title, entry.titleEn, lang)
            const excerpt = pick(entry.description, entry.descriptionEn, lang)
            return (
              <li key={entry.id} className="texts-index__item">
                <Link className="texts-index__card" to={`/textos/${entry.id}`}>
                  <span className="texts-index__cover">
                    {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span aria-hidden />}
                  </span>
                  <span className="texts-index__copy">
                    <h2>{title}</h2>
                    <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                    {excerpt ? <p className="texts-index__excerpt">{excerpt}</p> : null}
                  </span>
                  <span className="texts-index__more">{ui.read}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
