-- Membresías: planes mensual / trimestral / anual, prueba gratis de 45 días y
-- cálculo del acceso en el servidor.
--
-- memberships, membership_plans y payment_events se crearon desde el dashboard y
-- no tienen migración propia: esta migración solo agrega lo necesario y no asume
-- constraints ni índices que quizás no existan.

-- 1. Planes
alter table public.membership_plans add column if not exists interval_months integer not null default 1;
alter table public.membership_plans add column if not exists amount_usd numeric(10,2);
alter table public.membership_plans add column if not exists paypal_plan_id text;
alter table public.membership_plans add column if not exists sort_order integer not null default 0;

-- 'premium' queda como el plan mensual: las membresías existentes lo referencian.
update public.membership_plans
set name = 'Mensual', interval_months = 1, amount_ars = 3000, amount_usd = 2, sort_order = 1, updated_at = now()
where code = 'premium';

-- 'trial' no se vende (active = false); existe por si plan_code tiene FK a membership_plans.
insert into public.membership_plans
  (id, code, name, description, amount_ars, currency, access_features, active,
   interval_months, amount_usd, sort_order, created_at, updated_at)
select gen_random_uuid(), v.code, v.name, 'Acceso premium a estadísticas avanzadas', v.amount_ars, 'ARS',
       (select p.access_features from public.membership_plans p where p.code = 'premium'),
       v.active, v.interval_months, v.amount_usd, v.sort_order, now(), now()
from (values
  ('premium_quarterly', 'Trimestral',    8500,  5.5::numeric, 3,  2, true),
  ('premium_annual',    'Anual',         30000, 20::numeric,  12, 3, true),
  ('trial',             'Prueba gratis', 0,     null,         1,  0, false)
) as v(code, name, amount_ars, amount_usd, interval_months, sort_order, active)
where not exists (select 1 from public.membership_plans p where p.code = v.code);

alter table public.membership_plans enable row level security;
grant select on public.membership_plans to anon, authenticated;
drop policy if exists membership_plans_public_read on public.membership_plans;
create policy membership_plans_public_read on public.membership_plans
  for select to anon, authenticated using (active);

-- 2. Si memberships tiene checks sobre status o provider, se amplían para la prueba.
--    Se recrean NOT VALID para no fallar por filas viejas cargadas a mano.
do $$
declare
  r record;
  had_status_check boolean := false;
  had_provider_check boolean := false;
begin
  for r in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.memberships'::regclass and contype = 'c'
  loop
    if r.def ilike '%status%' then
      had_status_check := true;
      execute format('alter table public.memberships drop constraint %I', r.conname);
    elsif r.def ilike '%provider%' then
      had_provider_check := true;
      execute format('alter table public.memberships drop constraint %I', r.conname);
    end if;
  end loop;

  if had_status_check then
    alter table public.memberships add constraint memberships_status_check check (status in (
      'pending', 'active', 'authorized', 'trialing', 'paused', 'cancelled', 'payment_failed', 'expired', 'inactive'
    )) not valid;
  end if;

  if had_provider_check then
    alter table public.memberships add constraint memberships_provider_check check (provider in (
      'mercadopago', 'paypal', 'manual', 'trial'
    )) not valid;
  end if;
end;
$$;

-- 3. Una sola prueba gratis por usuario.
create unique index if not exists memberships_one_trial_per_user_idx
  on public.memberships (user_id) where provider = 'trial';

create index if not exists memberships_user_created_idx
  on public.memberships (user_id, created_at desc);

-- 4. Acceso
-- Hasta cuándo da acceso una fila (null = no da acceso).
-- Una fila activa sin fecha da acceso indefinido: así quedaron algunas cargadas a mano.
create or replace function public.membership_access_until(m public.memberships)
returns timestamptz
language sql stable set search_path = pg_catalog, public as $$
  select case
    when not coalesce(m.access_features::jsonb ? 'stats', false) then null
    when m.status in ('active', 'authorized', 'trialing')
      then coalesce(m.expires_at, m.current_period_end, 'infinity'::timestamptz)
    -- Una suscripción cancelada conserva el acceso hasta el fin del período pagado.
    when m.status = 'cancelled' then m.current_period_end
    else null
  end
$$;

create or replace function public.has_premium_access()
returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and public.membership_access_until(m) > now()
  )
$$;

-- La prueba es para quien nunca tuvo premium y tiene el email confirmado.
create or replace function public.membership_trial_available(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null)
    and not exists (
      select 1 from public.memberships m
      where m.user_id = p_user_id
        and (m.provider = 'trial'
             or m.started_at is not null
             or m.status in ('active', 'authorized', 'cancelled', 'paused'))
    )
$$;

create or replace function public.get_my_membership()
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid();
  current_row public.memberships;
  access_until timestamptz;
  trial_row public.memberships;
begin
  if uid is null then
    return jsonb_build_object('has_access', false, 'status', 'inactive', 'membership', null,
                              'access_until', null, 'trial_available', false, 'trial_ends_at', null);
  end if;

  -- Con varias filas vigentes (p. ej. prueba + suscripción paga) gana la paga.
  select * into current_row
  from public.memberships m
  where m.user_id = uid and public.membership_access_until(m) > now()
  order by (m.provider = 'trial'), public.membership_access_until(m) desc
  limit 1;

  if found then
    access_until := public.membership_access_until(current_row);
  else
    select * into current_row
    from public.memberships m
    where m.user_id = uid
    order by m.created_at desc
    limit 1;
  end if;

  select * into trial_row from public.memberships m where m.user_id = uid and m.provider = 'trial';

  return jsonb_build_object(
    'has_access', access_until is not null,
    'status', coalesce(current_row.status, 'inactive'),
    'membership', case when current_row.id is null then null else to_jsonb(current_row) end,
    'access_until', case when access_until = 'infinity' then null else access_until end,
    'trial_available', public.membership_trial_available(uid),
    'trial_ends_at', trial_row.expires_at
  );
end;
$$;

create or replace function public.start_membership_trial()
returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid();
  user_email text;
  ends_at timestamptz := now() + interval '45 days';
begin
  if uid is null then
    raise exception 'Necesitás iniciar sesión.' using errcode = '42501';
  end if;

  select u.email into user_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if user_email is null then
    raise exception 'Confirmá tu email para activar la prueba gratis.' using errcode = '42501';
  end if;

  if not public.membership_trial_available(uid) then
    raise exception 'La prueba gratis ya fue usada en esta cuenta.' using errcode = '23505';
  end if;

  insert into public.memberships
    (user_id, user_email, plan_code, provider, external_reference, amount_ars, currency, access_features,
     status, started_at, current_period_start, current_period_end, expires_at, created_at, updated_at)
  values
    (uid, user_email, 'trial', 'trial', uid::text || ':trial', 0, 'ARS', '["stats"]',
     'trialing', now(), now(), ends_at, ends_at, now(), now());

  return public.get_my_membership();
exception when unique_violation then
  raise exception 'La prueba gratis ya fue usada en esta cuenta.' using errcode = '23505';
end;
$$;

revoke all on function public.membership_access_until(public.memberships) from public, anon;
revoke all on function public.has_premium_access() from public, anon;
revoke all on function public.membership_trial_available(uuid) from public, anon, authenticated;
revoke all on function public.get_my_membership() from public, anon;
revoke all on function public.start_membership_trial() from public, anon;
grant execute on function public.membership_access_until(public.memberships) to authenticated;
grant execute on function public.has_premium_access() to authenticated;
grant execute on function public.get_my_membership() to authenticated;
grant execute on function public.start_membership_trial() to authenticated;
