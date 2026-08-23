import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AdminPage } from './cms/AdminPage'
import { HeroCanvas } from './components/HeroCanvas'
import { SectionPage } from './components/SectionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeroCanvas />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/:sectionId" element={<SectionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
