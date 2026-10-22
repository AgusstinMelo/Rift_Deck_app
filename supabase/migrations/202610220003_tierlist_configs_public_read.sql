-- La página "Cómo calculamos la tierlist" es visible para todos los usuarios:
-- cualquier usuario logueado puede leer los pesos. Guardarlos sigue siendo solo para admins.

drop policy if exists tierlist_configs_read on public.tierlist_configs;
create policy tierlist_configs_read on public.tierlist_configs
  for select to authenticated using (true);

grant select on public.tierlist_configs to authenticated;
