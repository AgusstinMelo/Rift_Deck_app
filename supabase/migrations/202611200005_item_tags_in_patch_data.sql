-- effect_tags y situational_role de todos los objetos también en el JSON de cada parche
-- (item_patch_data.data), para editar cada objeto en un solo lugar. Se copia el valor que
-- la app ve hoy: el del parche si ya lo tenía, si no el de wr_items. Los parches nuevos
-- copian el JSON del activo (create_patch_from_current), así que los tags se arrastran.
update public.item_patch_data d
set data = d.data || jsonb_build_object(
  'effect_tags', coalesce(nullif(d.data -> 'effect_tags', 'null'::jsonb), to_jsonb(i.effect_tags), '[]'::jsonb),
  'situational_role', coalesce(nullif(d.data -> 'situational_role', 'null'::jsonb), to_jsonb(i.situational_role), '[]'::jsonb)
)
from public.wr_items i
where d.item_id = i.id::text;
