-- Corrige 202611200013: en Wild Rift el escudo de Orbe de Anulación absorbe daño de
-- cualquier tipo (en PC es solo mágico). Vuelve a sus counters anteriores.
update public.runes set counters = array['burst']
where id::text = '6a04bc5f681bf773dac12aa2';
