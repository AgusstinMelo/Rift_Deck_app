-- Rollback de 202610170002_goals_custom_calculations.sql
-- Falla si existen objetivos con las métricas suma_* o max_*, o con target > 100000: archivalos o eliminalos antes.

alter table public.personal_goals drop constraint if exists personal_goals_target_check;
alter table public.personal_goals add constraint personal_goals_target_check check (target > 0 and target <= 100000);

alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'winrate', 'porcentaje_campeones',
  'manual'
));

alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in ('partidas_registradas', 'victorias', 'manual')) = (min_sample is not null));

alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in ('partidas_registradas', 'victorias', 'manual') or operator = 'gte');
