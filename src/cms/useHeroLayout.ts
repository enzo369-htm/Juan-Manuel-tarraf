import { useCallback, useEffect, useMemo, useState } from 'react'
import { sections } from '../data/sections'
import type { Work } from '../data/works'
import { apiGetHero, apiResetHero, apiSaveHero } from './api'
import { defaultLayout } from './defaults'
import { readCachedLayout, writeCachedLayout } from './layoutStore'
import type { HeroLayout } from './types'

export function layoutToWorks(layout: HeroLayout): Work[] {
  return sections.map((section) => {
    const pos = layout.positions[section.id]
    const width = pos?.width ?? section.width
    return {
      id: section.id,
      src: pos?.src ?? section.src,
      x: pos?.x ?? section.x,
      y: pos?.y ?? section.y,
      width,
      height: Math.round(width * (section.height / section.width)),
      placeholder: section.placeholder,
      label: section.label,
    }
  })
}

function initialLayout() {
  return readCachedLayout() ?? defaultLayout()
}

export function useHeroLayout() {
  const [layout, setLayout] = useState<HeroLayout>(initialLayout)
  const [ready, setReady] = useState(() => readCachedLayout() !== null)

  useEffect(() => {
    let cancelled = false
    void apiGetHero()
      .then((next) => {
        if (cancelled) return
        setLayout(next)
        setReady(true)
        writeCachedLayout(next)
      })
      .catch(() => {
        if (cancelled) return
        if (readCachedLayout()) {
          setReady(true)
          return
        }
        setLayout(defaultLayout())
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async (next: HeroLayout) => {
    const stored = await apiSaveHero(next)
    setLayout(stored)
    writeCachedLayout(stored)
    return stored
  }, [])

  const restoreDefaults = useCallback(async () => {
    const stored = await apiResetHero()
    setLayout(stored)
    writeCachedLayout(stored)
    return stored
  }, [])

  const works = useMemo(() => layoutToWorks(layout), [layout])

  return {
    layout,
    works,
    ready,
    save,
    restoreDefaults,
  }
}
