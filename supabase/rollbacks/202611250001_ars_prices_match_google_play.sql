-- Rollback de 202611250001_ars_prices_match_google_play.sql
update public.membership_plans set amount_ars = 3000,  updated_at = now() where code = 'premium';
update public.membership_plans set amount_ars = 8500,  updated_at = now() where code = 'premium_quarterly';
update public.membership_plans set amount_ars = 30000, updated_at = now() where code = 'premium_annual';
