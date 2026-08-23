create extension if not exists pgcrypto;

create table if not exists sections (
  slug text primary key,
  title text not null,
  kind text not null check (kind in ('canvas', 'text')),
  sort_order int not null default 0
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

create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null references sections (slug) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  x int not null default 40,
  y int not null default 40,
  width int not null default 280,
  z_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists section_copy (
  section_slug text primary key references sections (slug) on delete cascade,
  body text not null default ''
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
  ('trabajos', '11111111-1111-1111-1111-111111111111', 2140, 1480, 340),
  ('bio', '22222222-2222-2222-2222-222222222222', 2580, 1360, 280),
  ('textos', '33333333-3333-3333-3333-333333333333', 1760, 2080, 360),
  ('exposiciones', '44444444-4444-4444-4444-444444444444', 3180, 420, 300),
  ('archivos', '55555555-5555-5555-5555-555555555555', 520, 2680, 270),
  ('contacto', '66666666-6666-6666-6666-666666666666', 4280, 2860, 250)
on conflict (section_slug) do nothing;

insert into section_copy (section_slug, body) values
  ('bio', ''),
  ('textos', ''),
  ('contacto', '')
on conflict (section_slug) do nothing;
