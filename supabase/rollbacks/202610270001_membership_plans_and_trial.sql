-- Rollback de 202610270001_membership_plans_and_trial.sql
-- Los checks de status/provider ampliados no se revierten: aceptan un superconjunto
-- de los valores anteriores.

drop function if exists public.start_membership_trial();
drop function if exists public.get_my_membership();
drop function if exists public.membership_trial_available(uuid);
drop function if exists public.has_premium_access();
drop function if exists public.membership_access_until(public.memberships);

drop index if exists public.memberships_user_created_idx;
drop index if exists public.memberships_one_trial_per_user_idx;

drop policy if exists membership_plans_public_read on public.membership_plans;

-- Las pruebas pasan a expired para que no queden filas trialing sin función que las lea.
update public.memberships set status = 'expired', updated_at = now()
where provider = 'trial' and status = 'trialing';

delete from public.membership_plans p
where p.code in ('premium_quarterly', 'premium_annual', 'trial')
  and not exists (select 1 from public.memberships m where m.plan_code = p.code);

update public.membership_plans set name = 'Premium', updated_at = now() where code = 'premium';

alter table public.membership_plans drop column if exists sort_order;
alter table public.membership_plans drop column if exists paypal_plan_id;
alter table public.membership_plans drop column if exists amount_usd;
alter table public.membership_plans drop column if exists interval_months;
