-- Al cargar el perfil del Coach (team_roles y score_*) desde una exportación vieja de
-- champions, volvieron a la base las estadísticas anteriores al parche 7.3f en 32
-- campeones. Se vuelven a copiar desde el parche activo; el perfil del Coach no se toca
-- (está excluido de la sincronización).

do $$
declare
  result record;
begin
  for result in select * from public.sync_catalog_base_from_patch_id((select active_patch_id from public.game_state where id = 1))
  loop
    raise notice '%: % copiadas, % fallidas', result.tabla, result.copiadas, result.fallidas;
    if result.fallidas > 0 then
      raise exception '% filas de % no se pudieron copiar; revisá los avisos', result.fallidas, result.tabla;
    end if;
  end loop;
end;
$$;
