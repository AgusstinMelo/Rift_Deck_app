-- Sugeridores (builds y campeones): la cuenta free tiene 5 ejecuciones por día de
-- cada uno; Premium (incluida la prueba gratis) y los admins, ilimitadas.
--
-- Las edge functions consumen una ejecución antes de llamar a la IA y la devuelven
-- si la IA falla. El día se cuenta en hora de Argentina.
-- Depende de membership_access_until (202610270001_membership_plans_and_trial.sql).

-- 1. Uso
create table public.suggester_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature     text not null check (feature in ('build', 'champions')),
  -- Una ejecución puede hacer más de una llamada (la corrección del sugeridor de
  -- builds): las llamadas con el mismo request_id cuentan una sola vez.
  request_id  uuid not null,
  calls       integer not null default 1 check (calls between 1 and 2),
  usage_day   date not null,
  created_at  timestamptz not null default now(),
  constraint suggester_usage_request_uq unique (user_id, feature, request_id)
);

create index suggester_usage_user_day_idx on public.suggester_usage (user_id, feature, usage_day);

alter table public.suggester_usage enable row level security;
revoke all on public.suggester_usage from anon, authenticated;
grant select on public.suggester_usage to authenticated;
create policy suggester_usage_select_own on public.suggester_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- 2. Funciones
create or replace function public.suggester_today()
returns date
language sql stable set search_path = pg_catalog, public as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- null = ilimitado.
create or replace function public.suggester_daily_limit(p_user_id uuid)
returns integer
language sql stable security definer set search_path = pg_catalog, public as $$
  select case
    when exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin') then null
    when exists (
      select 1 from public.memberships m
      where m.user_id = p_user_id and public.membership_access_until(m) > now()
    ) then null
    else 5
  end
$$;

-- Lo llaman las edge functions con la service role.
create or replace function public.consume_suggester_run(p_user_id uuid, p_feature text, p_request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  daily_limit integer := public.suggester_daily_limit(p_user_id);
  today date := public.suggester_today();
  existing public.suggester_usage;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('suggester_usage:' || p_user_id::text || ':' || p_feature));

  select * into existing from public.suggester_usage
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id;

  select count(*) into used from public.suggester_usage
  where user_id = p_user_id and feature = p_feature and usage_day = today;

  if existing.id is not null then
    -- Segunda llamada de la misma ejecución, dentro de unos minutos: no se cobra de nuevo.
    if existing.calls < 2 and existing.created_at > now() - interval '10 minutes' then
      update public.suggester_usage set calls = calls + 1 where id = existing.id;
      return jsonb_build_object('allowed', true, 'used', used, 'limit', daily_limit);
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'request_reused', 'used', used, 'limit', daily_limit);
  end if;

  if daily_limit is not null and used >= daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'used', used, 'limit', daily_limit);
  end if;

  insert into public.suggester_usage (user_id, feature, request_id, usage_day)
  values (p_user_id, p_feature, p_request_id, today);

  return jsonb_build_object('allowed', true, 'used', used + 1, 'limit', daily_limit);
end;
$$;

-- Devuelve la llamada cuando la IA falla: el usuario no pierde la ejecución.
create or replace function public.refund_suggester_run(p_user_id uuid, p_feature text, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
begin
  delete from public.suggester_usage
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id and calls = 1;

  update public.suggester_usage set calls = calls - 1
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id and calls > 1;
end;
$$;

create or replace function public.get_my_suggester_usage()
returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'limit', public.suggester_daily_limit((select auth.uid())),
    'build', (select count(*) from public.suggester_usage u
              where u.user_id = (select auth.uid()) and u.feature = 'build' and u.usage_day = public.suggester_today()),
    'champions', (select count(*) from public.suggester_usage u
                  where u.user_id = (select auth.uid()) and u.feature = 'champions' and u.usage_day = public.suggester_today())
  )
$$;

revoke all on function public.suggester_daily_limit(uuid) from public, anon, authenticated;
revoke all on function public.consume_suggester_run(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.refund_suggester_run(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_my_suggester_usage() from public, anon;
grant execute on function public.consume_suggester_run(uuid, text, uuid) to service_role;
grant execute on function public.refund_suggester_run(uuid, text, uuid) to service_role;
grant execute on function public.get_my_suggester_usage() to authenticated;
