import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CanvasViewer } from '../canvas/CanvasViewer'
import { apiGetPlacements, apiGetSeries, type SectionCanvas, type WorkSeries } from '../cms/api'
import { pick } from '../i18n/lang'
import { useLanguage } from '../i18n/LanguageContext'
import { SiteNav } from './SiteNav'

function sameTitle(a?: string, b?: string) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  return Boolean(a && b && normalize(a) === normalize(b))
}

export function WorkSeriesDetail() {
  const { seriesId } = useParams()
  const { lang, ui } = useLanguage()
  const [series, setSeries] = useState<WorkSeries | null>(null)
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!seriesId) return
    let cancelled = false
    setReady(false)
    setError('')

    const meta = apiGetSeries(seriesId)
      .then((data) => {
        if (!cancelled) setSeries(data.series)
      })
      .catch(() => {
        if (!cancelled) setError('missing')
      })

    const blocks = apiGetPlacements('trabajos', undefined, seriesId)
      .then((data) => {
        if (!cancelled) setCanvases(data.canvases)
      })
      .catch(() => {
        if (!cancelled) setCanvases([])
      })

    void Promise.all([meta, blocks]).finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [seriesId])

  const title = pick(series?.title, series?.titleEn, lang)
  const text = pick(series?.description, series?.descriptionEn, lang)
  const hasContent =
    Boolean(text) ||
    canvases.some((block) => {
      if (block.kind === 'text') {
        return Boolean(pick(block.title, block.titleEn, lang) || pick(block.description, block.descriptionEn, lang))
      }
      return block.pieces.length > 0
    })

  return (
    <section className="section-view" aria-label={title || ui.works}>
      <SiteNav />

      {!ready ? null : error ? (
        <p className="section-view__note">
          {error === 'missing' ? ui.seriesMissing : error}{' '}
          <Link to="/trabajos">{ui.backToWorks}</Link>
        </p>
      ) : (
        <div className="section-view__body expos-detail">
          {title ? <h1 className="expos-detail__title">{title}</h1> : null}
          {text ? (
            <div className="series-intro">
              <p className="series-intro__text">{text}</p>
            </div>
          ) : null}
          {canvases.map((block, index) => {
            if (block.kind === 'text') {
              const blockTitle = pick(block.title, block.titleEn, lang)
              const description = pick(block.description, block.descriptionEn, lang)
              const isFirstText = !canvases.slice(0, index).some((item) => item.kind === 'text')
              const showHeading = Boolean(blockTitle) && !(isFirstText && !text && sameTitle(blockTitle, title))
              if (!showHeading && !description) return null
              return (
                <div key={block.id} className="series-intro">
                  {showHeading ? <h2 className="series-intro__title">{blockTitle}</h2> : null}
                  {description ? <p className="series-intro__text">{description}</p> : null}
                </div>
              )
            }
            if (block.pieces.length === 0) return null
            return (
              <CanvasViewer
                key={block.id}
                heightRatio={block.heightRatio}
                zoomOnClick
                items={block.pieces.map((piece) => ({
                  id: piece.id,
                  imageUrl: piece.src,
                  x: piece.x,
                  y: piece.y,
                  width: piece.width,
                  ficha: piece.ficha,
                  fichaEn: piece.fichaEn,
                }))}
              />
            )
          })}
          {!hasContent && <p className="section-view__note">{ui.seriesEmpty}</p>}
        </div>
      )}
    </section>
  )
}
