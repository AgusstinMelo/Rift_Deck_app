-- La descripción y las estadísticas se editan en los datos del parche (rune_patch_data,
-- item_patch_data, champion_patch_stats), que es lo que muestran las vistas current_*.
-- Las tablas base tenían una copia vieja de esos mismos campos que nadie actualizaba.
-- Desde ahora, guardar una fila del parche ACTIVO copia a la base los campos que existen
-- en las dos, así la base queda siempre como "el último valor conocido".
--
-- No se copian:
--   * valores null (un null del parche no borra lo cargado en la base);
--   * filas inactivas del parche (active = false);
--   * lo que se carga a mano solo en la base: perfil del Coach (counters, fits_*,
--     team_roles, score_*), tags de campeones (taxonomía, distintos a los del parche),
--     recomendaciones viejas y la disponibilidad por parche (active);
--   * metadatos (id, fechas, autor).
-- Editar un parche viejo no toca la base. Cambiar el parche activo copia el nuevo entero.

create or replace function public.catalog_sync_excluded_columns()
returns text[] language sql immutable as $$
  select array[
    'id', 'created_at', 'created_date', 'created_by_id', 'updated_at', 'updated_date', 'is_sample',
    'counters', 'fits_classes', 'fits_lanes', 'team_roles',
    'score_engage', 'score_peel', 'score_disengage', 'score_mobility', 'score_burst',
    'score_sustained_damage', 'score_range', 'score_self_sustain', 'score_waveclear',
    'tags', 'recommended_champions', 'recommended_champion', 'recommended_items', 'active'
  ]::text[]
$$;

-- Copia a la fila base `p_id` de `p_base` los campos de `p_data` que son columnas de la base.
create or replace function public.sync_catalog_base_row(p_base regclass, p_id text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  cols text;
  vals text;
begin
  if p_data is null or coalesce((p_data ->> 'active')::boolean, true) = false then
    return false;
  end if;
  payload := jsonb_strip_nulls(p_data) - public.catalog_sync_excluded_columns();
  select string_agg(format('%I', a.attname), ', ' order by a.attnum),
         string_agg(format('r.%I', a.attname), ', ' order by a.attnum)
    into cols, vals
  from pg_attribute a
  where a.attrelid = p_base and a.attnum > 0 and not a.attisdropped and payload ? a.attname;
  if cols is null then
    return false;
  end if;
  execute format(
    'update %s b set (%s) = (select %s from jsonb_populate_record(b, $1) r) where b.id::text = $2',
    p_base, cols, vals
  ) using payload, p_id;
  return true;
end;
$$;

-- Trigger de las tablas del parche. Argumentos: tabla base y columna con el id.
-- Si la copia falla (por ejemplo un número mal escrito), el guardado del parche sigue
-- igual y queda un aviso; `npm run catalog:check` marca la diferencia.
create or replace function public.sync_catalog_base_from_patch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_id text := to_jsonb(new) ->> tg_argv[1];
begin
  if new.patch_id is distinct from (select active_patch_id from public.game_state where id = 1) then
    return new;
  end if;
  begin
    perform public.sync_catalog_base_row(tg_argv[0]::regclass, entity_id, new.data);
  exception when others then
    raise warning 'No se pudo copiar % % del parche a la base: %', tg_argv[0], entity_id, sqlerrm;
  end;
  return new;
end;
$$;

-- Copia un parche entero a la base. Devuelve cuántas filas copió y cuántas fallaron.
create or replace function public.sync_catalog_base_from_patch_id(p_patch bigint)
returns table (tabla text, copiadas int, fallidas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  spec record;
  row_data record;
  ok int;
  bad int;
begin
  for spec in
    select * from (values
      ('public.runes', 'public.rune_patch_data', 'rune_id'),
      ('public.wr_items', 'public.item_patch_data', 'item_id'),
      ('public.champions', 'public.champion_patch_stats', 'champion_id')
    ) as t(base, patch, id_col)
  loop
    ok := 0;
    bad := 0;
    for row_data in execute format('select %I::text as entity_id, data from %s where patch_id = $1', spec.id_col, spec.patch) using p_patch
    loop
      begin
        if public.sync_catalog_base_row(spec.base::regclass, row_data.entity_id, row_data.data) then
          ok := ok + 1;
        end if;
      exception when others then
        bad := bad + 1;
        raise warning 'No se pudo copiar % % del parche a la base: %', spec.base, row_data.entity_id, sqlerrm;
      end;
    end loop;
    tabla := spec.base;
    copiadas := ok;
    fallidas := bad;
    return next;
  end loop;
end;
$$;

create or replace function public.sync_catalog_base_on_active_patch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_patch_id is not null and new.active_patch_id is distinct from old.active_patch_id then
    perform public.sync_catalog_base_from_patch_id(new.active_patch_id);
  end if;
  return new;
end;
$$;

-- Solo las usan los triggers y las migraciones, no la API.
revoke execute on function public.sync_catalog_base_row(regclass, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_catalog_base_from_patch_id(bigint) from public, anon, authenticated;

drop trigger if exists rune_patch_sync_base on public.rune_patch_data;
create trigger rune_patch_sync_base
  after insert or update of data on public.rune_patch_data
  for each row execute function public.sync_catalog_base_from_patch('public.runes', 'rune_id');

drop trigger if exists item_patch_sync_base on public.item_patch_data;
create trigger item_patch_sync_base
  after insert or update of data on public.item_patch_data
  for each row execute function public.sync_catalog_base_from_patch('public.wr_items', 'item_id');

drop trigger if exists champion_patch_sync_base on public.champion_patch_stats;
create trigger champion_patch_sync_base
  after insert or update of data on public.champion_patch_stats
  for each row execute function public.sync_catalog_base_from_patch('public.champions', 'champion_id');

drop trigger if exists game_state_sync_base on public.game_state;
create trigger game_state_sync_base
  after update of active_patch_id on public.game_state
  for each row execute function public.sync_catalog_base_on_active_patch();

-- Emparejar lo que ya estaba desfasado (7 runas, 101 objetos y 32 campeones al generar
-- esta migración). Si alguna fila falla, la migración se corta para revisarla.
do $$
declare
  result record;
begin
  for result in select * from public.sync_catalog_base_from_patch_id((select active_patch_id from public.game_state where id = 1))
  loop
    raise notice '%: % copiadas, % fallidas', result.tabla, result.copiadas, result.fallidas;
    if result.fallidas > 0 then
      raise exception '% filas de % no se pudieron copiar; revisá los avisos', result.fallidas, result.tabla;
    end if;
  end loop;
end;
$$;
