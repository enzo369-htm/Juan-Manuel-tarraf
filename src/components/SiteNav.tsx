import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LangSwitch } from '../i18n/LangSwitch'
import { useLanguage } from '../i18n/LanguageContext'
import { NAV, navLabel } from '../i18n/ui'

export function SiteNav() {
  const { lang, ui } = useLanguage()
  const { pathname } = useLocation()
  const menuId = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 801px)')
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <header className={`site-nav${open ? ' is-open' : ''}`}>
      <Link className="site-nav__brand" to="/">
        Juan M. Tarraf
      </Link>
      <button
        type="button"
        className="site-nav__toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? ui.closeMenu : ui.openMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="site-nav__burger" aria-hidden="true" />
      </button>
      <nav id={menuId} aria-label={lang === 'en' ? 'Sections' : 'Secciones'}>
        <ul className="site-nav__list">
          {NAV.map((item) => (
            <li key={item.id}>
              <NavLink
                to={`/${item.id}`}
                className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}
              >
                {navLabel(item.id, lang)}
              </NavLink>
            </li>
          ))}
        </ul>
        <LangSwitch />
      </nav>
    </header>
  )
}
