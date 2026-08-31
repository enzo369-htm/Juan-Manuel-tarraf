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
  const [openItem, setOpenItem] = useState<CanvasItem | null>(null)

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
            onOpen={() => setOpenItem(item)}
          />
        ))}
      </div>
      {zoomOnClick && openItem ? (
        <Lightbox item={openItem} onClose={() => setOpenItem(null)} />
      ) : null}
    </div>
  )
}

function Lightbox({ item, onClose }: { item: CanvasItem; onClose: () => void }) {
  const ficha = item.ficha?.trim() ?? ''

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
      className={`studio-lightbox${ficha ? ' studio-lightbox--ficha' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pintura en grande"
      onClick={onClose}
    >
      {ficha ? (
        <p className="studio-lightbox__ficha" onClick={(event) => event.stopPropagation()}>
          {ficha}
        </p>
      ) : null}
      <img src={item.imageUrl} alt="" onClick={(event) => event.stopPropagation()} />
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
