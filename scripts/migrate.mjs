import { existsSync, readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

function loadDotEnv() {
  const path = new URL('../.env', import.meta.url)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadDotEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL')
  process.exit(1)
}

const sql = neon(url)
const files = [
  'schema.sql',
  '003_free_canvas_percent.sql',
  '004_section_canvases.sql',
  '005_texts.sql',
  '006_scale_hero.sql',
  '007_scale_hero.sql',
  '008_bio_portrait.sql',
  '009_section_blocks.sql',
  '010_hero_background.sql',
  '011_exhibitions.sql',
]

for (const file of files) {
  const schema = readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8')
  const statements = schema
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('--'))

  for (const statement of statements) {
    await sql.query(statement)
    console.log('ok:', file, statement.slice(0, 50).replace(/\s+/g, ' '))
  }
}

console.log('Schema aplicado.')
