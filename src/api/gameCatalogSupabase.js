import { supabase } from '@/lib/supabaseClient';

export async function getPublishedGamePatches() {
  const { data, error } = await supabase
    .from('game_patches')
    .select('id, version, status, release_at, created_at')
    .in('status', ['active', 'archived'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getGamePatchCatalog(version) {
  if (!version) return { champions: [], items: [], runes: [] };
  const { data, error } = await supabase.rpc('get_game_patch_catalog', { p_version: version });
  if (error) {
    const [championResult, itemResult, runeResult] = await Promise.all([
      supabase.from('current_champions').select('*'),
      supabase.from('current_wr_items').select('*').eq('active', true),
      supabase.from('current_runes').select('*'),
    ]);
    const fallbackError = championResult.error || itemResult.error || runeResult.error;
    const currentVersion = championResult.data?.[0]?.patch_version;

    if (!fallbackError && currentVersion === version) {
      return {
        patchId: championResult.data?.[0]?.patch_id,
        patchVersion: currentVersion,
        champions: championResult.data || [],
        items: itemResult.data || [],
        runes: runeResult.data || [],
      };
    }

    throw new Error('El catálogo histórico no está habilitado en Supabase. Aplicá la migración 202609210005_add_historical_patch_catalog.sql.');
  }
  return data || { champions: [], items: [], runes: [] };
}
