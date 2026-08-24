import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiListTexts, type TextEntry } from '../cms/api'
import { SiteNav } from './SiteNav'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function TextsIndex() {
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [error, setError] = useState('')
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
        if (!cancelled) setError('No se pudieron cargar los textos.')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="section-view" aria-label="Textos">
      <SiteNav />

      <div className="texts-index">
        <p className="texts-index__kicker">textos</p>
        {error && <p className="section-view__note">{error}</p>}
        {ready && !error && texts.length === 0 && (
          <p className="section-view__note">Todavía no hay textos publicados.</p>
        )}
        <ul className="texts-index__list">
          {texts.map((entry) => (
            <li key={entry.id}>
              <Link className="texts-index__item" to={`/textos/${entry.id}`}>
                <h2>{entry.title}</h2>
                <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                {entry.description && <p>{entry.description}</p>}
                <span className="texts-index__more">Leer →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
