-- Recuperada del historial remoto (supabase_migrations.schema_migrations) el 16/11/2026:
-- se había aplicado en producción sin que el archivo llegara al repo.

-- Clarify Kai'Sa's Wild Rift evolution mechanic in the champion fact source.
-- Keep base data and existing patch snapshots aligned because current_champions
-- overlays champion_patch_stats.data on top of champions.
do $$
declare
  evolution_note constant text :=
    'Las habilidades evolucionan únicamente al completar objetos de categoría Mejorado: el primer objeto Mejorado permite evolucionar una habilidad a elección, el segundo permite evolucionar una segunda y el tercero la habilidad restante. No requiere alcanzar estadísticas concretas y el orden de evolución es libre. Entra con definitiva sólo cuando el objetivo ya está marcado y aislado.';
begin
  update public.champions
  set strategic_notes = evolution_note
  where name = 'Kai''Sa';

  update public.champion_patch_stats d
  set data = jsonb_set(d.data, '{strategic_notes}', to_jsonb(evolution_note), true)
  from public.champions c
  where c.name = 'Kai''Sa'
    and d.champion_id = c.id::text;
end
$$;
