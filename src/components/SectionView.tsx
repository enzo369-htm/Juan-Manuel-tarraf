import { useEffect, useState } from 'react'
import { CanvasViewer } from '../canvas/CanvasViewer'
import { apiGetCopy, apiGetPlacements, type SectionCanvas, type SectionCopy } from '../cms/api'
import type { Section } from '../data/sections'
import { pick } from '../i18n/lang'
import { useLanguage } from '../i18n/LanguageContext'
import { navLabel } from '../i18n/ui'
import { ContactView } from './ContactView'
import { SiteNav } from './SiteNav'

const CANVAS_SECTIONS = new Set(['trabajos', 'exposiciones', 'archivos'])

const EMPTY_COPY: SectionCopy = { slug: '', body: '', bodyEn: '' }

type Props = {
  section: Section
}

export function SectionView({ section }: Props) {
  const { lang, ui } = useLanguage()
  const [copy, setCopy] = useState<SectionCopy>(EMPTY_COPY)
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [ready, setReady] = useState(false)
  const [loadedId, setLoadedId] = useState(section.id)

  if (loadedId !== section.id) {
    setLoadedId(section.id)
    setReady(false)
    setCopy(EMPTY_COPY)
    setCanvases([])
  }

  useEffect(() => {
    let cancelled = false

    const copyReq = apiGetCopy(section.id)
      .then((data) => {
        if (!cancelled) setCopy(data)
      })
      .catch(() => {
        if (!cancelled) setCopy({ ...EMPTY_COPY, slug: section.id })
      })

    const placements = CANVAS_SECTIONS.has(section.id)
      ? apiGetPlacements(section.id)
          .then((data) => {
            if (!cancelled) setCanvases(data.canvases)
          })
          .catch(() => {
            if (!cancelled) setCanvases([])
          })
      : Promise.resolve()

    void Promise.all([copyReq, placements]).finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [section.id])

  const isBio = section.id === 'bio'
  const isContact = section.id === 'contacto'
  const label = navLabel(section.id, lang)
  const body = pick(copy.body, copy.bodyEn, lang)

  const hasCanvasContent = canvases.some((block) => {
    if (block.kind === 'text') {
      return Boolean(pick(block.title, block.titleEn, lang) || pick(block.description, block.descriptionEn, lang))
    }
    return block.pieces.length > 0
  })

  return (
    <section
      className={`section-view${isContact ? ' section-view--contact' : ''}`}
      aria-label={label}
    >
      <SiteNav />

      {!ready ? null : isBio ? (
        <div
          className="bio"
          style={{ ['--bio-portrait-scale' as string]: String(copy.portraitScale ?? 100) }}
        >
          <div className="bio__text">{body}</div>
          <div className="bio__portrait">
            {copy.portraitUrl ? <img src={copy.portraitUrl} alt="" /> : <span aria-hidden />}
          </div>
        </div>
      ) : isContact ? (
        <ContactView
          instagramHandle={copy.instagramHandle ?? ''}
          instagramUrl={copy.instagramUrl ?? ''}
          email={copy.email ?? ''}
        />
      ) : (
        <div className="section-view__body">
          {CANVAS_SECTIONS.has(section.id)
            ? canvases.map((block) => {
                if (block.kind === 'text') {
                  const title = pick(block.title, block.titleEn, lang)
                  const description = pick(block.description, block.descriptionEn, lang)
                  if (!title && !description) return null
                  return (
                    <div key={block.id} className="series-intro">
                      {title ? <h2 className="series-intro__title">{title}</h2> : null}
                      {description ? <p className="series-intro__text">{description}</p> : null}
                    </div>
                  )
                }
                if (block.pieces.length === 0) return null
                return (
                  <CanvasViewer
                    key={block.id}
                    heightRatio={block.heightRatio}
                    zoomOnClick={section.id === 'trabajos'}
                    items={block.pieces.map((piece) => ({
                      id: piece.id,
                      imageUrl: piece.src,
                      x: piece.x,
                      y: piece.y,
                      width: piece.width,
                      ficha: piece.ficha,
                      fichaEn: piece.fichaEn,
                    }))}
                  />
                )
              })
            : null}
          {!CANVAS_SECTIONS.has(section.id) && body && (
            <div className="section-view__copy">{body}</div>
          )}
          {CANVAS_SECTIONS.has(section.id) && !hasCanvasContent && (
            <p className="section-view__note">{ui.emptySection(label)}</p>
          )}
          {!CANVAS_SECTIONS.has(section.id) && !body && (
            <p className="section-view__note">{ui.emptySection(label)}</p>
          )}
        </div>
      )}
    </section>
  )
}
