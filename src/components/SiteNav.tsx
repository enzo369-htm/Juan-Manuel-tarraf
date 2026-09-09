import { Link, NavLink } from 'react-router-dom'
import { LangSwitch } from '../i18n/LangSwitch'
import { useLanguage } from '../i18n/LanguageContext'
import { NAV, navLabel } from '../i18n/ui'

export function SiteNav() {
  const { lang } = useLanguage()

  return (
    <header className="site-nav">
      <Link className="site-nav__brand" to="/">
        Juan M. Tarraf
      </Link>
      <div className="site-nav__end">
        <nav aria-label={lang === 'en' ? 'Sections' : 'Secciones'}>
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
        </nav>
        <LangSwitch />
      </div>
    </header>
  )
}
