import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiGetText, type TextEntry } from '../cms/api'
import { SiteNav } from './SiteNav'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function TextArticle() {
  const { textId } = useParams()
  const [entry, setEntry] = useState<TextEntry | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!textId) return
    void apiGetText(textId)
      .then((data) => setEntry(data.text))
      .catch(() => setError('Ese texto no está.'))
  }, [textId])

  return (
    <section className="section-view" aria-label="Textos">
      <SiteNav />

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
