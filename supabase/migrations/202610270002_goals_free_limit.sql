-- Objetivos: la cuenta free puede tener 1 objetivo en curso; Premium (incluida la
-- prueba gratis) y los admins, ilimitados.
--
-- "En curso" = ciclo de vida activo y período sin cerrar. Los cancelados, archivados
-- y los de período cerrado no cuentan. Depende de membership_access_until
-- (202610270001_membership_plans_and_trial.sql).

create or replace function public.personal_goals_open_limit(p_user_id uuid)
returns integer
language sql stable security definer set search_path = pg_catalog, public as $$
  select case
    when exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin') then null
    when exists (
      select 1 from public.memberships m
      where m.user_id = p_user_id and public.membership_access_until(m) > now()
    ) then null
    else 1
  end
$$;

revoke all on function public.personal_goals_open_limit(uuid) from public, anon, authenticated;

-- security definer: el usuario no puede ejecutar personal_goals_open_limit ni leer memberships ajenas.
create function public.personal_goals_enforce_free_limit() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  open_limit integer := public.personal_goals_open_limit(new.user_id);
  open_count integer;
begin
  if open_limit is null or new.lifecycle <> 'activo' then
    return new;
  end if;

  -- Serializa las altas del mismo usuario para que dos inserts simultáneos no pasen el límite.
  perform pg_advisory_xact_lock(hashtext('personal_goals_limit:' || new.user_id::text));

  select count(*) into open_count
  from public.personal_goals g
  where g.user_id = new.user_id and g.lifecycle = 'activo' and g.period_end > now();

  if open_count >= open_limit then
    raise exception 'Con la cuenta free podés tener 1 objetivo en curso. Pasate a Premium para crear objetivos ilimitados.'
      using errcode = 'P0001', hint = 'goal_limit_reached';
  end if;

  return new;
end;
$$;

create trigger personal_goals_enforce_free_limit
  before insert on public.personal_goals
  for each row execute function public.personal_goals_enforce_free_limit();
