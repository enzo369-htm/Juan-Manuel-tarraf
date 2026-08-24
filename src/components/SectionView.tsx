import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasViewer } from '../canvas/CanvasViewer'
import { apiGetCopy, apiGetPlacements, type SectionCanvas } from '../cms/api'
import type { Section } from '../data/sections'

const CANVAS_SECTIONS = new Set(['trabajos', 'exposiciones', 'archivos'])

type Props = {
  section: Section
}

export function SectionView({ section }: Props) {
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [portraitUrl, setPortraitUrl] = useState('')
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [ready, setReady] = useState(false)
  const [loadedId, setLoadedId] = useState(section.id)

  if (loadedId !== section.id) {
    setLoadedId(section.id)
    setReady(false)
    setBody('')
    setPortraitUrl('')
    setCanvases([])
  }

  useEffect(() => {
    let cancelled = false

    const copy = apiGetCopy(section.id)
      .then((data) => {
        if (cancelled) return
        setBody(data.body)
        setPortraitUrl(data.portraitUrl ?? '')
      })
      .catch(() => {
        if (cancelled) return
        setBody('')
        setPortraitUrl('')
      })

    const placements = CANVAS_SECTIONS.has(section.id)
      ? apiGetPlacements(section.id)
          .then((data) => {
            if (!cancelled) setCanvases(data.canvases)
          })
          .catch(() => {
            if (!cancelled) setCanvases([])
          })
      : Promise.resolve()

    void Promise.all([copy, placements]).finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [section.id])

  const isBio = section.id === 'bio'

  return (
    <section className="section-view" aria-labelledby="section-title">
      <header className="section-view__bar">
        <button type="button" className="section-view__back" onClick={() => navigate('/')}>
          Volver
        </button>
        <h1 id="section-title" className="section-view__title">
          {section.label}
        </h1>
        <span className="section-view__spacer" aria-hidden />
      </header>

      {!ready ? null : isBio ? (
        <div className="bio">
          <div className="bio__text">{body}</div>
          <div className="bio__portrait">
            {portraitUrl ? <img src={portraitUrl} alt="" /> : <span aria-hidden />}
          </div>
        </div>
      ) : (
        <div className="section-view__body">
          {CANVAS_SECTIONS.has(section.id)
            ? canvases.map((block) => {
                if (block.kind === 'text') {
                  if (!block.title && !block.description) return null
                  return (
                    <div key={block.id} className="series-intro">
                      {block.title ? <h2 className="series-intro__title">{block.title}</h2> : null}
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
              })
            : null}
          {!CANVAS_SECTIONS.has(section.id) && body && (
            <div className="section-view__copy">{body}</div>
          )}
          {CANVAS_SECTIONS.has(section.id) &&
            !canvases.some(
              (block) =>
                (block.kind === 'text' && (block.title || block.description)) ||
                (block.kind !== 'text' && block.pieces.length > 0),
            ) && (
              <p className="section-view__note">
                Espacio de {section.label.toLowerCase()}. El contenido se carga desde el CMS.
              </p>
            )}
          {!CANVAS_SECTIONS.has(section.id) && !body && (
            <p className="section-view__note">
              Espacio de {section.label.toLowerCase()}. El contenido se carga desde el CMS.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
