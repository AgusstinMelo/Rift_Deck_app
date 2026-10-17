-- Objetivos "a medida": nuevas combinaciones de dato × cálculo.
-- Totales (suma de asesinatos, asistencias, oro y tiempo jugado) y mejor partida
-- (récord de asesinatos, asistencias, oro y KDA).

-- 1. Métricas permitidas.
alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda',
  'winrate', 'porcentaje_campeones',
  'manual'
));

-- 2. Acumulativas (totales, mejor partida y manual): sin muestra mínima y meta "al menos".
alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'manual'
  )) = (min_sample is not null));

alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'manual'
  ) or operator = 'gte');

-- 3. El oro total puede superar 100.000: se amplía el máximo del target.
alter table public.personal_goals drop constraint if exists personal_goals_target_check;
alter table public.personal_goals add constraint personal_goals_target_check check (target > 0 and target <= 10000000);
