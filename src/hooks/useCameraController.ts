import { useEffect, useRef, type RefObject } from 'react'

export type CameraSnapshot = {
  x: number
  y: number
}

type Options = {
  worldWidth: number
  worldHeight: number
  worldRef: RefObject<HTMLElement | null>
  onFirstInput?: () => void
  mode?: 'explore' | 'pan'
  cameraRef?: { current: CameraSnapshot }
}

const DEADZONE = 0.12
const MAX_SPEED = 18
const DAMPING = 0.92
const EDGE_PAD = 0.18
const TOUCH_FRICTION = 0.94
const TOUCH_THROW = 0.85

function isCoarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches
}

export function useCameraController(
  viewportRef: RefObject<HTMLElement | null>,
  { worldWidth, worldHeight, worldRef, onFirstInput, mode = 'explore', cameraRef }: Options,
) {
  const cam = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const mouse = useRef({ nx: 0, ny: 0, active: false })
  const touch = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
  })
  const firstInput = useRef(false)
  const onFirstInputRef = useRef(onFirstInput)
  onFirstInputRef.current = onFirstInput
  const cameraRefHandle = useRef(cameraRef)
  cameraRefHandle.current = cameraRef

  useEffect(() => {
    const el = viewportRef.current
    const world = worldRef.current
    if (!el || !world) return

    const applyTransform = () => {
      world.style.transform = `translate3d(${-cam.current.x}px, ${-cam.current.y}px, 0)`
      const handle = cameraRefHandle.current
      if (handle) {
        handle.current.x = cam.current.x
        handle.current.y = cam.current.y
      }
    }

    const centerCamera = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      cam.current.x = Math.max(0, (worldWidth - vw) / 2)
      cam.current.y = Math.max(0, (worldHeight - vh) / 2)
      applyTransform()
    }

    centerCamera()

    const markInput = () => {
      if (firstInput.current) return
      firstInput.current = true
      onFirstInputRef.current?.()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (mode === 'pan') return
      if (touch.current.dragging) return
      if (isCoarsePointer()) return

      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const half = Math.min(rect.width, rect.height) / 2
      mouse.current.nx = (e.clientX - cx) / half
      mouse.current.ny = (e.clientY - cy) / half
      mouse.current.active = true

      const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
      if (dist > Math.min(rect.width, rect.height) * DEADZONE) {
        markInput()
      }
    }

    const onPointerLeave = () => {
      if (!touch.current.dragging) {
        mouse.current.active = false
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (mode === 'pan') {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        markInput()
        touch.current.dragging = true
        touch.current.lastX = e.clientX
        touch.current.lastY = e.clientY
        touch.current.lastT = performance.now()
        cam.current.vx = 0
        cam.current.vy = 0
        el.setPointerCapture(e.pointerId)
        return
      }

      if (e.pointerType === 'mouse') return
      markInput()
      touch.current.dragging = true
      touch.current.lastX = e.clientX
      touch.current.lastY = e.clientY
      touch.current.lastT = performance.now()
      cam.current.vx = 0
      cam.current.vy = 0
      el.setPointerCapture(e.pointerId)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!touch.current.dragging) return
      touch.current.dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    const onTouchMove = (e: PointerEvent) => {
      if (!touch.current.dragging) return
      const now = performance.now()
      const dt = Math.max(now - touch.current.lastT, 1)
      const dx = e.clientX - touch.current.lastX
      const dy = e.clientY - touch.current.lastY

      cam.current.x -= dx
      cam.current.y -= dy
      if (mode === 'explore') {
        cam.current.vx = (-dx / dt) * 16 * TOUCH_THROW
        cam.current.vy = (-dy / dt) * 16 * TOUCH_THROW
      } else {
        cam.current.vx = 0
        cam.current.vy = 0
      }

      touch.current.lastX = e.clientX
      touch.current.lastY = e.clientY
      touch.current.lastT = now
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointermove', onTouchMove)
    el.addEventListener('pointerleave', onPointerLeave)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', centerCamera)

    let raf = 0
    const tick = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      const maxX = Math.max(0, worldWidth - vw)
      const maxY = Math.max(0, worldHeight - vh)

      if (
        mode === 'explore' &&
        !touch.current.dragging &&
        mouse.current.active &&
        !isCoarsePointer()
      ) {
        const { nx, ny } = mouse.current
        const mag = Math.hypot(nx, ny)
        if (mag > DEADZONE) {
          const t = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE))
          const eased = t * t
          const inv = mag || 1
          cam.current.vx += (nx / inv) * eased * MAX_SPEED * 0.12
          cam.current.vy += (ny / inv) * eased * MAX_SPEED * 0.12
        }
      }

      const speed = Math.hypot(cam.current.vx, cam.current.vy)
      if (speed > MAX_SPEED) {
        cam.current.vx = (cam.current.vx / speed) * MAX_SPEED
        cam.current.vy = (cam.current.vy / speed) * MAX_SPEED
      }

      cam.current.x += cam.current.vx
      cam.current.y += cam.current.vy

      const damp =
        mouse.current.active && !touch.current.dragging ? DAMPING : TOUCH_FRICTION
      if (!touch.current.dragging) {
        cam.current.vx *= damp
        cam.current.vy *= damp
      }

      if (cam.current.x < 0) {
        cam.current.x += (0 - cam.current.x) * EDGE_PAD
        cam.current.vx *= 0.5
      } else if (cam.current.x > maxX) {
        cam.current.x += (maxX - cam.current.x) * EDGE_PAD
        cam.current.vx *= 0.5
      }
      if (cam.current.y < 0) {
        cam.current.y += (0 - cam.current.y) * EDGE_PAD
        cam.current.vy *= 0.5
      } else if (cam.current.y > maxY) {
        cam.current.y += (maxY - cam.current.y) * EDGE_PAD
        cam.current.vy *= 0.5
      }

      cam.current.x = Math.min(maxX, Math.max(0, cam.current.x))
      cam.current.y = Math.min(maxY, Math.max(0, cam.current.y))

      if (Math.abs(cam.current.vx) < 0.01) cam.current.vx = 0
      if (Math.abs(cam.current.vy) < 0.01) cam.current.vy = 0

      applyTransform()
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointermove', onTouchMove)
      el.removeEventListener('pointerleave', onPointerLeave)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', centerCamera)
    }
  }, [viewportRef, worldRef, worldWidth, worldHeight, mode])
}
