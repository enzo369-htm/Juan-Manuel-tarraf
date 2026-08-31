import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FreeCanvas } from '../canvas/FreeCanvas'
import { getSection } from '../data/sections'
import {
  apiAddCanvas,
  apiDeleteCanvas,
  apiGetExhibition,
  apiGetPlacements,
  apiSavePlacements,
  apiUploadMedia,
  type CanvasPiece,
  type SectionCanvas,
} from './api'

const MAX_PER_KIND = 4

function blockKind(block: SectionCanvas): 'text' | 'canvas' {
  return block.kind === 'text' ? 'text' : 'canvas'
}

type Props = {
  slug: string
  exhibitionId?: string
}

export function AdminSectionCanvas({ slug, exhibitionId }: Props) {
  const section = getSection(slug)
  const [heading, setHeading] = useState(section?.label ?? slug)
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [selected, setSelected] = useState<{ canvasId: string; pieceId: string } | null>(null)
  const [status, setStatus] = useState('Listo')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileForCanvas = useRef<string | null>(null)

  const textCount = canvases.filter((block) => blockKind(block) === 'text').length
  const canvasCount = canvases.filter((block) => blockKind(block) === 'canvas').length

  const refresh = useCallback(async () => {
    const data = await apiGetPlacements(slug, exhibitionId)
    setCanvases(data.canvases)
    setDirty(false)
    setSelected(null)
  }, [slug, exhibitionId])

  useEffect(() => {
    if (!exhibitionId) {
      setHeading(section?.label ?? slug)
      return
    }
    void apiGetExhibition(exhibitionId)
      .then((data) => setHeading(data.exhibition.title))
      .catch(() => setHeading(section?.label ?? slug))
  }, [exhibitionId, section?.label, slug])

  useEffect(() => {
    void refresh().catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Error al cargar')
    })
  }, [refresh])

  const markDirty = (next: SectionCanvas[]) => {
    setCanvases(next)
    setDirty(true)
    setStatus('Sin guardar')
  }

  const onSave = async () => {
    setSaving(true)
    setStatus('Guardando…')
    try {
      const saved = await apiSavePlacements(slug, canvases, exhibitionId)
      if (saved.canvases) setCanvases(saved.canvases)
      setDirty(false)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onAdd = async (kind: 'text' | 'canvas') => {
    const count = kind === 'text' ? textCount : canvasCount
    if (count >= MAX_PER_KIND) return
    setStatus(kind === 'text' ? 'Agregando texto…' : 'Agregando lienzo…')
    try {
      const { canvas } = await apiAddCanvas(slug, kind, exhibitionId)
      setCanvases((prev) => [...prev, canvas])
      setStatus(kind === 'text' ? 'Texto agregado — guardá cuando lo edites' : 'Lienzo agregado — acordate de guardar las obras')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al agregar')
    }
  }

  const onRemove = async (canvasId: string) => {
    if (!window.confirm('¿Quitar este bloque?')) return
    setStatus('Quitando…')
    try {
      await apiDeleteCanvas(slug, canvasId, exhibitionId)
      setCanvases((prev) => prev.filter((canvas) => canvas.id !== canvasId))
      if (selected?.canvasId === canvasId) setSelected(null)
      setStatus('Quitado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al quitar')
    }
  }

  const onRemoveSelected = () => {
    if (!selected) return
    markDirty(
      canvases.map((canvas) =>
        canvas.id === selected.canvasId
          ? { ...canvas, pieces: canvas.pieces.filter((piece) => piece.id !== selected.pieceId) }
          : canvas,
      ),
    )
    setSelected(null)
    setStatus('Imagen quitada — guardá para confirmar')
  }

  const onUpload = async (file: File, canvasId: string) => {
    setUploading(true)
    setStatus('Subiendo…')
    try {
      const uploaded = await apiUploadMedia(file, slug, canvasId)
      if (!uploaded.url) throw new Error('La subida no devolvió URL')
      const piece: CanvasPiece = {
        id: uploaded.placementId || `tmp-${Date.now()}`,
        mediaId: uploaded.id,
        src: uploaded.url,
        x: 8,
        y: 8,
        width: 24,
      }
      markDirty(
        canvases.map((canvas) =>
          canvas.id === canvasId ? { ...canvas, pieces: [...canvas.pieces, piece] } : canvas,
        ),
      )
      setSelected({ canvasId, pieceId: piece.id })
      setStatus(uploaded.warning || 'Imagen agregada — acordate de guardar')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="admin-panel admin-panel--canvas">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">{exhibitionId ? 'Exposición' : 'Serie'}</p>
          <h1>{heading}</h1>
        </div>
        <div className="admin-bar__actions">
          {exhibitionId ? (
            <Link className="admin-bar__btn" to="/admin/exposiciones">
              Volver
            </Link>
          ) : null}
          <span className={`admin-bar__status${dirty ? ' is-dirty' : ''}`}>{status}</span>
          {selected && (
            <button type="button" className="admin-bar__btn admin-bar__btn--danger" onClick={onRemoveSelected}>
              Quitar imagen
            </button>
          )}
          <button
            type="button"
            className="admin-bar__btn"
            disabled={textCount >= MAX_PER_KIND}
            onClick={() => void onAdd('text')}
          >
            Agregar texto
          </button>
          <button
            type="button"
            className="admin-bar__btn"
            disabled={canvasCount >= MAX_PER_KIND}
            onClick={() => void onAdd('canvas')}
          >
            Agregar lienzo
          </button>
          <button
            type="button"
            className="admin-bar__btn admin-bar__btn--primary"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      {slug === 'trabajos' ? (
        <div className={`admin-ficha${selected ? '' : ' is-idle'}`}>
          <label htmlFor="ficha-tecnica">Ficha técnica</label>
          <textarea
            id="ficha-tecnica"
            className="admin-ficha__text"
            disabled={!selected}
            value={
              selected
                ? (canvases
                    .find((canvas) => canvas.id === selected.canvasId)
                    ?.pieces.find((piece) => piece.id === selected.pieceId)?.ficha ?? '')
                : ''
            }
            maxLength={2000}
            rows={4}
            placeholder={
              selected
                ? 'Un solo texto. Se ve a la izquierda al abrir la pintura.'
                : 'Seleccioná una pintura para añadir su ficha.'
            }
            onChange={(e) => {
              if (!selected) return
              markDirty(
                canvases.map((item) =>
                  item.id === selected.canvasId
                    ? {
                        ...item,
                        pieces: item.pieces.map((piece) =>
                          piece.id === selected.pieceId
                            ? { ...piece, ficha: e.target.value }
                            : piece,
                        ),
                      }
                    : item,
                ),
              )
            }}
          />
        </div>
      ) : null}

      <div className="admin-canvas-scroll">
        {canvases.length === 0 && (
          <p className="admin-canvas-empty">Todavía no hay nada. Agregá un texto o un lienzo.</p>
        )}
        {canvases.map((canvas, index) =>
          blockKind(canvas) === 'text' ? (
            <article key={canvas.id} className="admin-canvas-block admin-series-text">
              <div className="admin-canvas-block__bar">
                <p className="admin-bar__kicker">Texto {index + 1}</p>
                <button
                  type="button"
                  className="admin-bar__btn admin-bar__btn--danger"
                  onClick={() => void onRemove(canvas.id)}
                >
                  Quitar
                </button>
              </div>
              <input
                className="admin-series-text__title"
                value={canvas.title ?? ''}
                maxLength={200}
                placeholder="Título"
                onChange={(e) =>
                  markDirty(
                    canvases.map((item) =>
                      item.id === canvas.id ? { ...item, title: e.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                className="admin-series-text__body"
                value={canvas.description ?? ''}
                maxLength={1200}
                placeholder="Descripción corta"
                rows={4}
                onChange={(e) =>
                  markDirty(
                    canvases.map((item) =>
                      item.id === canvas.id ? { ...item, description: e.target.value } : item,
                    ),
                  )
                }
              />
            </article>
          ) : (
            <article key={canvas.id} className="admin-canvas-block">
              <div className="admin-canvas-block__bar">
                <p className="admin-bar__kicker">Lienzo {index + 1}</p>
                <div className="admin-bar__actions">
                  <label className="admin-bar__btn">
                    {uploading && fileForCanvas.current === canvas.id ? 'Subiendo…' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        fileForCanvas.current = canvas.id
                        if (file) void onUpload(file, canvas.id)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-bar__btn admin-bar__btn--danger"
                    onClick={() => void onRemove(canvas.id)}
                  >
                    Quitar lienzo
                  </button>
                </div>
              </div>
              <FreeCanvas
                pieces={canvas.pieces}
                heightRatio={canvas.heightRatio}
                heightInputId={`canvas-height-${canvas.id}`}
                selectedId={selected?.canvasId === canvas.id ? selected.pieceId : null}
                onSelect={(pieceId) =>
                  setSelected(pieceId ? { canvasId: canvas.id, pieceId } : null)
                }
                onChange={(pieces) =>
                  markDirty(
                    canvases.map((item) => (item.id === canvas.id ? { ...item, pieces } : item)),
                  )
                }
                onHeightRatioChange={(heightRatio) =>
                  markDirty(
                    canvases.map((item) =>
                      item.id === canvas.id ? { ...item, heightRatio } : item,
                    ),
                  )
                }
              />
            </article>
          ),
        )}
      </div>
    </section>
  )
}
