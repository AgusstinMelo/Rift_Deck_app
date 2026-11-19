-- Yunara tenía un salto de línea antes de ".webp" en las dos URLs de imagen
-- (".../Yunara\n.webp"): Storage respondía 400 y la app mostraba la inicial "Y".
-- Los archivos reales son Yunara.webp. Se limpian espacios y saltos de línea.
update public.champions
set image_url = regexp_replace(image_url, '\s+', '', 'g'),
    image_url_card = regexp_replace(image_url_card, '\s+', '', 'g')
where image_url ~ '\s' or image_url_card ~ '\s';
