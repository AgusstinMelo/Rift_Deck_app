-- Pestaña DATOS de la carga con capturas (opcional): por jugador, daño infligido, daño
-- recibido, curación y escudos y participación en peleas (%). El oro ya estaba (sale
-- del marcador y DATOS lo confirma). Se guardan solo los valores leídos con confianza
-- alta; si no se subió esa captura quedan en null.

alter table public.match_participants
  add column if not exists damage_dealt integer check (damage_dealt is null or damage_dealt >= 0),
  add column if not exists damage_taken integer check (damage_taken is null or damage_taken >= 0),
  add column if not exists healing_shielding integer check (healing_shielding is null or healing_shielding >= 0),
  add column if not exists teamfight_participation smallint
    check (teamfight_participation is null or teamfight_participation between 0 and 100);
