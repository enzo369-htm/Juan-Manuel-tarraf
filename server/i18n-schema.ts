type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>

/** One-shot schema helper. Do not call from Vercel request handlers. */
export async function ensureI18nColumns(sql: Sql) {
  await sql`alter table exhibitions add column if not exists title_en text not null default ''`
  await sql`alter table exhibitions add column if not exists description_en text not null default ''`
  await sql`alter table section_canvases add column if not exists title_en text not null default ''`
  await sql`alter table section_canvases add column if not exists description_en text not null default ''`
  await sql`alter table placements add column if not exists ficha_en text not null default ''`
  await sql`alter table section_copy add column if not exists body_en text not null default ''`
  await sql`alter table texts add column if not exists title_en text not null default ''`
  await sql`alter table texts add column if not exists description_en text not null default ''`
  await sql`alter table texts add column if not exists body_en text not null default ''`
}
