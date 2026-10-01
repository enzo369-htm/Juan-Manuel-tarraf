import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiListSeries, type WorkSeries } from '../cms/api'
import { pick } from '../i18n/lang'
import { useLanguage } from '../i18n/LanguageContext'
import { SiteNav } from './SiteNav'

export function WorksIndex() {
  const { lang, ui } = useLanguage()
  const [series, setSeries] = useState<WorkSeries[]>([])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    void apiListSeries()
      .then((data) => {
        if (cancelled) return
        setSeries(data.series)
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
    <section className="section-view" aria-label={ui.works}>
      <SiteNav />
      <div className="works-index">
        <header className="works-index__head">
          <h1 className="works-index__kicker">{ui.works}</h1>
        </header>
        {failed && <p className="section-view__note">{ui.worksLoadError}</p>}
        {ready && !failed && series.length === 0 && (
          <p className="section-view__note">{ui.emptyWorks}</p>
        )}
        {series.length > 0 && (
          <ol className="works-index__list">
            {series.map((entry, index) => {
              const title = pick(entry.title, entry.titleEn, lang)
              const number = String(index + 1).padStart(2, '0')
              return (
                <li key={entry.id}>
                  <Link className="works-index__link" to={`/trabajos/${entry.id}`}>
                    <span className="works-index__num">{number}.</span>
                    <span className="works-index__title">{title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
