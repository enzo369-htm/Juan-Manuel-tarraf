-- Portada del muestrario de textos.
-- Correr en Neon (o npm run db:migrate) una vez.

alter table texts
  add column if not exists cover_media_id uuid references media (id) on delete set null;
