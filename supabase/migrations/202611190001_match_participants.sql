-- Los 10 jugadores de cada partida cargada con capturas, para el Coach: equipo, línea,
-- campeón, K/D/A, oro, hechizos, objetos y runas. Sale del marcador y de los costados de
-- la pestaña Runa (lectura en el celular, sin IA).
--
-- Sin nombres de jugadores: solo campeones y números (son datos de terceros y no aportan
-- al análisis). Una fila por jugador; se borran con la partida.

do $$
declare
  match_id_type text;
begin
  -- match_id toma el mismo tipo que matches.id (uuid o bigint según cómo se creó).
  select format_type(a.atttypid, a.atttypmod)
    into match_id_type
    from pg_attribute a
   where a.attrelid = 'public.matches'::regclass
     and a.attname = 'id'
     and not a.attisdropped;

  execute format($sql$
    create table if not exists public.match_participants (
      id bigint generated always as identity primary key,
      match_id %s not null references public.matches(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      team text not null check (team in ('ally', 'enemy')),
      lane text check (lane is null or lane in ('top', 'jungler', 'mid', 'adc', 'support')),
      is_self boolean not null default false,
      champion text,
      kills integer check (kills is null or kills >= 0),
      deaths integer check (deaths is null or deaths >= 0),
      assists integer check (assists is null or assists >= 0),
      gold integer check (gold is null or gold >= 0),
      spells text[] not null default '{}',
      items text[] not null default '{}',
      runes text[] not null default '{}',
      created_at timestamptz not null default now(),
      unique (match_id, team, lane)
    )
  $sql$, match_id_type);
end
$$;

create index if not exists match_participants_user_idx on public.match_participants (user_id);
create index if not exists match_participants_match_idx on public.match_participants (match_id);

alter table public.match_participants enable row level security;

-- Cada usuario ve y maneja solo los jugadores de sus propias partidas.
drop policy if exists "Users read own match participants" on public.match_participants;
create policy "Users read own match participants" on public.match_participants
  for select using (user_id = auth.uid());

drop policy if exists "Users insert participants of own matches" on public.match_participants;
create policy "Users insert participants of own matches" on public.match_participants
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid())
  );

drop policy if exists "Users update own match participants" on public.match_participants;
create policy "Users update own match participants" on public.match_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own match participants" on public.match_participants;
create policy "Users delete own match participants" on public.match_participants
  for delete using (user_id = auth.uid());
