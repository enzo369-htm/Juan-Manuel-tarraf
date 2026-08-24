import { Link, NavLink } from 'react-router-dom'

const NAV = [
  { id: 'trabajos', label: 'Trabajos' },
  { id: 'exposiciones', label: 'Exposiciones' },
  { id: 'textos', label: 'Textos' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'bio', label: 'Bio' },
  { id: 'contacto', label: 'Contacto' },
] as const

export function SiteNav() {
  return (
    <header className="site-nav">
      <Link className="site-nav__brand" to="/">
        Juan Tarraf
      </Link>
      <nav aria-label="Secciones">
        <ul className="site-nav__list">
          {NAV.map((item) => (
            <li key={item.id}>
              <NavLink
                to={`/${item.id}`}
                className={({ isActive }) =>
                  `site-nav__link${isActive ? ' is-active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
