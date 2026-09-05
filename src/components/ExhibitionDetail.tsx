import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CanvasViewer } from '../canvas/CanvasViewer'
import { apiGetExhibition, apiGetPlacements, type SectionCanvas } from '../cms/api'
import { SiteNav } from './SiteNav'

function sameTitle(a?: string, b?: string) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  return Boolean(a && b && normalize(a) === normalize(b))
}

export function ExhibitionDetail() {
  const { exhibitionId } = useParams()
  const [title, setTitle] = useState('')
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!exhibitionId) return
    let cancelled = false
    setReady(false)
    setError('')

    const meta = apiGetExhibition(exhibitionId)
      .then((data) => {
        if (!cancelled) setTitle(data.exhibition.title)
      })
      .catch(() => {
        if (!cancelled) setError('Esa exposición no está.')
      })

    const blocks = apiGetPlacements('exposiciones', exhibitionId)
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
  }, [exhibitionId])

  const hasContent = canvases.some(
    (block) =>
      (block.kind === 'text' && (block.title || block.description)) ||
      (block.kind !== 'text' && block.pieces.length > 0),
  )

  return (
    <section className="section-view" aria-label={title || 'Exposición'}>
      <SiteNav />

      {!ready ? null : error ? (
        <p className="section-view__note">
          {error}{' '}
          <Link to="/exposiciones">Volver a exposiciones</Link>
        </p>
      ) : (
        <div className="section-view__body expos-detail">
          {title ? <h1 className="expos-detail__title">{title}</h1> : null}
          {canvases.map((block, index) => {
            if (block.kind === 'text') {
              const isFirstText = !canvases.slice(0, index).some((item) => item.kind === 'text')
              const showHeading =
                Boolean(block.title) && !isFirstText && !sameTitle(block.title, title)
              if (!showHeading && !block.description) return null
              return (
                <div key={block.id} className="series-intro">
                  {showHeading ? <h2 className="series-intro__title">{block.title}</h2> : null}
                  {block.description ? (
                    <p className="series-intro__text">{block.description}</p>
                  ) : null}
                </div>
              )
            }
            if (block.pieces.length === 0) return null
            return (
              <CanvasViewer
                key={block.id}
                heightRatio={block.heightRatio}
                items={block.pieces.map((piece) => ({
                  id: piece.id,
                  imageUrl: piece.src,
                  x: piece.x,
                  y: piece.y,
                  width: piece.width,
                }))}
              />
            )
          })}
          {!hasContent && (
            <p className="section-view__note">Espacio de esta exposición. El contenido se carga desde el CMS.</p>
          )}
        </div>
      )}
    </section>
  )
}
