-- Objetivos únicos: lograr algo en una sola partida.
-- Suma "la partida con menos": muertes en una partida (0 = sin morir) y victoria más rápida.

-- 1. Métricas permitidas.
alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion',
  'winrate', 'porcentaje_campeones',
  'manual'
));

-- 2. Acumulativas (totales, únicos y manual): sin muestra mínima.
alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion', 'manual'
  )) = (min_sample is not null));

-- 3. Dirección fija: totales y "más alto en una partida" son "al menos";
--    "más bajo en una partida" (muertes, duración) es "como máximo".
alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'manual'
  ) or operator = 'gte');

alter table public.personal_goals drop constraint if exists personal_goals_lowest_operator_chk;
alter table public.personal_goals add constraint personal_goals_lowest_operator_chk check (
  metric not in ('min_muertes', 'min_duracion') or operator = 'lte');

-- 4. "Una partida sin morir" necesita meta 0: el target pasa a admitir 0.
--    El resto de las métricas sigue exigiendo un mínimo positivo en la validación compartida.
alter table public.personal_goals drop constraint if exists personal_goals_target_check;
alter table public.personal_goals add constraint personal_goals_target_check check (target >= 0 and target <= 10000000);
