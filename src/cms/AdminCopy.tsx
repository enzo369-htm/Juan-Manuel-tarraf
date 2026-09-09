import { useEffect, useState } from 'react'
import { getSection } from '../data/sections'
import { apiGetCopy, apiSaveCopy, apiUploadMedia } from './api'
import { BilingualField } from './BilingualField'

type Props = {
  slug: string
}

export function AdminCopy({ slug }: Props) {
  const section = getSection(slug)
  const isBio = slug === 'bio'
  const [body, setBody] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [portraitUrl, setPortraitUrl] = useState('')
  const [portraitScale, setPortraitScale] = useState(100)
  const [status, setStatus] = useState('Listo')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    void apiGetCopy(slug)
      .then((data) => {
        setBody(data.body)
        setBodyEn(data.bodyEn ?? '')
        setPortraitUrl(data.portraitUrl ?? '')
        setPortraitScale(data.portraitScale ?? 100)
      })
      .catch(() => {
        setBody('')
        setBodyEn('')
        setPortraitUrl('')
        setPortraitScale(100)
      })
  }, [slug])

  const onSave = async () => {
    setStatus('Guardando…')
    try {
      await apiSaveCopy(slug, {
        body,
        bodyEn,
        ...(isBio ? { portraitUrl, portraitScale } : {}),
      })
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    }
  }

  const onUpload = async (file: File) => {
    setUploading(true)
    setStatus('Subiendo…')
    try {
      const uploaded = await apiUploadMedia(file)
      if (!uploaded.url) throw new Error('La subida no devolvió URL')
      setPortraitUrl(uploaded.url)
      setStatus('Foto lista — guardá para publicar')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    } finally {
      setUploading(false)
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
      <div className={isBio ? 'admin-bio' : undefined}>
        <BilingualField
          label=""
          es={body}
          en={bodyEn}
          onEs={setBody}
          onEn={setBodyEn}
          multiline
          rows={16}
          inputClass="admin-copy"
          placeholderEs="Texto de la sección…"
          placeholderEn="Section text…"
        />
        {isBio && (
          <div className="admin-bio__photo">
            <div
              className="admin-bio__frame"
              style={{ width: `${portraitScale}%` }}
            >
              {portraitUrl ? (
                <img src={portraitUrl} alt="" />
              ) : (
                <span className="admin-bio__empty">Sin foto</span>
              )}
            </div>
            <label className="admin-bio__scale">
              Tamaño
              <input
                type="range"
                min={60}
                max={140}
                value={portraitScale}
                onChange={(e) => setPortraitScale(Number(e.target.value))}
              />
              <span>{portraitScale}%</span>
            </label>
            <div className="admin-bar__actions">
              <label className="admin-bar__btn">
                {uploading ? 'Subiendo…' : portraitUrl ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
              {portraitUrl && (
                <button type="button" className="admin-bar__btn" onClick={() => setPortraitUrl('')}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
