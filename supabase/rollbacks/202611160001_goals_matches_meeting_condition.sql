-- Rollback de 202611160001_goals_matches_meeting_condition.sql
-- Falla si existen objetivos partidas_asesinatos / partidas_muertes / partidas_asistencias /
-- partidas_kda / partidas_oro: archivalos o eliminalos antes.

alter table public.personal_goals drop constraint if exists personal_goals_condition_chk;

alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion',
  'winrate', 'porcentaje_campeones',
  'manual'
));

alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'min_muertes', 'min_duracion', 'manual'
  )) = (min_sample is not null));

alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'manual'
  ) or operator = 'gte');
