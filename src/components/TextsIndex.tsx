import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiListTexts, type TextEntry } from '../cms/api'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function TextsIndex() {
  const navigate = useNavigate()
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void apiListTexts()
      .then((data) => setTexts(data.texts))
      .catch(() => setError('No se pudieron cargar los textos.'))
  }, [])

  return (
    <section className="section-view" aria-labelledby="section-title">
      <header className="section-view__bar">
        <button type="button" className="section-view__back" onClick={() => navigate('/')}>
          Volver
        </button>
        <h1 id="section-title" className="section-view__title">
          Textos
        </h1>
        <span className="section-view__spacer" aria-hidden />
      </header>

      <div className="texts-index">
        <p className="texts-index__kicker">textos</p>
        {error && <p className="section-view__note">{error}</p>}
        {!error && texts.length === 0 && (
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
