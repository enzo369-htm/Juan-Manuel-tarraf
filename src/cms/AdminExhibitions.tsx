import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiCreateExhibition, apiListExhibitions, type Exhibition } from './api'

export function AdminExhibitions() {
  const navigate = useNavigate()
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [status, setStatus] = useState('Listo')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void apiListExhibitions()
      .then((data) => setExhibitions(data.exhibitions))
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Error al cargar')
      })
  }, [])

  const onCreate = async () => {
    setCreating(true)
    setStatus('Creando…')
    try {
      const { exhibition } = await apiCreateExhibition({ title: 'Nueva exposición' })
      navigate(`/admin/exposiciones/${exhibition.id}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al crear')
      setCreating(false)
    }
  }

  return (
    <section className="admin-panel admin-panel--texts">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Exposiciones</p>
          <h1>Exposiciones</h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          <button
            type="button"
            className="admin-bar__btn admin-bar__btn--primary"
            disabled={creating}
            onClick={() => void onCreate()}
          >
            {creating ? 'Creando…' : 'Crear exposición'}
          </button>
        </div>
      </header>

      <ul className="admin-expo-list">
        {exhibitions.length === 0 && (
          <li className="admin-text-list__empty">Todavía no hay exposiciones.</li>
        )}
        {exhibitions.map((entry) => (
          <li key={entry.id}>
            <Link className="admin-expo-list__item" to={`/admin/exposiciones/${entry.id}`}>
              <span className="admin-expo-list__thumb">
                {entry.coverUrl ? <img src={entry.coverUrl} alt="" /> : <span />}
              </span>
              <span>
                <strong>{entry.title}</strong>
                <em>Abrir</em>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
