import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiCreateSeries, apiListSeries, type WorkSeries } from './api'

export function AdminWorks() {
  const navigate = useNavigate()
  const [series, setSeries] = useState<WorkSeries[]>([])
  const [status, setStatus] = useState('Listo')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void apiListSeries()
      .then((data) => setSeries(data.series))
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Error al cargar')
      })
  }, [])

  const onCreate = async () => {
    setCreating(true)
    setStatus('Creando…')
    try {
      const { series: created } = await apiCreateSeries({ title: 'Nueva serie' })
      navigate(`/admin/trabajos/${created.id}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al crear')
      setCreating(false)
    }
  }

  return (
    <section className="admin-panel admin-panel--texts">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Trabajos</p>
          <h1>Trabajos</h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          <button
            type="button"
            className="admin-bar__btn admin-bar__btn--primary"
            disabled={creating}
            onClick={() => void onCreate()}
          >
            {creating ? 'Creando…' : 'Crear serie'}
          </button>
        </div>
      </header>

      <ul className="admin-series-list">
        {series.length === 0 && <li className="admin-text-list__empty">Todavía no hay series.</li>}
        {series.map((entry) => (
          <li key={entry.id}>
            <Link className="admin-series-list__item" to={`/admin/trabajos/${entry.id}`}>
              <strong>{entry.title}</strong>
              <em>Abrir</em>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
