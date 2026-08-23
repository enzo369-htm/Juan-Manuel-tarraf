import { apiLogin, apiLogout, apiMe } from './api'

export async function fetchAdminSession() {
  try {
    const data = await apiMe()
    return data.ok
  } catch {
    return false
  }
}

export async function loginAdmin(password: string) {
  await apiLogin(password)
  return true
}

export async function logoutAdmin() {
  await apiLogout()
}
