import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { WorkPiece } from '../components/WorkPiece'
import { WORLD, type SectionId } from '../data/sections'
import type { Work } from '../data/works'
import { clampPiece } from './defaults'
import { useAdminViewport } from './useAdminViewport'
import { useHeroLayout, layoutToWorks } from './useHeroLayout'

type DragState = {
  kind: 'move' | 'resize'
  id: SectionId
  offsetX: number
  offsetY: number
  startWidth: number
  pointerId: number
  moved: boolean
}

function formatSavedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return 'Diseño inicial'
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function applyPiece(list: Work[], id: SectionId, x: number, y: number, width: number) {
  const next = clampPiece(id, x, y, width)
  return list.map((w) =>
    w.id === id
      ? {
          ...w,
          x: next.x,
          y: next.y,
          width: next.width,
          height: Math.round(next.width * (w.height / w.width)),
        }
      : w,
  )
}

function paintPiece(id: SectionId, piece: Work) {
  const el = document.querySelector<HTMLElement>(`[data-piece-id="${id}"]`)
  if (!el) return
  el.style.left = `${piece.x}px`
  el.style.top = `${piece.y}px`
  el.style.width = `${piece.width}px`
  el.style.height = `${piece.height}px`
}

export function AdminEditor() {
  const { layout, works, ready, save, restoreDefaults } = useHeroLayout()
  const [draft, setDraft] = useState<Work[]>(works)
  const [selectedId, setSelectedId] = useState<SectionId | null>(null)
  const [status, setStatus] = useState('Listo')
  const viewportRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const dragRef = useRef<DragState | null>(null)
  draftRef.current = draft

  const { scale, screenToWorld, fit, zoomBy } = useAdminViewport(viewportRef, worldRef)

  useEffect(() => {
    if (!ready) return
    setDraft(works)
    // Solo al terminar de cargar el layout inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const persist = useCallback(
    async (nextWorks: Work[]) => {
      const positions = Object.fromEntries(
        nextWorks.map((w) => [w.id, { x: w.x, y: w.y, width: w.width }]),
      ) as typeof layout.positions
      try {
        await save({ version: 1, updatedAt: layout.updatedAt, positions })
        setStatus('Guardado')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Error')
      }
    },
    [layout.updatedAt, save],
  )

  const beginDrag = (
    kind: 'move' | 'resize',
    id: SectionId,
    event: ReactPointerEvent,
  ) => {
    const piece = draftRef.current.find((w) => w.id === id)
    if (!piece) return
    event.preventDefault()
    const world = screenToWorld(event.clientX, event.clientY)
    setSelectedId(id)
    dragRef.current = {
      kind,
      id,
      offsetX: kind === 'move' ? world.x - piece.x : world.x,
      offsetY: kind === 'move' ? world.y - piece.y : world.y,
      startWidth: piece.width,
      pointerId: event.pointerId,
      moved: false,
    }
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const piece = draftRef.current.find((w) => w.id === drag.id)
      if (!piece) return
      const world = screenToWorld(event.clientX, event.clientY)

      const nextList =
        drag.kind === 'move'
          ? applyPiece(draftRef.current, drag.id, world.x - drag.offsetX, world.y - drag.offsetY, piece.width)
          : applyPiece(
              draftRef.current,
              drag.id,
              piece.x,
              piece.y,
              drag.startWidth + (world.x - drag.offsetX),
            )

      const nextPiece = nextList.find((w) => w.id === drag.id)
      if (!nextPiece) return
      if (nextPiece.x === piece.x && nextPiece.y === piece.y && nextPiece.width === piece.width) {
        return
      }

      drag.moved = true
      draftRef.current = nextList
      paintPiece(drag.id, nextPiece)
    }

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      dragRef.current = null
      const next = draftRef.current
      setDraft(next)
      if (drag.moved) {
        void persist(next)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [persist, screenToWorld])

  const selected = draft.find((w) => w.id === selectedId) ?? null

  const nudgeSize = (delta: number) => {
    if (!selected) return
    const next = applyPiece(draft, selected.id, selected.x, selected.y, selected.width + delta)
    draftRef.current = next
    setDraft(next)
    void persist(next)
  }

  const onReset = async () => {
    if (!window.confirm('¿Volver las 6 obras a la posición y tamaño iniciales?')) return
    try {
      const restored = await restoreDefaults()
      setDraft(layoutToWorks(restored))
      setStatus('Restablecido')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="admin-bar__brand">
          <span className="admin-bar__kicker">Admin</span>
          <strong>Hero / grilla</strong>
        </div>
        <p className="admin-bar__hint">
          Vista completa al entrar. Rueda: zoom. Fondo: pan. Obras: mover. Esquina: tamaño.
        </p>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">
            {status}
            {status === 'Guardado' || status === 'Listo' ? ` · ${formatSavedAt(layout.updatedAt)}` : ''}
          </span>
          <div className="admin-bar__zoom">
            <button type="button" className="admin-bar__btn" onClick={() => zoomBy(0.85)} aria-label="Alejar">
              −
            </button>
            <span className="admin-bar__zoom-label">{Math.round(scale * 100)}%</span>
            <button type="button" className="admin-bar__btn" onClick={() => zoomBy(1.15)} aria-label="Acercar">
              +
            </button>
            <button type="button" className="admin-bar__btn" onClick={() => fit()}>
              Encajar
            </button>
          </div>
          <div className={`admin-bar__size${selected ? '' : ' is-empty'}`}>
            {selected ? (
              <>
                <span>{selected.label}</span>
                <button type="button" className="admin-bar__btn" onClick={() => nudgeSize(-24)}>
                  −
                </button>
                <span>{selected.width}px</span>
                <button type="button" className="admin-bar__btn" onClick={() => nudgeSize(24)}>
                  +
                </button>
              </>
            ) : (
              <span>Elegí una obra</span>
            )}
          </div>
          <button type="button" className="admin-bar__btn" onClick={() => void onReset()}>
            Restablecer
          </button>
          <button
            type="button"
            className="admin-bar__btn admin-bar__btn--primary"
            onClick={() => void persist(draft)}
          >
            Guardar
          </button>
        </div>
      </header>

      <section ref={viewportRef} className="hero hero--admin" aria-label="Editor de grilla">
        <div className="hero__atmosphere" aria-hidden />
        <div
          ref={worldRef}
          className="hero__world admin-world"
          style={{ width: WORLD.width, height: WORLD.height }}
        >
          <div className="admin-world__grid" aria-hidden />
          {draft.map((work, i) => (
            <WorkPiece
              key={work.id}
              work={work}
              index={i}
              variant="admin"
              selected={selectedId === work.id}
              onSelect={setSelectedId}
              onDragStart={(id, event) => beginDrag('move', id, event)}
              onResizeStart={(id, event) => beginDrag('resize', id, event)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
