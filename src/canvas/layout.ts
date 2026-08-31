import type { CanvasItem, CanvasItemInput } from './types'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hasPosition(item: CanvasItemInput): boolean {
  return item.x != null && item.y != null && item.width != null
}

/** Staggered defaults so new items are never stacked on top of each other. */
export function withDefaultPositions(items: CanvasItemInput[]): CanvasItem[] {
  return items.map((item, i) => {
    if (hasPosition(item)) {
      return {
        id: item.id,
        imageUrl: item.imageUrl,
        x: item.x as number,
        y: item.y as number,
        width: item.width as number,
        label: item.label,
        ficha: item.ficha,
        meta: item.meta,
      }
    }

    const col = i % 2
    const row = Math.floor(i / 2)
    const width = 24
    const x = col === 0 ? 8 + (row % 2) * 6 : 58 - (row % 2) * 6
    const y = 3 + row * 13

    return {
      id: item.id,
      imageUrl: item.imageUrl,
      x,
      y,
      width,
      label: item.label,
      ficha: item.ficha,
      meta: item.meta,
    }
  })
}

export function defaultPositionForIndex(index: number): Pick<CanvasItem, 'x' | 'y' | 'width'> {
  const col = index % 2
  const row = Math.floor(index / 2)
  return {
    width: 24,
    x: col === 0 ? 8 + (row % 2) * 6 : 58 - (row % 2) * 6,
    y: clamp(4 + (row % 6) * 14, 0, 85),
  }
}
