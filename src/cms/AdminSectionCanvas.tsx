import { useCallback, useEffect, useRef, useState } from 'react'
import { FreeCanvas } from '../canvas/FreeCanvas'
import { getSection } from '../data/sections'
import {
  apiAddCanvas,
  apiDeleteCanvas,
  apiGetPlacements,
  apiSavePlacements,
  apiUploadMedia,
  type CanvasPiece,
  type SectionCanvas,
} from './api'

const MAX_CANVASES = 3

type Props = {
  slug: string
}

export function AdminSectionCanvas({ slug }: Props) {
  const section = getSection(slug)
  const [canvases, setCanvases] = useState<SectionCanvas[]>([])
  const [selected, setSelected] = useState<{ canvasId: string; pieceId: string } | null>(null)
  const [status, setStatus] = useState('Listo')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileForCanvas = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const data = await apiGetPlacements(slug)
    setCanvases(data.canvases)
    setDirty(false)
    setSelected(null)
  }, [slug])

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
      const saved = await apiSavePlacements(slug, canvases)
      if (saved.canvases?.length) setCanvases(saved.canvases)
      setDirty(false)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onAddCanvas = async () => {
    if (canvases.length >= MAX_CANVASES) return
    setStatus('Agregando lienzo…')
    try {
      const { canvas } = await apiAddCanvas(slug)
      setCanvases((prev) => [...prev, canvas])
      setStatus('Lienzo agregado — acordate de guardar las obras')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al agregar lienzo')
    }
  }

  const onRemoveCanvas = async (canvasId: string) => {
    if (canvases.length <= 1) return
    if (!window.confirm('¿Quitar este lienzo y sus imágenes?')) return
    setStatus('Quitando lienzo…')
    try {
      await apiDeleteCanvas(slug, canvasId)
      setCanvases((prev) => prev.filter((canvas) => canvas.id !== canvasId))
      if (selected?.canvasId === canvasId) setSelected(null)
      setStatus('Lienzo quitado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al quitar lienzo')
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
          <p className="admin-bar__kicker">Lienzo</p>
          <h1>{section?.label ?? slug}</h1>
        </div>
        <div className="admin-bar__actions">
          <span className={`admin-bar__status${dirty ? ' is-dirty' : ''}`}>{status}</span>
          {selected && (
            <button type="button" className="admin-bar__btn admin-bar__btn--danger" onClick={onRemoveSelected}>
              Quitar imagen
            </button>
          )}
          <button
            type="button"
            className="admin-bar__btn"
            disabled={canvases.length >= MAX_CANVASES}
            onClick={() => void onAddCanvas()}
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

      <div className="admin-canvas-scroll">
        {canvases.map((canvas, index) => (
          <article key={canvas.id} className="admin-canvas-block">
            <div className="admin-canvas-block__bar">
              <p className="admin-bar__kicker">
                Lienzo {index + 1} / {canvases.length}
              </p>
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
                {canvases.length > 1 && (
                  <button
                    type="button"
                    className="admin-bar__btn admin-bar__btn--danger"
                    onClick={() => void onRemoveCanvas(canvas.id)}
                  >
                    Quitar lienzo
                  </button>
                )}
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
        ))}
      </div>
    </section>
  )
}
