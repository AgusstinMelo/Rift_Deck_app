-- Vincula una partida con la build guardada que se aplicó al cargarla. Con el vínculo se
-- mide qué build rinde más (récord por build en Builds y consejo del Coach).
-- Si la build se borra, la partida queda sin vincular.

-- La columna toma el mismo tipo que builds.id (uuid o bigint según cómo se creó la tabla).
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into id_type
    from pg_attribute a
   where a.attrelid = 'public.builds'::regclass
     and a.attname = 'id'
     and not a.attisdropped;

  execute format(
    'alter table public.matches add column if not exists build_id %s references public.builds(id) on delete set null',
    id_type
  );
end
$$;

create index if not exists matches_build_id_idx on public.matches (build_id) where build_id is not null;
