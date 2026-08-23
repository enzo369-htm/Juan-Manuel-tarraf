export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable ${name}`)
  return value
}

export function optionalEnv(name: string) {
  return process.env[name] || ''
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL)
}

export function hasR2() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  )
}
