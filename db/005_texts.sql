create table if not exists texts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists texts_created_at_idx on texts (created_at desc);
