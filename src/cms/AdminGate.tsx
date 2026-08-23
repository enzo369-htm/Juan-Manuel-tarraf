import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminLogin } from './AdminLogin'
import { fetchAdminSession } from './auth'

export function AdminGate() {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')

  useEffect(() => {
    void fetchAdminSession().then((ok) => setState(ok ? 'in' : 'out'))
  }, [])

  if (state === 'loading') {
    return (
      <main className="admin-login">
        <p className="admin-login__copy">Comprobando sesión…</p>
      </main>
    )
  }

  if (state === 'out') {
    return <AdminLogin onAuthed={() => setState('in')} />
  }

  return <Outlet />
}
