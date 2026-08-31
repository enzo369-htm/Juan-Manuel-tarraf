import { useEffect, useState, type ReactNode } from 'react'
import { withDefaultPositions } from './layout'
import type { CanvasItem, CanvasItemInput } from './types'

export type CanvasViewerProps = {
  items: CanvasItemInput[]
  heightRatio?: number | null
  renderCaption?: (item: CanvasItem) => ReactNode
  zoomOnClick?: boolean
}

/** Same free-canvas board as the admin: % positions, height = width × ratio. */
export function CanvasViewer({ items, heightRatio, renderCaption, zoomOnClick = false }: CanvasViewerProps) {
  const positioned = withDefaultPositions(items)
  const ratio = heightRatio ?? 1.2
  const [openUrl, setOpenUrl] = useState<string | null>(null)

  if (positioned.length === 0) return null

  return (
    <div className="studio-viewer">
      <div className="studio-viewer__desktop" style={{ paddingTop: `${ratio * 100}%` }}>
        {positioned.map((item) => (
          <DesktopItem
            key={item.id}
            item={item}
            renderCaption={renderCaption}
            zoomOnClick={zoomOnClick}
            onOpen={() => setOpenUrl(item.imageUrl)}
          />
        ))}
      </div>
      {zoomOnClick && openUrl ? (
        <Lightbox src={openUrl} onClose={() => setOpenUrl(null)} />
      ) : null}
    </div>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="studio-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Pintura en grande"
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function DesktopItem({
  item,
  renderCaption,
  zoomOnClick,
  onOpen,
}: {
  item: CanvasItem
  renderCaption?: (item: CanvasItem) => ReactNode
  zoomOnClick: boolean
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const caption = renderCaption?.(item)

  return (
    <div
      className={`studio-viewer__item${zoomOnClick ? ' is-zoomable' : ''}`}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: hovered ? 20 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {zoomOnClick ? (
        <button type="button" className="studio-viewer__zoom" onClick={onOpen} aria-label="Ver en grande">
          <img src={item.imageUrl} alt={item.label || ''} />
        </button>
      ) : (
        <img src={item.imageUrl} alt={item.label || ''} />
      )}
      {caption && hovered && <div className="studio-viewer__caption">{caption}</div>}
    </div>
  )
}
