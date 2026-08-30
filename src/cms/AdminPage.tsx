import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AdminCopy } from './AdminCopy'
import { AdminEditor } from './AdminEditor'
import { AdminExhibitions } from './AdminExhibitions'
import { AdminGate } from './AdminGate'
import { AdminSectionCanvas } from './AdminSectionCanvas'
import { AdminShell } from './AdminShell'
import { AdminTexts } from './AdminTexts'
import './admin.css'

function AdminExhibitionCanvas() {
  const { id } = useParams()
  if (!id) return <Navigate to="/admin/exposiciones" replace />
  return <AdminSectionCanvas slug="exposiciones" exhibitionId={id} />
}

export function AdminPage() {
  return (
    <Routes>
      <Route element={<AdminGate />}>
        <Route element={<AdminShell />}>
          <Route index element={<Navigate to="hero" replace />} />
          <Route path="hero" element={<AdminEditor />} />
          <Route path="bio" element={<AdminCopy slug="bio" />} />
          <Route path="textos" element={<AdminTexts />} />
          <Route path="contacto" element={<AdminCopy slug="contacto" />} />
          <Route path="trabajos" element={<AdminSectionCanvas slug="trabajos" />} />
          <Route path="exposiciones/:id" element={<AdminExhibitionCanvas />} />
          <Route path="exposiciones" element={<AdminExhibitions />} />
          <Route path="archivos" element={<AdminSectionCanvas slug="archivos" />} />
        </Route>
      </Route>
    </Routes>
  )
}
