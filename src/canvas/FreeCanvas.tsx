/**
 * Adaptador del posicionamiento libre para secciones (no el hero).
 * Cuando pases la ruta del otro repo, reemplazá el cuerpo de este
 * componente por ese código. El contrato se mantiene:
 *   pieces: { id, src, x, y, width }
 *   onChange(nextPieces)
 */
import { useEffect, useRef } from 'react'
import type { CanvasPiece } from '../cms/api'

type Props = {
  pieces: CanvasPiece[]
  onChange: (pieces: CanvasPiece[]) => void
}

export function FreeCanvas({ pieces, onChange }: Props) {
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = drag.current
      if (!current) return
      const next = piecesRef.current.map((piece) =>
        piece.id === current.id
          ? { ...piece, x: event.clientX - current.ox, y: event.clientY - current.oy }
          : piece,
      )
      onChange(next)
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onChange])

  return (
    <div className="free-canvas">
      {pieces.map((piece) => (
        <button
          key={piece.id}
          type="button"
          className="free-canvas__piece"
          style={{
            left: piece.x,
            top: piece.y,
            width: piece.width,
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            drag.current = {
              id: piece.id,
              ox: event.clientX - piece.x,
              oy: event.clientY - piece.y,
            }
          }}
        >
          <img src={piece.src} alt="" draggable={false} />
        </button>
      ))}
      {pieces.length === 0 && (
        <p className="free-canvas__empty">Subí imágenes para acomodarlas acá.</p>
      )}
    </div>
  )
}
