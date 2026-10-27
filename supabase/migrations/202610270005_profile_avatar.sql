-- profiles.avatar_url: imagen de perfil elegida en la app.
--
-- Antes se guardaba en auth.users.user_metadata.avatar_url, pero Supabase pisa ese
-- metadata con los datos de Google en cada login con Google: la imagen elegida se
-- perdía al volver a entrar. En profiles no la toca nadie más que el usuario.
-- Si avatar_url es null, la app muestra la foto de Google (si la hay).

alter table public.profiles
  add column if not exists avatar_url text;

-- Se pasan las imágenes elegidas en la app que todavía estén en el metadata
-- (las de Google no: siguen viniendo del login).
update public.profiles p
set avatar_url = u.raw_user_meta_data->>'avatar_url'
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and coalesce(u.raw_user_meta_data->>'avatar_url', '') <> ''
  and u.raw_user_meta_data->>'avatar_url' not like '%googleusercontent.com%';
