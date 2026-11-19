-- Clases de los objetos de soporte con misión, iguales a las de su mejora (202611200019):
-- Hoz Espectral → Guadaña de Niebla Oscura (supports de daño o poke); Escudo Reliquia →
-- Baluarte de la Montaña (tanques y encantadores). La ficha los muestra como "Ideal para supports".
update public.wr_items set fits_classes = array['tirador', 'mago', 'asesino', 'luchador'] where trim(name) = 'Hoz Espectral';
update public.wr_items set fits_classes = array['tanque', 'soporte'] where trim(name) = 'Escudo Reliquia';
