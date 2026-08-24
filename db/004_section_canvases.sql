-- Hasta 3 lienzos libres por sección (trabajos / exposiciones / archivos).

create table if not exists section_canvases (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null references sections (slug) on delete cascade,
  sort_order int not null default 0,
  height_ratio double precision not null default 1.2,
  unique (section_slug, sort_order)
);

alter table placements
  add column if not exists canvas_id uuid references section_canvases (id) on delete cascade;

insert into section_canvases (section_slug, sort_order, height_ratio)
select slug, 0, coalesce(height_ratio, 1.2)
from sections
where kind = 'canvas'
on conflict (section_slug, sort_order) do nothing;

update placements p
set canvas_id = c.id
from section_canvases c
where p.section_slug = c.section_slug
  and c.sort_order = 0
  and p.canvas_id is null;
