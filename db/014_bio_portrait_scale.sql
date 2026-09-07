alter table section_copy
  add column if not exists portrait_scale int not null default 100;
