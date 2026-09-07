import { useEffect, useState } from 'react'
import { apiGetCopy, apiSaveCopy } from './api'

export function AdminContact() {
  const [instagramHandle, setInstagramHandle] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('Listo')

  useEffect(() => {
    void apiGetCopy('contacto')
      .then((data) => {
        setInstagramHandle(data.instagramHandle ?? '')
        setInstagramUrl(data.instagramUrl ?? '')
        setEmail(data.email ?? '')
      })
      .catch(() => {
        setInstagramHandle('')
        setInstagramUrl('')
        setEmail('')
      })
  }, [])

  const onSave = async () => {
    setStatus('Guardando…')
    try {
      await apiSaveCopy('contacto', { instagramHandle, instagramUrl, email })
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    }
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel__head">
        <div>
          <p className="admin-bar__kicker">Contacto</p>
          <h1>Contacto</h1>
        </div>
        <div className="admin-bar__actions">
          <span className="admin-bar__status">{status}</span>
          <button type="button" className="admin-bar__btn admin-bar__btn--primary" onClick={() => void onSave()}>
            Guardar
          </button>
        </div>
      </header>
      <form
        className="admin-contact"
        onSubmit={(e) => {
          e.preventDefault()
          void onSave()
        }}
        noValidate
      >
        <div className="admin-contact__block">
          <p className="admin-bar__kicker">Instagram</p>
          <label className="admin-login__label">
            Nombre de la cuenta
            <input
              className="admin-login__input"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="@juantarraf"
              autoComplete="off"
            />
          </label>
          <label className="admin-login__label">
            Link
            <input
              className="admin-login__input"
              type="text"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://www.instagram.com/juantarraf"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="admin-contact__block">
          <p className="admin-bar__kicker">Correo</p>
          <label className="admin-login__label">
            Correo
            <input
              className="admin-login__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hola@ejemplo.com"
              autoComplete="off"
            />
          </label>
        </div>
      </form>
    </section>
  )
}
