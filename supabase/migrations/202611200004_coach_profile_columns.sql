-- Datos para que el Coach compare composiciones con números y aconseje runas y hechizos.
-- Se cargan a mano (cambian poco entre parches), por eso viven en las tablas base y no en
-- los datos por parche. Valores permitidos: src/features/coach/taxonomy.js
-- (`npm run catalog:check` los valida).

-- ── Campeones: rol en la pelea y perfil 0-5 ─────────────────────────────────
alter table public.champions
  add column if not exists team_roles text[] not null default '{}',
  add column if not exists score_engage smallint check (score_engage between 0 and 5),
  add column if not exists score_peel smallint check (score_peel between 0 and 5),
  add column if not exists score_disengage smallint check (score_disengage between 0 and 5),
  add column if not exists score_mobility smallint check (score_mobility between 0 and 5),
  add column if not exists score_burst smallint check (score_burst between 0 and 5),
  add column if not exists score_sustained_damage smallint check (score_sustained_damage between 0 and 5),
  add column if not exists score_range smallint check (score_range between 0 and 5),
  add column if not exists score_self_sustain smallint check (score_self_sustain between 0 and 5),
  add column if not exists score_waveclear smallint check (score_waveclear between 0 and 5);

comment on column public.champions.team_roles is 'Rol en la pelea (uno o más): frontline, iniciador, diver (se tira a la línea de atrás), protector, poke, daño_sostenido, split (se divide).';
comment on column public.champions.score_engage is '0-5: capacidad de iniciar peleas (Malphite 5, Jinx 0). Vacío = sin cargar.';
comment on column public.champions.score_peel is '0-5: capacidad de proteger aliados de quien se les tira encima (Janna 5, Zed 0).';
comment on column public.champions.score_disengage is '0-5: capacidad de cortar o escapar de una pelea iniciada por el rival (Janna 5, Darius 0).';
comment on column public.champions.score_mobility is '0-5: movilidad propia, dashes, saltos y blinks (Zed 5, Malphite 1).';
comment on column public.champions.score_burst is '0-5: daño de ráfaga, matar en un combo (Zed 5, Soraka 0).';
comment on column public.champions.score_sustained_damage is '0-5: daño sostenido en peleas largas (Vayne 5, Zed 1).';
comment on column public.champions.score_range is '0-5: alcance para pegar sin exponerse (Ziggs 5, Darius 0).';
comment on column public.champions.score_self_sustain is '0-5: autocuración o robo de vida (Dr. Mundo 5, Jinx 0).';
comment on column public.champions.score_waveclear is '0-5: velocidad para limpiar oleadas (Ziggs 5, Lee Sin 1).';

-- ── Runas: para quién y contra qué ──────────────────────────────────────────
alter table public.runes
  add column if not exists fits_classes text[] not null default '{}',
  add column if not exists counters text[] not null default '{}';

comment on column public.runes.fits_classes is 'Clases a las que les sirve: tirador, mago, asesino, luchador, tanque, soporte.';
comment on column public.runes.counters is 'Contra qué responde: poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo.';

-- ── Hechizos de invocador ───────────────────────────────────────────────────
alter table public.spells
  add column if not exists fits_classes text[] not null default '{}',
  add column if not exists fits_lanes text[] not null default '{}',
  add column if not exists counters text[] not null default '{}';

comment on column public.spells.fits_classes is 'Clases a las que les sirve: tirador, mago, asesino, luchador, tanque, soporte.';
comment on column public.spells.fits_lanes is 'Líneas donde se usa: top, jungler, mid, adc, support.';
comment on column public.spells.counters is 'Contra qué responde: poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo.';

-- ── Vistas del parche activo ────────────────────────────────────────────────
-- Usan (jsonb_populate_record(base, datos_del_parche)).*: las columnas quedan fijas al
-- crear la vista, así que se recrean igual que antes para exponer las nuevas.
drop view if exists public.current_champions;

create view public.current_champions with (security_invoker = true) as
select (jsonb_populate_record(c, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d on d.patch_id = p.id and d.champion_id = c.id::text;

grant select on public.current_champions to anon, authenticated;

drop view if exists public.current_runes;

create view public.current_runes with (security_invoker = true) as
select
  (jsonb_populate_record(r, d.data)).*,
  p.id as patch_id,
  p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal,
  coalesce(d.data -> 'tags', '[]'::jsonb) as tags,
  coalesce((d.data ->> 'active')::boolean, true) as active
from public.runes r
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.rune_patch_data d on d.patch_id = p.id and d.rune_id = r.id::text
where coalesce((d.data ->> 'active')::boolean, true);

grant select on public.current_runes to anon, authenticated;
