import { useCallback, useEffect, useRef, useState } from 'react'
import { FreeCanvas } from '../canvas/FreeCanvas'
import { getSection } from '../data/sections'
import { apiGetPlacements, apiSavePlacements, apiUploadMedia, type CanvasPiece } from './api'

type Props = {
  slug: string
}

export function AdminSectionCanvas({ slug }: Props) {
  const section = getSection(slug)
  const [pieces, setPieces] = useState<CanvasPiece[]>([])
  const [heightRatio, setHeightRatio] = useState(1.2)
  const [status, setStatus] = useState('Listo')
  const saveTimer = useRef<number>(0)

  const refresh = useCallback(async () => {
    try {
      const data = await apiGetPlacements(slug)
      setPieces(data.pieces)
      setHeightRatio(data.heightRatio ?? 1.2)
    } catch {
      setPieces([])
    }
  }, [slug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = async (next: CanvasPiece[], ratio: number) => {
    setStatus('Guardando…')
    try {
      await apiSavePlacements(slug, next, ratio)
      setStatus('Guardado')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error')
    }
  }

  const scheduleSave = (next: CanvasPiece[], ratio: number) => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void persist(next, ratio)
    }, 450)
  }

  const onChange = (next: CanvasPiece[]) => {
    setPieces(next)
    scheduleSave(next, heightRatio)
  }

  const onHeightRatioChange = (ratio: number) => {
    setHeightRatio(ratio)
    scheduleSave(pieces, ratio)
  }

  const onUpload = async (file: File) => {
    setStatus('Subiendo…')
    try {
      await apiUploadMedia(file, slug)
      await refresh()
      setStatus('Imagen cargada')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al subir')
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
          <span className="admin-bar__status">{status}</span>
          <label className="admin-bar__btn">
            Subir imagen
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUpload(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>
      <FreeCanvas
        pieces={pieces}
        onChange={onChange}
        heightRatio={heightRatio}
        onHeightRatioChange={onHeightRatioChange}
      />
    </section>
  )
}
