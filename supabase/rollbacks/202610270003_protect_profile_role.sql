-- Rollback de 202610270003_protect_profile_role.sql

drop trigger if exists profiles_protect_role on public.profiles;
drop function if exists public.profiles_protect_role();
