import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHeroLayout } from '../cms/useHeroLayout'
import { DEFAULT_LABEL_INK, labelInkColor } from '../cms/defaults'
import { HERO_BG_FALLBACK } from '../data/sections'
import { WORLD, type SectionId } from '../data/works'
import { useCameraController } from '../hooks/useCameraController'
import { LangSwitch } from '../i18n/LangSwitch'
import { useLanguage } from '../i18n/LanguageContext'
import { WorkPiece } from './WorkPiece'

export function HeroCanvas() {
  const navigate = useNavigate()
  const { layout, works, ready } = useHeroLayout()
  const { ui } = useLanguage()
  const backgroundUrl = layout.backgroundUrl || HERO_BG_FALLBACK
  const viewportRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [coarsePointer, setCoarsePointer] = useState(false)

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
    const syncHint = () => setCoarsePointer(coarse.matches)
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
    <section
      ref={viewportRef}
      className="hero"
      aria-label={ui.heroAria}
      style={{
        ['--hero-label' as string]: labelInkColor(layout.labelInk ?? DEFAULT_LABEL_INK),
      }}
    >
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
        <LangSwitch className="hero__lang" />
        <p className={`hero__hint${hintVisible ? '' : ' is-hidden'}`}>
          {coarsePointer ? ui.exploreTouch : ui.exploreMouse}
        </p>
      </div>
    </section>
  )
}
