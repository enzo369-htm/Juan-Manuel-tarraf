import { neon } from '@neondatabase/serverless'
import { hasDatabase, requireEnv } from './env'

export function sql() {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL no está configurada')
  }
  return neon(requireEnv('DATABASE_URL'))
}
