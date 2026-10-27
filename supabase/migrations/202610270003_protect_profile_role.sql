-- profiles: un usuario no puede asignarse ni cambiarse el rol.
--
-- La política "Users can update own profile" permite editar cualquier columna del
-- propio perfil, incluida role: cualquiera podía ponerse 'admin' (acceso Premium y
-- objetivos ilimitados). Los privilegios por columna no alcanzan porque Supabase
-- otorga UPDATE sobre toda la tabla, así que se valida con un trigger.
--
-- Desde el SQL Editor (postgres) o con la service role el rol se sigue cambiando
-- normalmente.

create or replace function public.profiles_protect_role() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
  elsif new.role is distinct from old.role then
    raise exception 'No se puede cambiar el rol del perfil' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_role();
