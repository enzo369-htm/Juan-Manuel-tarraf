import { useEffect, useState } from 'react'
import {
  apiCreateText,
  apiDeleteText,
  apiGetText,
  apiListTexts,
  apiSaveText,
  apiUploadMedia,
  type TextEntry,
} from './api'
import { BilingualField } from './BilingualField'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function AdminTexts() {
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [editing, setEditing] = useState<TextEntry | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [body, setBody] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('Listo')

  const load = async () => {
    const data = await apiListTexts()
    setTexts(data.texts)
  }

  useEffect(() => {
    void load().catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Error al cargar')
    })
  }, [])

  const openNew = () => {
    setEditing('new')
    setTitle('')
    setTitleEn('')
    setDescription('')
    setDescriptionEn('')
    setBody('')
    setBodyEn('')
    setCoverUrl('')
    setCoverMediaId('')
    setStatus('Nuevo texto')
  }

  const openEdit = (entry: TextEntry) => {
    setEditing(entry)
    setTitle(entry.title)
    setTitleEn(entry.titleEn ?? '')
    setDescription(entry.description)
    setDescriptionEn(entry.descriptionEn ?? '')
    setBody(entry.body ?? '')
    setBodyEn(entry.bodyEn ?? '')
    setCoverUrl(entry.coverUrl ?? '')
    setCoverMediaId(entry.coverMediaId ?? '')
    setStatus('Editando')
    void apiGetText(entry.id)
      .then((data) => {
        setEditing(data.text)
        setTitle(data.text.title)
        setTitleEn(data.text.titleEn ?? '')
        setDescription(data.text.description)
        setDescriptionEn(data.text.descriptionEn ?? '')
        setBody(data.text.body ?? '')
        setBodyEn(data.text.bodyEn ?? '')
        setCoverUrl(data.text.coverUrl ?? '')
        setCoverMediaId(data.text.coverMediaId ?? '')
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Error al abrir')
      })
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
        body,
        titleEn,
        descriptionEn,
        bodyEn,
        ...(coverMediaId ? { coverMediaId } : {}),
      }
      if (editing === 'new') {
        await apiCreateText(payload)
      } else if (editing) {
        await apiSaveText(editing.id, payload)
      }
      await load()
      setEditing(null)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al guardar')
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
      setStatus('Portada lista — guardá para publicar')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async () => {
    if (!editing || editing === 'new') return
    if (!window.confirm('¿Quitar este texto?')) return
    setStatus('Quitando…')
    try {
      await apiDeleteText(editing.id)
      await load()
      setEditing(null)
      setStatus('Texto quitado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al quitar')
    }
  }

  return (
    <section className="admin-panel admin-panel--texts">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Textos</p>
          <h1>{editing === 'new' ? 'Crear texto' : editing ? 'Editar texto' : 'Textos'}</h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          {editing ? (
            <>
              {editing !== 'new' && (
                <button type="button" className="admin-bar__btn admin-bar__btn--danger" onClick={() => void onDelete()}>
                  Quitar
                </button>
              )}
              <button type="button" className="admin-bar__btn" onClick={() => setEditing(null)}>
                Volver
              </button>
              <button type="button" className="admin-bar__btn admin-bar__btn--primary" onClick={() => void onSave()}>
                Guardar
              </button>
            </>
          ) : (
            <button type="button" className="admin-bar__btn admin-bar__btn--primary" onClick={openNew}>
              Crear texto
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
          <BilingualField
            label="Título"
            es={title}
            en={titleEn}
            onEs={setTitle}
            onEn={setTitleEn}
            required
            maxLength={200}
            inputClass="admin-login__input"
          />
          <BilingualField
            label="Descripción"
            es={description}
            en={descriptionEn}
            onEs={setDescription}
            onEn={setDescriptionEn}
            multiline
            rows={3}
            inputClass="admin-copy admin-copy--short"
            placeholderEs="Una o dos líneas que se ven en el listado."
            placeholderEn="One or two lines shown in the list."
          />
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
          </div>
          <BilingualField
            label="Cuerpo"
            es={body}
            en={bodyEn}
            onEs={setBody}
            onEn={setBodyEn}
            multiline
            rows={12}
            inputClass="admin-copy"
            placeholderEs="El texto completo que se lee al entrar."
            placeholderEn="The full text shown on the article page."
          />
        </form>
      ) : (
        <ul className="admin-text-list">
          {texts.length === 0 && <li className="admin-text-list__empty">Todavía no hay textos.</li>}
          {texts.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="admin-text-list__item" onClick={() => openEdit(entry)}>
                <span className="admin-text-list__thumb">
                  {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span />}
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <span>{formatDate(entry.created_at)}</span>
                  {entry.description && <p>{entry.description}</p>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
