-- Color de los nombres del giro: 0 = blanco, 255 = negro.
-- Correr en Neon (o npm run db:migrate) una vez.

alter table hero_background
  add column if not exists label_ink smallint not null default 233;
