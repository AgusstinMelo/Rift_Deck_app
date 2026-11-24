-- Rollback de 202611240001_google_play_billing.sql
-- Las membresías anonimizadas (user_id null) no tienen a quién volver: se borran antes de
-- restaurar el NOT NULL y el ON DELETE CASCADE.

delete from public.memberships where user_id is null;
alter table public.memberships drop constraint if exists memberships_user_id_fkey;
alter table public.memberships add constraint memberships_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.memberships alter column user_id set not null;

drop index if exists public.memberships_google_play_token_idx;
drop index if exists public.membership_plans_google_play_product_idx;
alter table public.membership_plans drop column if exists google_play_product_id;
