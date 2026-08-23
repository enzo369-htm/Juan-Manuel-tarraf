import { useEffect, useState } from 'react'
import { getSection } from '../data/sections'
import { apiGetCopy, apiSaveCopy } from './api'

type Props = {
  slug: string
}

export function AdminCopy({ slug }: Props) {
  const section = getSection(slug)
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('Listo')

  useEffect(() => {
    void apiGetCopy(slug)
      .then((data) => setBody(data.body))
      .catch(() => setBody(''))
  }, [slug])

  const onSave = async () => {
    setStatus('Guardando…')
    try {
      await apiSaveCopy(slug, body)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    }
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Texto</p>
          <h1>{section?.label ?? slug}</h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          <button type="button" className="admin-bar__btn admin-bar__btn--primary" onClick={() => void onSave()}>
            Guardar
          </button>
        </div>
      </header>
      <textarea
        className="admin-copy"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Texto de la sección…"
      />
    </section>
  )
}
