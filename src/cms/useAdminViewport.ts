import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { WORLD } from '../data/sections'

export type ViewportCamera = {
  x: number
  y: number
  scale: number
}

const PAD = 64
const MIN_SCALE = 0.08
const MAX_SCALE = 1.6

function fitScale(vw: number, vh: number) {
  return Math.min((vw - PAD * 2) / WORLD.width, (vh - PAD * 2) / WORLD.height)
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function useAdminViewport(
  viewportRef: RefObject<HTMLElement | null>,
  worldRef: RefObject<HTMLElement | null>,
) {
  const cam = useRef<ViewportCamera>({ x: 0, y: 0, scale: 1 })
  const [scale, setScale] = useState(1)
  const fitted = useRef(false)

  const apply = () => {
    const world = worldRef.current
    if (!world) return
    const { x, y, scale: s } = cam.current
    world.style.transformOrigin = '0 0'
    world.style.transform = `translate3d(${-x * s}px, ${-y * s}px, 0) scale(${s})`
  }

  const clampCamera = () => {
    const el = viewportRef.current
    if (!el) return
    const s = cam.current.scale
    const viewW = el.clientWidth / s
    const viewH = el.clientHeight / s
    const extraX = Math.max(0, viewW - WORLD.width)
    const extraY = Math.max(0, viewH - WORLD.height)
    const minX = -extraX / 2
    const minY = -extraY / 2
    const maxX = WORLD.width - viewW + extraX / 2
    const maxY = WORLD.height - viewH + extraY / 2
    cam.current.x = Math.min(maxX, Math.max(minX, cam.current.x))
    cam.current.y = Math.min(maxY, Math.max(minY, cam.current.y))
  }

  const fit = useCallback(() => {
    const el = viewportRef.current
    if (!el || el.clientWidth < 2 || el.clientHeight < 2) return
    const s = fitScale(el.clientWidth, el.clientHeight)
    cam.current.scale = s
    cam.current.x = (WORLD.width - el.clientWidth / s) / 2
    cam.current.y = (WORLD.height - el.clientHeight / s) / 2
    clampCamera()
    setScale(s)
    apply()
  }, [viewportRef])

  const zoomAt = (nextScale: number, clientX: number, clientY: number) => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const worldX = cam.current.x + sx / cam.current.scale
    const worldY = cam.current.y + sy / cam.current.scale
    const s = clampScale(nextScale)
    cam.current.scale = s
    cam.current.x = worldX - sx / s
    cam.current.y = worldY - sy / s
    clampCamera()
    setScale(s)
    apply()
  }

  const panBy = (dx: number, dy: number) => {
    cam.current.x -= dx / cam.current.scale
    cam.current.y -= dy / cam.current.scale
    clampCamera()
    apply()
  }

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: cam.current.x + (clientX - rect.left) / cam.current.scale,
      y: cam.current.y + (clientY - rect.top) / cam.current.scale,
    }
  }, [viewportRef])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const pan = { active: false, lastX: 0, lastY: 0, pointerId: 0 }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 0.92 : 1.08
      zoomAt(cam.current.scale * factor, event.clientX, event.clientY)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      pan.active = true
      pan.lastX = event.clientX
      pan.lastY = event.clientY
      pan.pointerId = event.pointerId
      el.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pan.active || event.pointerId !== pan.pointerId) return
      panBy(event.clientX - pan.lastX, event.clientY - pan.lastY)
      pan.lastX = event.clientX
      pan.lastY = event.clientY
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pan.active || event.pointerId !== pan.pointerId) return
      pan.active = false
      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        /* already released */
      }
    }

    const onViewportResize = () => {
      clampCamera()
      apply()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', onViewportResize)
    const observer = new ResizeObserver(onViewportResize)
    observer.observe(el)

    if (!fitted.current) {
      fitted.current = true
      requestAnimationFrame(() => fit())
    }

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', onViewportResize)
      observer.disconnect()
    }
  }, [fit, viewportRef, worldRef])

  const zoomBy = useCallback(
    (factor: number) => {
      const el = viewportRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      zoomAt(cam.current.scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
    },
    [viewportRef],
  )

  return { scale, screenToWorld, fit, zoomBy }
}
