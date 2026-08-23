import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetCopy, apiGetPlacements, type CanvasPiece } from '../cms/api'
import type { Section } from '../data/sections'

type Props = {
  section: Section
}

export function SectionView({ section }: Props) {
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [pieces, setPieces] = useState<CanvasPiece[]>([])

  useEffect(() => {
    void apiGetCopy(section.id)
      .then((data) => setBody(data.body))
      .catch(() => setBody(''))
    void apiGetPlacements(section.id)
      .then((data) => setPieces(data.pieces))
      .catch(() => setPieces([]))
  }, [section.id])

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

      <div className="section-view__body">
        {body && <div className="section-view__copy">{body}</div>}
        {pieces.length > 0 && (
          <div className="section-view__canvas">
            {pieces.map((piece) => (
              <img
                key={piece.id}
                src={piece.src}
                alt=""
                style={{ left: piece.x, top: piece.y, width: piece.width }}
              />
            ))}
          </div>
        )}
        {!body && pieces.length === 0 && (
          <p className="section-view__note">
            Espacio de {section.label.toLowerCase()}. El contenido se carga desde el CMS.
          </p>
        )}
      </div>
    </section>
  )
}
