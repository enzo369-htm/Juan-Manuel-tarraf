-- Textos cortos (título + descripción) intercalados con lienzos.
-- Máximo 4 textos y 4 lienzos por sección. El admin crea cada bloque.
-- Borra lienzos vacíos que se habían creado solos.

alter table section_canvases
  add column if not exists kind text not null default 'canvas';

alter table section_canvases
  add column if not exists title text not null default '';

alter table section_canvases
  add column if not exists description text not null default '';

delete from section_canvases sc
where coalesce(sc.kind, 'canvas') = 'canvas'
  and coalesce(sc.title, '') = ''
  and coalesce(sc.description, '') = ''
  and not exists (select 1 from placements p where p.canvas_id = sc.id);
