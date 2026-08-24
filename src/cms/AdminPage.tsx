import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminCopy } from './AdminCopy'
import { AdminEditor } from './AdminEditor'
import { AdminGate } from './AdminGate'
import { AdminSectionCanvas } from './AdminSectionCanvas'
import { AdminShell } from './AdminShell'
import { AdminTexts } from './AdminTexts'
import './admin.css'

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
          <Route path="exposiciones" element={<AdminSectionCanvas slug="exposiciones" />} />
          <Route path="archivos" element={<AdminSectionCanvas slug="archivos" />} />
        </Route>
      </Route>
    </Routes>
  )
}
