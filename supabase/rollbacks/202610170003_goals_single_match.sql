-- Rollback de 202610170003_goals_single_match.sql
-- Falla si existen objetivos min_muertes / min_duracion o con target 0: archivalos o eliminalos antes.

alter table public.personal_goals drop constraint if exists personal_goals_lowest_operator_chk;

alter table public.personal_goals drop constraint if exists personal_goals_target_check;
alter table public.personal_goals add constraint personal_goals_target_check check (target > 0 and target <= 10000000);

alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda',
  'winrate', 'porcentaje_campeones',
  'manual'
));

alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in (
    'partidas_registradas', 'victorias', 'suma_asesinatos', 'suma_asistencias', 'suma_oro', 'suma_duracion',
    'max_asesinatos', 'max_asistencias', 'max_oro', 'max_kda', 'manual'
  )) = (min_sample is not null));
