-- Objetos: para qué clases son (misma lista cerrada que runas y hechizos: tirador, mago,
-- asesino, luchador, tanque, soporte; src/features/coach/taxonomy.js). Hoy la clase se
-- deduce del tipo (Daño Físico, Defensa...), y eso deja pasar, por ejemplo, el Guantelete
-- de Sterak a una tiradora. Se carga a mano en la tabla base, de a poco: mientras un objeto
-- no lo tenga, Build V2 sigue deduciendo como antes. El trigger de sincronización no la
-- pisa (fits_classes ya está en catalog_sync_excluded_columns).
alter table public.wr_items
  add column if not exists fits_classes text[] not null default '{}';

comment on column public.wr_items.fits_classes is 'Clases que arman este objeto: tirador, mago, asesino, luchador, tanque, soporte. Vacío = se deduce del tipo.';

-- La vista fija sus columnas al crearse: se recrea igual para exponer la nueva.
drop view if exists public.current_wr_items;

create view public.current_wr_items with (security_invoker = true) as
select (jsonb_populate_record(i, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.wr_items i
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.item_patch_data d on d.patch_id = p.id and d.item_id = i.id::text;

grant select on public.current_wr_items to anon, authenticated;
