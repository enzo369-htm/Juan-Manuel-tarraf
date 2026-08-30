-- Álbumes de exposiciones (portada + bloques de texto/lienzo por expo).

create table if not exists exhibitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  cover_media_id uuid references media (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table section_canvases
  add column if not exists exhibition_id uuid references exhibitions (id) on delete cascade;

alter table section_canvases
  drop constraint if exists section_canvases_section_slug_sort_order_key;

create unique index if not exists section_canvases_exhibition_sort
  on section_canvases (exhibition_id, sort_order)
  where exhibition_id is not null;
