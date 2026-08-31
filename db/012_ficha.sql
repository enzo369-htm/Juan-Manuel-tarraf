-- Ficha técnica: un texto libre por pintura del lienzo.
-- Correr en Neon (o npm run db:migrate) una vez.

alter table placements
  add column if not exists ficha text not null default '';
