-- Rift Deck Coach:
-- 1. Kills de cada equipo en la partida, para calcular participación en kills y qué
--    parte de las muertes del equipo son del jugador. Opcionales: las partidas viejas
--    quedan en null y el Coach las ignora para esos cálculos.
-- 2. Historial de consejos mostrados, para marcar novedades y hacer seguimiento
--    ("hace 8 partidas te marqué X; desde entonces...").

-- 1. Kills de equipo
alter table public.matches add column if not exists team_kills integer;
alter table public.matches add column if not exists enemy_team_kills integer;

alter table public.matches drop constraint if exists matches_team_kills_chk;
alter table public.matches add constraint matches_team_kills_chk check (
  (team_kills is null or team_kills between 0 and 300)
  and (enemy_team_kills is null or enemy_team_kills between 0 and 300)
);

-- 2. Historial del Coach
create table if not exists public.coach_insight_log (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insight_key    text not null check (char_length(insight_key) between 1 and 160),
  -- Métrica de seguimiento del consejo (tipo y parámetros); null si no se sigue.
  track          jsonb check (track is null or jsonb_typeof(track) = 'object'),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (user_id, insight_key)
);

create index if not exists coach_insight_log_user_seen_idx on public.coach_insight_log (user_id, last_seen_at desc);

alter table public.coach_insight_log enable row level security;

revoke all on public.coach_insight_log from anon;
grant select, insert, update, delete on public.coach_insight_log to authenticated;

drop policy if exists coach_insight_log_select_own on public.coach_insight_log;
create policy coach_insight_log_select_own on public.coach_insight_log
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists coach_insight_log_insert_own on public.coach_insight_log;
create policy coach_insight_log_insert_own on public.coach_insight_log
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists coach_insight_log_update_own on public.coach_insight_log;
create policy coach_insight_log_update_own on public.coach_insight_log
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists coach_insight_log_delete_own on public.coach_insight_log;
create policy coach_insight_log_delete_own on public.coach_insight_log
  for delete to authenticated using (user_id = (select auth.uid()));
