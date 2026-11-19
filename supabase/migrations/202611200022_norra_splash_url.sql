-- El splash de Norra apuntaba a "champions_splash/d8d9c469…-1280x720.jpg", que no existe en
-- Storage (respondía 400 y la ficha quedaba sin imagen). El archivo real, subido el
-- 17/11/2026, es champions_splash/Norra.jpg.
update public.champions
set image_url_splash = 'https://nhzyqyhgubsmvcsopvjb.supabase.co/storage/v1/object/public/riftdeck-assets/champions_splash/Norra.jpg'
where image_url_splash = 'https://nhzyqyhgubsmvcsopvjb.supabase.co/storage/v1/object/public/riftdeck-assets/champions_splash/d8d9c469381457eaf7387d10a79451bfd6b7a143-1280x720.jpg';
