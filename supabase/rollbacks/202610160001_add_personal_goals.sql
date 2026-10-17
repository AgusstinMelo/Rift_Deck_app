-- Rollback de 202610160001_add_personal_goals.sql
-- Elimina objetivos y check-ins (con sus datos). No restaura NOT NULL en matches.kills/deaths/assists:
-- si hay filas con null, primero habría que decidir cómo completarlas.

drop table if exists public.personal_goal_checkins;
drop table if exists public.personal_goals;

drop function if exists public.personal_goal_checkins_validate();
drop function if exists public.personal_goals_enforce_edit_rules();
drop function if exists public.personal_goals_validate_timezone();
drop function if exists public.personal_goals_touch_updated_at();
