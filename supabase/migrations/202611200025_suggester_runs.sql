-- Registro de ejecuciones de los sugeridores (builds y campeones): quién, cuándo, si salió
-- bien o falló y por qué. suggester_usage no sirve para esto: cuenta el límite diario y
-- borra la fila cuando la IA falla (se le devuelve la ejecución al usuario).
--
-- Una fila por ejecución (request_id). La escriben las edge functions con la service role
-- (record_suggester_run); el cliente solo puede cerrar su propia ejecución de builds cuando
-- la IA respondió pero la build no pasó la validación local (finish_suggester_run).
-- Se consulta desde el panel de Supabase: suggester_runs_overview suma el email del usuario.

create table if not exists public.suggester_runs (
  id             bigint generated always as identity primary key,
  request_id     uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  feature        text not null check (feature in ('build', 'champions')),
  -- running: la IA todavía no respondió; usage_limit: rechazada por el límite diario.
  status         text not null default 'running' check (status in ('running', 'success', 'failed', 'usage_limit')),
  -- provider_error, malformed_response, validation_error, config_error, unexpected...
  error_kind     text,
  error_message  text,
  -- Llamadas a la IA de la ejecución (Builds puede hacer una segunda para corregir).
  calls          smallint not null default 0,
  model          text,
  -- Tiempo total de las llamadas a la IA, en milisegundos.
  duration_ms    integer,
  -- Solo builds: qué se pidió.
  champion       text,
  role           text,
  patch_version  text,
  themed         boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint suggester_runs_request_uq unique (user_id, feature, request_id)
);

create index if not exists suggester_runs_created_at_idx on public.suggester_runs (created_at desc);
create index if not exists suggester_runs_feature_status_idx on public.suggester_runs (feature, status, created_at desc);
create index if not exists suggester_runs_user_idx on public.suggester_runs (user_id, created_at desc);

alter table public.suggester_runs enable row level security;
revoke all on public.suggester_runs from anon, authenticated;

-- Lo llaman las edge functions (service role): con 'running' antes de llamar a la IA (si la
-- función se corta por timeout, la ejecución queda en running) y con el resultado después.
-- Crea la fila de la ejecución o la actualiza: suma la llamada (los registros running y
-- usage_limit no cuentan) y su tiempo, y deja el último estado.
create or replace function public.record_suggester_run(
  p_user_id uuid,
  p_feature text,
  p_request_id uuid,
  p_status text,
  p_error_kind text default null,
  p_error_message text default null,
  p_model text default null,
  p_duration_ms integer default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  counted smallint := case when p_status in ('usage_limit', 'running') then 0 else 1 end;
begin
  insert into public.suggester_runs as r (
    request_id, user_id, feature, status, error_kind, error_message, calls, model, duration_ms,
    champion, role, patch_version, themed
  ) values (
    p_request_id, p_user_id, p_feature, p_status, p_error_kind, left(p_error_message, 500), counted, p_model, p_duration_ms,
    nullif(p_meta->>'champion', ''), nullif(p_meta->>'role', ''), nullif(p_meta->>'patch_version', ''), (p_meta->>'themed')::boolean
  )
  on conflict (user_id, feature, request_id) do update set
    status        = excluded.status,
    error_kind    = excluded.error_kind,
    error_message = excluded.error_message,
    calls         = r.calls + excluded.calls,
    model         = coalesce(excluded.model, r.model),
    duration_ms   = case when excluded.duration_ms is null then r.duration_ms else coalesce(r.duration_ms, 0) + excluded.duration_ms end,
    champion      = coalesce(r.champion, excluded.champion),
    role          = coalesce(r.role, excluded.role),
    patch_version = coalesce(r.patch_version, excluded.patch_version),
    themed        = coalesce(r.themed, excluded.themed),
    updated_at    = now();
end;
$$;

-- El cliente de Builds cierra su ejecución con el resultado final: la IA pudo responder bien
-- (la edge function la marcó success) y aun así la build no pasar la validación local.
-- Solo sobre filas propias, ya registradas por la edge function.
create or replace function public.finish_suggester_run(
  p_feature text,
  p_request_id uuid,
  p_status text,
  p_error_kind text default null
)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
begin
  if p_status not in ('success', 'failed') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.suggester_runs
  set status = p_status,
      error_kind = case when p_status = 'failed' then coalesce(p_error_kind, error_kind) else null end,
      error_message = case when p_status = 'failed' then error_message else null end,
      updated_at = now()
  where user_id = (select auth.uid())
    and feature = p_feature
    and request_id = p_request_id
    and status <> 'usage_limit';
end;
$$;

revoke all on function public.record_suggester_run(uuid, text, uuid, text, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finish_suggester_run(text, uuid, text, text) from public, anon;
grant execute on function public.record_suggester_run(uuid, text, uuid, text, text, text, text, integer, jsonb) to service_role;
grant execute on function public.finish_suggester_run(text, uuid, text, text) to authenticated;

-- Para leer desde el panel: cada ejecución con el email de quien la hizo.
create or replace view public.suggester_runs_overview
with (security_invoker = true) as
select
  r.created_at,
  u.email,
  r.feature,
  r.status,
  r.error_kind,
  r.error_message,
  r.calls,
  r.duration_ms,
  r.model,
  r.champion,
  r.role,
  r.patch_version,
  r.themed,
  r.user_id,
  r.request_id
from public.suggester_runs r
left join auth.users u on u.id = r.user_id;

revoke all on public.suggester_runs_overview from anon, authenticated;

comment on table public.suggester_runs is 'Una fila por ejecución de los sugeridores (build / champions): usuario, fecha, estado (success, failed, usage_limit) y error.';
comment on view public.suggester_runs_overview is 'suggester_runs con el email del usuario, para consultar desde el panel.';
