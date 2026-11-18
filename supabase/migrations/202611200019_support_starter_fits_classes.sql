-- Clases de los objetos de soporte inicial (Build V2 los pone en el slot 1 en Support):
-- Guadaña de Niebla Oscura para supports de daño o poke; Baluarte de la Montaña para
-- tanques y encantadores.
update public.wr_items set fits_classes = array['tirador', 'mago', 'asesino', 'luchador'] where trim(name) = 'Guadaña de Niebla Oscura';
update public.wr_items set fits_classes = array['tanque', 'soporte'] where trim(name) = 'Baluarte de la Montaña';
