-- Rollback de 202611200014_orb_counters_revert.sql
update public.runes set counters = array['daño_magico']
where id::text = '6a04bc5f681bf773dac12aa2';
