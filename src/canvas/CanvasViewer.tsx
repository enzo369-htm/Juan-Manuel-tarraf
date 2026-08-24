import { useState, type ReactNode } from 'react'
import { withDefaultPositions } from './layout'
import type { CanvasItem, CanvasItemInput } from './types'

export type CanvasViewerProps = {
  items: CanvasItemInput[]
  heightRatio?: number | null
  renderCaption?: (item: CanvasItem) => ReactNode
}

export function CanvasViewer({ items, heightRatio, renderCaption }: CanvasViewerProps) {
  const positioned = withDefaultPositions(items)
  const ratio = heightRatio ?? 1.2

  if (positioned.length === 0) return null

  return (
    <div className="studio-viewer">
      <div className="studio-viewer__mobile">
        {positioned.map((item) => (
          <StackedItem key={item.id} item={item} renderCaption={renderCaption} />
        ))}
      </div>
      <div className="studio-viewer__desktop" style={{ paddingTop: `${ratio * 100}%` }}>
        {positioned.map((item) => (
          <DesktopItem key={item.id} item={item} renderCaption={renderCaption} />
        ))}
      </div>
    </div>
  )
}

function DesktopItem({
  item,
  renderCaption,
}: {
  item: CanvasItem
  renderCaption?: (item: CanvasItem) => ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const caption = renderCaption?.(item)

  return (
    <div
      className="studio-viewer__item"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: hovered ? 20 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={item.imageUrl} alt={item.label || ''} />
      {caption && hovered && <div className="studio-viewer__caption">{caption}</div>}
    </div>
  )
}

function StackedItem({
  item,
  renderCaption,
}: {
  item: CanvasItem
  renderCaption?: (item: CanvasItem) => ReactNode
}) {
  const caption = renderCaption?.(item)
  return (
    <div className="studio-viewer__stack">
      <img src={item.imageUrl} alt={item.label || ''} />
      {caption && <div className="studio-viewer__caption">{caption}</div>}
    </div>
  )
}
