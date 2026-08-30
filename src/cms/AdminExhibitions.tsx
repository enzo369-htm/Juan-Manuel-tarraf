import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiCreateExhibition,
  apiDeleteExhibition,
  apiListExhibitions,
  apiSaveExhibition,
  apiUploadMedia,
  type Exhibition,
} from './api'

export function AdminExhibitions() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [editing, setEditing] = useState<Exhibition | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [status, setStatus] = useState('Listo')
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const data = await apiListExhibitions()
    setExhibitions(data.exhibitions)
  }

  useEffect(() => {
    void load().catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Error al cargar')
    })
  }, [])

  const openNew = () => {
    setEditing('new')
    setTitle('')
    setDescription('')
    setCoverUrl('')
    setCoverMediaId('')
    setStatus('Nueva exposición')
  }

  const openEdit = (entry: Exhibition) => {
    setEditing(entry)
    setTitle(entry.title)
    setDescription(entry.description)
    setCoverUrl(entry.coverUrl ?? '')
    setCoverMediaId(entry.coverMediaId ?? '')
    setStatus('Editando')
  }

  const onUploadCover = async (file: File) => {
    setUploading(true)
    setStatus('Subiendo portada…')
    try {
      const uploaded = await apiUploadMedia(file)
      if (!uploaded.id || !uploaded.url) throw new Error('La subida no devolvió URL')
      setCoverMediaId(uploaded.id)
      setCoverUrl(uploaded.url)
      setStatus('Portada lista — guardá para publicar')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  const onSave = async () => {
    if (!title.trim()) {
      setStatus('El título es obligatorio')
      return
    }
    setStatus('Guardando…')
    try {
      const payload = {
        title: title.trim(),
        description,
        ...(coverMediaId ? { coverMediaId } : {}),
      }
      if (editing === 'new') {
        await apiCreateExhibition(payload)
      } else if (editing) {
        await apiSaveExhibition(editing.id, payload)
      }
      await load()
      setEditing(null)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al guardar')
    }
  }

  const onDelete = async () => {
    if (!editing || editing === 'new') return
    if (!window.confirm('¿Quitar esta exposición y todas sus fotos?')) return
    setStatus('Quitando…')
    try {
      await apiDeleteExhibition(editing.id)
      await load()
      setEditing(null)
      setStatus('Exposición quitada')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al quitar')
    }
  }

  return (
    <section className="admin-panel admin-panel--texts">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Exposiciones</p>
          <h1>
            {editing === 'new' ? 'Crear exposición' : editing ? 'Editar exposición' : 'Exposiciones'}
          </h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          {editing ? (
            <>
              {editing !== 'new' && (
                <button
                  type="button"
                  className="admin-bar__btn admin-bar__btn--danger"
                  onClick={() => void onDelete()}
                >
                  Quitar
                </button>
              )}
              <button type="button" className="admin-bar__btn" onClick={() => setEditing(null)}>
                Volver
              </button>
              <button
                type="button"
                className="admin-bar__btn admin-bar__btn--primary"
                onClick={() => void onSave()}
              >
                Guardar
              </button>
            </>
          ) : (
            <button type="button" className="admin-bar__btn admin-bar__btn--primary" onClick={openNew}>
              Crear exposición
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <form
          className="admin-text-form"
          onSubmit={(e) => {
            e.preventDefault()
            void onSave()
          }}
        >
          <label className="admin-login__label">
            Título
            <input
              className="admin-login__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="admin-login__label">
            Descripción
            <textarea
              className="admin-copy admin-copy--short"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional. No se muestra en la grilla."
            />
          </label>
          <div className="admin-expo-cover">
            <div className="admin-expo-cover__frame">
              {coverUrl ? <img src={coverUrl} alt="" /> : <span>Sin portada</span>}
            </div>
            <label className="admin-bar__btn">
              {uploading ? 'Subiendo…' : coverUrl ? 'Cambiar portada' : 'Subir portada'}
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
            {editing !== 'new' && (
              <Link className="admin-bar__btn admin-bar__btn--primary" to={`/admin/exposiciones/${editing.id}`}>
                Editar fotos
              </Link>
            )}
          </div>
        </form>
      ) : (
        <ul className="admin-expo-list">
          {exhibitions.length === 0 && (
            <li className="admin-text-list__empty">Todavía no hay exposiciones.</li>
          )}
          {exhibitions.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="admin-expo-list__item" onClick={() => openEdit(entry)}>
                <span className="admin-expo-list__thumb">
                  {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span />}
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <em>Portada y título</em>
                </span>
              </button>
              <Link className="admin-bar__btn" to={`/admin/exposiciones/${entry.id}`}>
                Fotos
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
