import { useMemo } from 'react'
import type { CanvasPiece } from '../cms/api'
import { CanvasEditor } from './CanvasEditor'
import type { CanvasItem } from './types'

type Props = {
  pieces: CanvasPiece[]
  onChange: (pieces: CanvasPiece[]) => void
  heightRatio: number
  onHeightRatioChange: (ratio: number) => void
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  heightInputId?: string
}

function toItems(pieces: CanvasPiece[]): CanvasItem[] {
  return pieces.map((piece) => ({
    id: piece.id,
    imageUrl: piece.src,
    x: piece.x,
    y: piece.y,
    width: piece.width,
  }))
}

function toPieces(items: CanvasItem[], previous: CanvasPiece[]): CanvasPiece[] {
  return items.map((item) => {
    const prior = previous.find((piece) => piece.id === item.id)
    return {
      id: item.id,
      src: item.imageUrl,
      x: item.x,
      y: item.y,
      width: item.width,
      z: prior?.z,
      mediaId: prior?.mediaId,
    }
  })
}

/** Host adapter: our pieces { id, src, x, y, width } ↔ studio-core CanvasItem. */
export function FreeCanvas({
  pieces,
  onChange,
  heightRatio,
  onHeightRatioChange,
  selectedId = null,
  onSelect,
  heightInputId,
}: Props) {
  const items = useMemo(() => toItems(pieces), [pieces])

  return (
    <CanvasEditor
      items={items}
      heightRatio={heightRatio}
      selectedId={selectedId}
      onSelect={onSelect}
      heightInputId={heightInputId}
      onHeightRatioChange={onHeightRatioChange}
      onChange={(next) => onChange(toPieces(next, pieces))}
    />
  )
}
