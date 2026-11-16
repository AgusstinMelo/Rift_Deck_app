-- Objetivos "partidas que cumplen": contar partidas que cumplen una condición por partida
-- (por ejemplo, 10 partidas con 0 muertes o 20 partidas con 10 asesinatos o más).
-- La condición se guarda en filters.condition = { "op": "gte" | "lte", "value": número }.

-- 1. Métricas permitidas.
alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion',
  'partidas_asesinatos', 'partidas_muertes', 'partidas_asistencias', 'partidas_kda', 'partidas_oro',
  'winrate', 'porcentaje_campeones',
  'manual'
));

-- 2. Son acumulativas: sin muestra mínima.
alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion',
    'partidas_asesinatos', 'partidas_muertes', 'partidas_asistencias', 'partidas_kda', 'partidas_oro',
    'manual'
  )) = (min_sample is not null));

-- 3. La cantidad de partidas siempre es "al menos" (la dirección de la condición va en filters).
alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda',
    'partidas_asesinatos', 'partidas_muertes', 'partidas_asistencias', 'partidas_kda', 'partidas_oro',
    'manual'
  ) or operator = 'gte');

-- 4. Toda meta de este tipo necesita su condición por partida.
alter table public.personal_goals drop constraint if exists personal_goals_condition_chk;
alter table public.personal_goals add constraint personal_goals_condition_chk check (
  metric not in ('partidas_asesinatos', 'partidas_muertes', 'partidas_asistencias', 'partidas_kda', 'partidas_oro')
  or (
    filters->'condition'->>'op' in ('gte', 'lte')
    and jsonb_typeof(filters->'condition'->'value') = 'number'
  ));
