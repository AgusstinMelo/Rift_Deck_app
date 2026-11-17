-- Rollback de 202611180001_public_profile.sql
drop function if exists public.get_public_profile(text);
drop index if exists public.profiles_public_slug_key;
alter table public.profiles drop constraint if exists profiles_public_slug_format;
alter table public.profiles
  drop column if exists public_slug,
  drop column if exists public_profile;
