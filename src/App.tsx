import { useLayoutEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AdminPage } from './cms/AdminPage'
import { HeroCanvas } from './components/HeroCanvas'
import { SectionPage } from './components/SectionPage'

function PageScrollMode() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    const allowScroll = pathname !== '/' && !pathname.startsWith('/admin')
    document.documentElement.classList.toggle('page-scroll', allowScroll)
    return () => document.documentElement.classList.remove('page-scroll')
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <PageScrollMode />
      <Routes>
        <Route path="/" element={<HeroCanvas />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/:sectionId" element={<SectionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
