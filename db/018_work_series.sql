create table if not exists work_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  title_en text not null default '',
  description_en text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table section_canvases
  add column if not exists series_id uuid references work_series (id) on delete cascade;

create unique index if not exists section_canvases_series_sort
  on section_canvases (series_id, sort_order)
  where series_id is not null;

insert into work_series (id, title, description, sort_order)
select 'a11ce000-0000-4000-8000-000000000001', 'Trabajos', '', 0
where exists (
  select 1 from section_canvases
  where section_slug = 'trabajos' and series_id is null and exhibition_id is null
)
and not exists (
  select 1 from work_series where id = 'a11ce000-0000-4000-8000-000000000001'
);

update section_canvases as canvas
set sort_order = numbered.rn
from (
  select id, (row_number() over (order by sort_order, id) - 1)::int as rn
  from section_canvases
  where section_slug = 'trabajos' and series_id is null and exhibition_id is null
) as numbered
where canvas.id = numbered.id;

update section_canvases
set series_id = 'a11ce000-0000-4000-8000-000000000001'
where section_slug = 'trabajos'
  and series_id is null
  and exhibition_id is null
  and exists (
    select 1 from work_series where id = 'a11ce000-0000-4000-8000-000000000001'
  );
