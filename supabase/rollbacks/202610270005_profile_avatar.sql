-- Rollback de 202610270005_profile_avatar.sql

alter table public.profiles
  drop column if exists avatar_url;
