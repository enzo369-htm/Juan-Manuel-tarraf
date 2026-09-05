import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiListExhibitions, type Exhibition } from '../cms/api'
import { SiteNav } from './SiteNav'

export function ExhibitionsIndex() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [error, setError] = useState('')
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
        if (!cancelled) setError('No se pudieron cargar las exposiciones.')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="section-view" aria-label="Exposiciones">
      <SiteNav />

      <div className="expos-index">
        <header className="expos-index__head">
          <h1 className="expos-index__kicker">Exposiciones</h1>
        </header>
        {error && <p className="section-view__note">{error}</p>}
        {ready && !error && exhibitions.length === 0 && (
          <p className="section-view__note">Todavía no hay exposiciones publicadas.</p>
        )}
        <ul className="expos-index__list">
          {exhibitions.map((entry) => (
            <li key={entry.id} className="expos-index__item">
              <Link className="expos-index__card" to={`/exposiciones/${entry.id}`}>
                <span className="expos-index__cover">
                  {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span aria-hidden />}
                </span>
                <span className="expos-index__copy">
                  <h2>{entry.title}</h2>
                  {entry.description ? <p className="expos-index__excerpt">{entry.description}</p> : null}
                </span>
                <span className="expos-index__more">Ver →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
