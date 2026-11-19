-- Rollback de 202611200020_yunara_image_url.sql (vuelve a la URL rota original).
update public.champions
set image_url = 'https://nhzyqyhgubsmvcsopvjb.supabase.co/storage/v1/object/public/riftdeck-assets/champions_icon/Yunara' || chr(10) || '.webp',
    image_url_card = 'https://nhzyqyhgubsmvcsopvjb.supabase.co/storage/v1/object/public/riftdeck-assets/champions_cards/Yunara' || chr(10) || '.webp'
where trim(name) = 'Yunara';
