import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiListExhibitions, type Exhibition } from '../cms/api'
import { pick } from '../i18n/lang'
import { useLanguage } from '../i18n/LanguageContext'
import { SiteNav } from './SiteNav'

export function ExhibitionsIndex() {
  const { lang, ui } = useLanguage()
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    void apiListExhibitions()
      .then((data) => {
        if (cancelled) return
        setExhibitions(data.exhibitions)
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
    <section className="section-view" aria-label={ui.exhibitions}>
      <SiteNav />

      <div className="expos-index">
        <header className="expos-index__head">
          <h1 className="expos-index__kicker">{ui.exhibitions}</h1>
        </header>
        {failed && <p className="section-view__note">{ui.exhibitionsLoadError}</p>}
        {ready && !failed && exhibitions.length === 0 && (
          <p className="section-view__note">{ui.emptyExhibitions}</p>
        )}
        <ul className="expos-index__list">
          {exhibitions.map((entry) => {
            const title = pick(entry.title, entry.titleEn, lang)
            const excerpt = pick(entry.description, entry.descriptionEn, lang)
            return (
              <li key={entry.id} className="expos-index__item">
                <Link className="expos-index__card" to={`/exposiciones/${entry.id}`}>
                  <span className="expos-index__cover">
                    {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span aria-hidden />}
                  </span>
                  <span className="expos-index__copy">
                    <h2>{title}</h2>
                    {excerpt ? <p className="expos-index__excerpt">{excerpt}</p> : null}
                  </span>
                  <span className="expos-index__more">{ui.view}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
