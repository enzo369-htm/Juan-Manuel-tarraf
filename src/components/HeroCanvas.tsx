import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHeroLayout } from '../cms/useHeroLayout'
import { HERO_BG_FALLBACK } from '../data/sections'
import { WORLD, type SectionId } from '../data/works'
import { useCameraController } from '../hooks/useCameraController'
import { WorkPiece } from './WorkPiece'

export function HeroCanvas() {
  const navigate = useNavigate()
  const { layout, works, ready } = useHeroLayout()
  const backgroundUrl = layout.backgroundUrl || HERO_BG_FALLBACK
  const viewportRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [hintText, setHintText] = useState('Mové el cursor para explorar')

  useCameraController(viewportRef, {
    worldWidth: WORLD.width,
    worldHeight: WORLD.height,
    worldRef,
    mode: 'explore',
    onFirstInput: () => setHintVisible(false),
  })

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const coarse = window.matchMedia('(pointer: coarse)')
    const syncHint = () => {
      setHintText(
        coarse.matches ? 'Arrastrá para explorar' : 'Mové el cursor para explorar',
      )
    }
    syncHint()
    coarse.addEventListener('change', syncHint)

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      el.style.setProperty('--cursor-x', `${e.clientX}px`)
      el.style.setProperty('--cursor-y', `${e.clientY}px`)
      el.classList.add('is-ready')
    }

    el.addEventListener('pointermove', onMove)
    return () => {
      coarse.removeEventListener('change', syncHint)
      el.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <section ref={viewportRef} className="hero" aria-label="Espacio de entrada">
      <div className="hero__atmosphere" aria-hidden />

      <div
        ref={worldRef}
        className="hero__world"
        style={{
          width: WORLD.width,
          height: WORLD.height,
          backgroundImage: `url("${backgroundUrl}")`,
        }}
      >
        {ready
          ? works.map((work, i) => (
              <WorkPiece
                key={`${work.id}-${work.src}`}
                work={work}
                index={i}
                onOpen={(id: SectionId) => navigate(`/${id}`)}
              />
            ))
          : null}
      </div>

      <div className="hero__overlay">
        <p className={`hero__hint${hintVisible ? '' : ' is-hidden'}`}>{hintText}</p>
      </div>
    </section>
  )
}
