import { useRef, type PointerEvent } from 'react'
import { clamp } from './layout'
import type { CanvasItem } from './types'

type Interaction =
  | {
      type: 'drag'
      id: string
      startPx: number
      startPy: number
      originX: number
      originY: number
      rectW: number
      rectH: number
    }
  | {
      type: 'resize'
      id: string
      startPx: number
      originWidth: number
      rectW: number
    }
  | null

export type CanvasEditorProps = {
  items: CanvasItem[]
  heightRatio: number
  onChange: (items: CanvasItem[]) => void
  onHeightRatioChange?: (ratio: number) => void
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  showHeightControl?: boolean
}

export function CanvasEditor({
  items,
  heightRatio,
  onChange,
  onHeightRatioChange,
  selectedId = null,
  onSelect,
  showHeightControl = true,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const interaction = useRef<Interaction>(null)

  function updateItem(id: string, patch: Partial<CanvasItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function onPointerDownItem(e: PointerEvent, item: CanvasItem) {
    e.preventDefault()
    onSelect?.(item.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    interaction.current = {
      type: 'drag',
      id: item.id,
      startPx: e.clientX,
      startPy: e.clientY,
      originX: item.x,
      originY: item.y,
      rectW: rect.width,
      rectH: rect.height,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerDownResize(e: PointerEvent, item: CanvasItem) {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(item.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    interaction.current = {
      type: 'resize',
      id: item.id,
      startPx: e.clientX,
      originWidth: item.width,
      rectW: rect.width,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    const act = interaction.current
    if (!act) return

    if (act.type === 'drag') {
      const dx = ((e.clientX - act.startPx) / act.rectW) * 100
      const dy = ((e.clientY - act.startPy) / act.rectH) * 100
      updateItem(act.id, {
        x: clamp(act.originX + dx, 0, 95),
        y: clamp(act.originY + dy, 0, 98),
      })
    } else {
      const dw = ((e.clientX - act.startPx) / act.rectW) * 100
      updateItem(act.id, {
        width: clamp(act.originWidth + dw, 5, 90),
      })
    }
  }

  function onPointerUp() {
    interaction.current = null
  }

  return (
    <div className="studio-canvas">
      {showHeightControl && onHeightRatioChange && (
        <div className="studio-canvas__height">
          <label htmlFor="canvas-height">Alto del lienzo</label>
          <input
            id="canvas-height"
            type="range"
            min={0.6}
            max={2.5}
            step={0.1}
            value={heightRatio}
            onChange={(e) => onHeightRatioChange(Number.parseFloat(e.target.value))}
          />
          <span>{heightRatio.toFixed(1)}×</span>
        </div>
      )}

      <p className="studio-canvas__hint">
        El alto agranda el lienzo para scrollear hacia abajo. Arrastrá para mover. Esquina
        inferior derecha: tamaño.
      </p>

      <div
        ref={canvasRef}
        className="studio-canvas__board"
        style={{ paddingTop: `${heightRatio * 100}%` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.length === 0 && <p className="studio-canvas__empty">Subí imágenes para acomodarlas acá.</p>}
        {items.map((item) => (
          <div
            key={item.id}
            className={`studio-canvas__item${selectedId === item.id ? ' is-selected' : ''}`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.width}%`,
            }}
            onPointerDown={(e) => onPointerDownItem(e, item)}
          >
            <img src={item.imageUrl} alt={item.label || ''} draggable={false} />
            {selectedId === item.id && (
              <div
                className="studio-canvas__resize"
                onPointerDown={(e) => onPointerDownResize(e, item)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
