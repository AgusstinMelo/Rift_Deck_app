-- Rollback de 202611200019_support_starter_fits_classes.sql
update public.wr_items set fits_classes = '{}' where trim(name) in ('Guadaña de Niebla Oscura', 'Baluarte de la Montaña');
