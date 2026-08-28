-- Fondo del hero administrable (una sola fila).

create table if not exists hero_background (
  id int primary key default 1 check (id = 1),
  media_id uuid references media (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into hero_background (id) values (1)
on conflict (id) do nothing;
