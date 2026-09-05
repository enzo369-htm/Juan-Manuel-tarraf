import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FreeCanvas } from '../canvas/FreeCanvas'
import { getSection } from '../data/sections'
import {
  apiAddCanvas,
  apiDeleteCanvas,
  apiDeleteExhibition,
  apiGetExhibition,
  apiGetPlacements,
  apiSaveExhibition,
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
  const navigate = useNavigate()
  const [heading, setHeading] = useState(section?.label ?? slug)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
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
      setTitle('')
      setDescription('')
      setCoverUrl('')
      setCoverMediaId('')
      return
    }
    void apiGetExhibition(exhibitionId)
      .then((data) => {
        setHeading(data.exhibition.title)
        setTitle(data.exhibition.title)
        setDescription(data.exhibition.description)
        setCoverUrl(data.exhibition.coverUrl ?? '')
        setCoverMediaId(data.exhibition.coverMediaId ?? '')
      })
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

  const markMetaDirty = () => {
    setDirty(true)
    setStatus('Sin guardar')
  }

  const onSave = async () => {
    if (exhibitionId && !title.trim()) {
      setStatus('El título es obligatorio')
      return
    }
    setSaving(true)
    setStatus('Guardando…')
    try {
      if (exhibitionId) {
        const savedExpo = await apiSaveExhibition(exhibitionId, {
          title: title.trim(),
          description,
          ...(coverMediaId ? { coverMediaId } : {}),
        })
        setHeading(savedExpo.exhibition.title)
        setTitle(savedExpo.exhibition.title)
        setCoverUrl(savedExpo.exhibition.coverUrl ?? coverUrl)
        setCoverMediaId(savedExpo.exhibition.coverMediaId ?? coverMediaId)
      }
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

  const onUploadCover = async (file: File) => {
    setUploading(true)
    setStatus('Subiendo portada…')
    try {
      const uploaded = await apiUploadMedia(file)
      if (!uploaded.id || !uploaded.url) throw new Error('La subida no devolvió URL')
      setCoverMediaId(uploaded.id)
      setCoverUrl(uploaded.url)
      markMetaDirty()
      setStatus('Portada lista — guardá para publicar')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  const onDeleteExhibition = async () => {
    if (!exhibitionId) return
    if (!window.confirm('¿Quitar esta exposición y todas sus fotos?')) return
    setStatus('Quitando…')
    try {
      await apiDeleteExhibition(exhibitionId)
      navigate('/admin/exposiciones')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al quitar')
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
            <>
              <Link className="admin-bar__btn" to="/admin/exposiciones">
                Volver
              </Link>
              <button
                type="button"
                className="admin-bar__btn admin-bar__btn--danger"
                onClick={() => void onDeleteExhibition()}
              >
                Quitar
              </button>
            </>
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
        {exhibitionId ? (
          <div className="admin-expo-meta">
            <label className="admin-login__label">
              Título
              <input
                className="admin-series-text__title"
                value={title}
                maxLength={200}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setHeading(e.target.value || 'Exposición')
                  markMetaDirty()
                }}
              />
            </label>
            <div className="admin-expo-cover">
              <div className="admin-expo-cover__frame">
                {coverUrl ? <img src={coverUrl} alt="" /> : <span>Sin portada</span>}
              </div>
              <label className="admin-bar__btn">
                {uploading && !fileForCanvas.current
                  ? 'Subiendo…'
                  : coverUrl
                    ? 'Cambiar portada'
                    : 'Subir portada'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onUploadCover(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
        {canvases.length === 0 && (
          <p className="admin-canvas-empty">
            {exhibitionId
              ? 'Agregá un texto o un lienzo para el contenido de la muestra.'
              : 'Todavía no hay nada. Agregá un texto o un lienzo.'}
          </p>
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
