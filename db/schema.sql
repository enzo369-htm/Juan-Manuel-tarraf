create extension if not exists pgcrypto;

create table if not exists sections (
  slug text primary key,
  title text not null,
  kind text not null check (kind in ('canvas', 'text')),
  sort_order int not null default 0,
  height_ratio double precision not null default 1.2
);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  r2_key text,
  url text not null,
  width int,
  height int,
  mime text,
  created_at timestamptz not null default now()
);

create table if not exists hero_gates (
  section_slug text primary key references sections (slug) on delete cascade,
  media_id uuid references media (id) on delete set null,
  x int not null,
  y int not null,
  width int not null,
  updated_at timestamptz not null default now()
);

create table if not exists section_canvases (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null references sections (slug) on delete cascade,
  sort_order int not null default 0,
  height_ratio double precision not null default 1.2,
  unique (section_slug, sort_order)
);

create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null references sections (slug) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  canvas_id uuid references section_canvases (id) on delete cascade,
  x double precision not null default 8,
  y double precision not null default 8,
  width double precision not null default 24,
  z_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists section_copy (
  section_slug text primary key references sections (slug) on delete cascade,
  body text not null default ''
);

create table if not exists texts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

insert into sections (slug, title, kind, sort_order) values
  ('trabajos', 'Trabajos', 'canvas', 1),
  ('bio', 'Bio', 'text', 2),
  ('exposiciones', 'Exposiciones', 'canvas', 3),
  ('textos', 'Textos', 'text', 4),
  ('archivos', 'Archivos', 'canvas', 5),
  ('contacto', 'Contacto', 'text', 6)
on conflict (slug) do update set title = excluded.title, kind = excluded.kind, sort_order = excluded.sort_order;

insert into media (id, r2_key, url, width, height, mime) values
  ('11111111-1111-1111-1111-111111111111', null, '/works/juan_pintura_3_ALTA.jpg', 2307, 3081, 'image/jpeg'),
  ('22222222-2222-2222-2222-222222222222', null, '/works/a-nocturno-tarraf.jpg', 1182, 1280, 'image/jpeg'),
  ('33333333-3333-3333-3333-333333333333', null, '/works/02.jpg', 1725, 1275, 'image/jpeg'),
  ('44444444-4444-4444-4444-444444444444', null, '/works/3948_baja.jpg', 1644, 1765, 'image/jpeg'),
  ('55555555-5555-5555-5555-555555555555', null, '/works/3953_baja.jpg', 1604, 1970, 'image/jpeg'),
  ('66666666-6666-6666-6666-666666666666', null, '/works/3965_baja.jpg', 1618, 1861, 'image/jpeg')
on conflict (id) do nothing;

insert into hero_gates (section_slug, media_id, x, y, width) values
  ('trabajos', '11111111-1111-1111-1111-111111111111', 1204, 833, 340),
  ('bio', '22222222-2222-2222-2222-222222222222', 1451, 765, 280),
  ('textos', '33333333-3333-3333-3333-333333333333', 990, 1170, 360),
  ('exposiciones', '44444444-4444-4444-4444-444444444444', 1789, 236, 300),
  ('archivos', '55555555-5555-5555-5555-555555555555', 293, 1508, 270),
  ('contacto', '66666666-6666-6666-6666-666666666666', 2408, 1609, 250)
on conflict (section_slug) do nothing;

insert into section_copy (section_slug, body) values
  ('bio', ''),
  ('textos', ''),
  ('contacto', '')
on conflict (section_slug) do nothing;

insert into section_canvases (section_slug, sort_order, height_ratio)
select slug, 0, coalesce(height_ratio, 1.2)
from sections
where kind = 'canvas'
on conflict (section_slug, sort_order) do nothing;
