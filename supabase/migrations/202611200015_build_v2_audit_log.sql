-- Registro de cada build generada por Build V2: cuánto corrigió nuestra capa sobre lo que
-- propuso la IA. Sirve para medir si la IA decide bien (casi siempre 0 cambios) y qué
-- regla actúa seguido (eso se mejora en el prompt o en los datos, no con más reglas).
-- Los usuarios solo insertan sus filas; se lee desde el panel (service role).
create table if not exists public.build_v2_audit_log (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  patch_version text,
  champion      text not null,
  role          text not null,
  themed        boolean not null default false,
  enemies_known smallint not null default 0,
  attempt       smallint not null default 1,
  -- Errores de la respuesta cruda que reparó el estabilizador (IDs inválidos, ramas, etc.).
  repairs       smallint not null default 0,
  -- Piezas que cambió la auditoría, y la regla de cada cambio (tankItem, infinity, class...).
  item_changes  smallint not null default 0,
  rune_changes  smallint not null default 0,
  spell_changes smallint not null default 0,
  rules         text[] not null default '{}',
  prompt_tokens integer
);

create index if not exists build_v2_audit_log_created_at_idx on public.build_v2_audit_log (created_at desc);

alter table public.build_v2_audit_log enable row level security;
revoke all on public.build_v2_audit_log from anon;
grant insert on public.build_v2_audit_log to authenticated;

drop policy if exists build_v2_audit_log_insert_own on public.build_v2_audit_log;
create policy build_v2_audit_log_insert_own on public.build_v2_audit_log
  for insert to authenticated with check (user_id = (select auth.uid()));

comment on table public.build_v2_audit_log is 'Una fila por build de Build V2: reparaciones del estabilizador y cambios de la auditoría sobre lo que propuso la IA.';

-- Typo al cargar el trait de curación de Tryndamere.
update public.champions
set traits = array_replace(traits, 'sutocuracion', 'autocuracion')
where 'sutocuracion' = any(traits);
