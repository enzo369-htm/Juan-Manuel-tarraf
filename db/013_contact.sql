alter table section_copy
  add column if not exists instagram_handle text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists email text not null default '';
