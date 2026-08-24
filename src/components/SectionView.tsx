import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasViewer } from '../canvas/CanvasViewer'
import { apiGetCopy, apiGetPlacements, type SectionCanvas } from '../cms/api'
import type { Section } from '../data/sections'

type Props = {
  section: Section
}

export function SectionView({ section }: Props) {
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [portraitUrl, setPortraitUrl] = useState('')
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])

  useEffect(() => {
    void apiGetCopy(section.id)
      .then((data) => {
        setBody(data.body)
        setPortraitUrl(data.portraitUrl ?? '')
      })
      .catch(() => {
        setBody('')
        setPortraitUrl('')
      })
    if (section.id === 'bio') {
      setCanvases([])
      return
    }
    void apiGetPlacements(section.id)
      .then((data) => setCanvases(data.canvases))
      .catch(() => setCanvases([]))
  }, [section.id])

  const visible = canvases.filter((canvas) => canvas.pieces.length > 0)
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

      {isBio ? (
        <div className="bio">
          <div className="bio__text">{body}</div>
          <div className="bio__portrait">
            {portraitUrl ? <img src={portraitUrl} alt="" /> : <span aria-hidden />}
          </div>
        </div>
      ) : (
        <div className="section-view__body">
          {body && <div className="section-view__copy">{body}</div>}
          {visible.map((canvas) => (
            <CanvasViewer
              key={canvas.id}
              heightRatio={canvas.heightRatio}
              items={canvas.pieces.map((piece) => ({
                id: piece.id,
                imageUrl: piece.src,
                x: piece.x,
                y: piece.y,
                width: piece.width,
              }))}
            />
          ))}
          {!body && visible.length === 0 && (
            <p className="section-view__note">
              Espacio de {section.label.toLowerCase()}. El contenido se carga desde el CMS.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
