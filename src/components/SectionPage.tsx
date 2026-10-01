import { useNavigate, useParams } from 'react-router-dom'
import { getSection } from '../data/sections'
import { SectionView } from './SectionView'
import { WorksIndex } from './WorksIndex'
import { useEffect } from 'react'

export function SectionPage() {
  const { sectionId } = useParams()
  const navigate = useNavigate()
  const section = getSection(sectionId ?? null)

  useEffect(() => {
    if (!section) navigate('/', { replace: true })
  }, [section, navigate])

  if (!section) return null
  if (section.id === 'trabajos') return <WorksIndex />
  return <SectionView section={section} />
}
