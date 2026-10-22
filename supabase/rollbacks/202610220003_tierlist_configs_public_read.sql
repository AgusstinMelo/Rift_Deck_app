-- Rollback de 202610220003_tierlist_configs_public_read.sql

drop policy if exists tierlist_configs_read on public.tierlist_configs;
