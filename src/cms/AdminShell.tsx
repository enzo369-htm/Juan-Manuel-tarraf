import { NavLink, Outlet } from 'react-router-dom'
import { logoutAdmin } from './auth'

const links = [
  { to: '/admin/hero', label: 'Hero' },
  { to: '/admin/trabajos', label: 'Trabajos' },
  { to: '/admin/bio', label: 'Bio' },
  { to: '/admin/exposiciones', label: 'Exposiciones' },
  { to: '/admin/textos', label: 'Textos' },
  { to: '/admin/archivos', label: 'Archivos' },
  { to: '/admin/contacto', label: 'Contacto' },
]

export function AdminShell() {
  return (
    <div className="admin-app">
      <aside className="admin-nav">
        <p className="admin-nav__kicker">CMS</p>
        <strong className="admin-nav__brand">Juan Tarraf</strong>
        <nav className="admin-nav__list">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `admin-nav__link${isActive ? ' is-active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-nav__foot">
          <a className="admin-nav__link" href="/" target="_blank" rel="noreferrer">
            Ver sitio
          </a>
          <button
            type="button"
            className="admin-nav__link admin-nav__button"
            onClick={() => {
              void logoutAdmin().finally(() => {
                window.location.href = '/admin'
              })
            }}
          >
            Salir
          </button>
        </div>
      </aside>
      <div className="admin-app__main">
        <Outlet />
      </div>
    </div>
  )
}
