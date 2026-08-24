import { useEffect, useState } from 'react'
import {
  apiCreateText,
  apiDeleteText,
  apiGetText,
  apiListTexts,
  apiSaveText,
  type TextEntry,
} from './api'

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function AdminTexts() {
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [editing, setEditing] = useState<TextEntry | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
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
    setDescription('')
    setBody('')
    setStatus('Nuevo texto')
  }

  const openEdit = (entry: TextEntry) => {
    setEditing(entry)
    setTitle(entry.title)
    setDescription(entry.description)
    setBody(entry.body ?? '')
    setStatus('Editando')
    void apiGetText(entry.id)
      .then((data) => {
        setEditing(data.text)
        setTitle(data.text.title)
        setDescription(data.text.description)
        setBody(data.text.body ?? '')
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
      const payload = { title: title.trim(), description, body }
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
              placeholder="Una o dos líneas que se ven en el listado."
            />
          </label>
          <label className="admin-login__label">
            Cuerpo
            <textarea
              className="admin-copy"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="El texto completo que se lee al entrar."
            />
          </label>
        </form>
      ) : (
        <ul className="admin-text-list">
          {texts.length === 0 && <li className="admin-text-list__empty">Todavía no hay textos.</li>}
          {texts.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="admin-text-list__item" onClick={() => openEdit(entry)}>
                <strong>{entry.title}</strong>
                <span>{formatDate(entry.created_at)}</span>
                {entry.description && <p>{entry.description}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
