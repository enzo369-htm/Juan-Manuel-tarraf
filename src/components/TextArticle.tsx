import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGetText, type TextEntry } from '../cms/api'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function TextArticle() {
  const { textId } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<TextEntry | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!textId) return
    void apiGetText(textId)
      .then((data) => setEntry(data.text))
      .catch(() => setError('Ese texto no está.'))
  }, [textId])

  return (
    <section className="section-view" aria-labelledby="article-title">
      <header className="section-view__bar">
        <button type="button" className="section-view__back" onClick={() => navigate('/textos')}>
          Volver
        </button>
        <h1 id="article-title" className="section-view__title">
          Textos
        </h1>
        <span className="section-view__spacer" aria-hidden />
      </header>

      {error && <p className="section-view__note">{error}</p>}
      {entry && (
        <article className="text-article">
          <h2 className="text-article__title">{entry.title}</h2>
          <time className="text-article__date" dateTime={entry.created_at}>
            {formatDate(entry.created_at)}
          </time>
          <div className="text-article__body">{entry.body}</div>
        </article>
      )}
    </section>
  )
}
