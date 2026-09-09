-- Versiones en inglés de los textos que Juan carga en el admin.
-- Español queda en las columnas actuales; inglés en *_en. Si falta inglés, la web usa español.

alter table exhibitions
  add column if not exists title_en text not null default '';

alter table exhibitions
  add column if not exists description_en text not null default '';

alter table section_canvases
  add column if not exists title_en text not null default '';

alter table section_canvases
  add column if not exists description_en text not null default '';

alter table placements
  add column if not exists ficha_en text not null default '';

alter table section_copy
  add column if not exists body_en text not null default '';

alter table texts
  add column if not exists title_en text not null default '';

alter table texts
  add column if not exists description_en text not null default '';

alter table texts
  add column if not exists body_en text not null default '';
