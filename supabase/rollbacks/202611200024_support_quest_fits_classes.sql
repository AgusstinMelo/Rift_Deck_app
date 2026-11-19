-- Rollback de 202611200024_support_quest_fits_classes.sql
update public.wr_items set fits_classes = '{}' where trim(name) in ('Hoz Espectral', 'Escudo Reliquia');
