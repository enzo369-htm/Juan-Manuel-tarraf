import { useState, type CSSProperties, type PointerEvent } from 'react'
import type { SectionId, Work } from '../data/works'

type Props = {
  work: Work
  index: number
  onOpen?: (id: SectionId) => void
  variant?: 'public' | 'admin'
  dragging?: boolean
  selected?: boolean
  onDragStart?: (id: SectionId, event: PointerEvent<HTMLButtonElement>) => void
  onResizeStart?: (id: SectionId, event: PointerEvent<HTMLSpanElement>) => void
  onSelect?: (id: SectionId) => void
}

export function WorkPiece({
  work,
  index,
  onOpen,
  variant = 'public',
  dragging = false,
  selected = false,
  onDragStart,
  onResizeStart,
  onSelect,
}: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const style = {
    left: work.x,
    top: work.y,
    width: work.width,
    height: work.height,
    zIndex: dragging || selected ? 80 : index + 1,
    animationDelay: variant === 'admin' ? '0s' : `${0.12 + index * 0.08}s`,
  } as CSSProperties

  const className = [
    'work-piece',
    variant === 'admin' ? 'work-piece--admin' : '',
    dragging ? 'is-dragging' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={work.label}
      data-piece-id={work.id}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect?.(work.id)
        onDragStart?.(work.id, e)
      }}
      onClick={() => {
        if (variant === 'admin') return
        onOpen?.(work.id)
      }}
    >
      <span className="work-piece__frame">
        <span
          className="work-piece__placeholder"
          style={{ background: work.placeholder }}
          aria-hidden={loaded}
        />
        {!failed && (
          <img
            className={`work-piece__img${loaded ? ' is-loaded' : ''}`}
            src={work.src}
            alt=""
            loading="eager"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {variant === 'admin' && (
          <span
            className="work-piece__resize"
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onSelect?.(work.id)
              onResizeStart?.(work.id, e)
            }}
          />
        )}
      </span>
      <span className="work-piece__label">{work.label}</span>
    </button>
  )
}
