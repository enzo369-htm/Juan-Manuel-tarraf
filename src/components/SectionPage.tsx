import { useNavigate, useParams } from 'react-router-dom'
import { getSection } from '../data/sections'
import { SectionView } from './SectionView'
import { useEffect } from 'react'

export function SectionPage() {
  const { sectionId } = useParams()
  const navigate = useNavigate()
  const section = getSection(sectionId ?? null)

  useEffect(() => {
    if (!section) navigate('/', { replace: true })
  }, [section, navigate])

  if (!section) return null
  return <SectionView section={section} />
}
