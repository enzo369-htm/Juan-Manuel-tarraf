-- Run once in Neon SQL Editor. Positions become % of the canvas (studio-core).

alter table sections
  add column if not exists height_ratio double precision not null default 1.2;

alter table placements
  alter column x type double precision using x::double precision,
  alter column y type double precision using y::double precision,
  alter column width type double precision using width::double precision;
