import { supabase } from "@/lib/supabaseClient";
import { normalizePatchAverage, normalizeTierlistSnapshotRecord } from '@/utils/tierlist';

export async function getTierlistEntries(order = "-ranking_final", limit = 1000, filters = {}) {
  const orderConfig = order === "-updated_at"
    ? { column: "updated_at", ascending: false }
    : { column: "ranking_final", ascending: false };

  const requestedSnapshotKeys = [filters.snapshotKey, ...(filters.snapshotKeys || [])].filter(Boolean);

  const buildQuery = ({ useSnapshotColumns = true, fallbackLimit = limit } = {}) => {
    let query = supabase
      .from("tierlist_entries")
      .select("*")
      .order(orderConfig.column, { ascending: orderConfig.ascending });

    if (filters.patch) query = query.eq("patch", filters.patch);
    // Historial de un campeón: evita traer las tablas completas de cada snapshot.
    if (filters.championNames?.length) query = query.in("champion_name", filters.championNames);
    if (filters.patches?.length) query = query.in("patch", filters.patches);

    if (useSnapshotColumns) {
      if (filters.snapshotKey) query = query.eq("snapshot_key", filters.snapshotKey);
      if (filters.snapshotKeys?.length) query = query.in("snapshot_key", filters.snapshotKeys);
      if (filters.snapshotDate) query = query.eq("snapshot_date", filters.snapshotDate);
    } else if (requestedSnapshotKeys.length) {
      const patches = [...new Set(requestedSnapshotKeys.map(key => key.split('::')[0]).filter(Boolean))];
      if (patches.length) {
        query = query.or(patches.map(patch => `patch.ilike.${patch}%`).join(','));
      }
    }

    if (fallbackLimit) query = query.limit(fallbackLimit);
    return query;
  };

  let { data, error } = await buildQuery();

  // Compatibility path for databases that have not backfilled snapshot_key yet.
  if (requestedSnapshotKeys.length && (error || !data?.length)) {
    const fallback = await buildQuery({
      useSnapshotColumns: false,
      fallbackLimit: Math.max(Number(limit) || 0, 5000),
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  let normalized = (data || []).map(normalizeTierlistSnapshotRecord);
  if (requestedSnapshotKeys.length) {
    const requested = new Set(requestedSnapshotKeys);
    normalized = normalized.filter(entry => requested.has(entry.snapshot_key));
  }
  if (filters.snapshotDate) {
    normalized = normalized.filter(entry => entry.snapshot_date === filters.snapshotDate);
  }

  return normalized;
}

export async function getTierlistExecutions(limit = 10) {
  let query = supabase
    .from("tierlist_executions")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .order("executed_at", { ascending: false });

  if (limit) {
    query = query.limit(limit * 3);
  }

  let { data, error } = await query;

  // Old schemas do not have snapshot_date yet. Keep the app readable while
  // the migration is being applied and derive the snapshot from legacy patch.
  if (error) {
    let fallbackQuery = supabase
      .from("tierlist_executions")
      .select("*")
      .order("executed_at", { ascending: false });
    if (limit) fallbackQuery = fallbackQuery.limit(limit * 3);
    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  // One row per snapshot; a later failed run must not hide a successful one.
  const isSuccessful = execution => execution.status === 'success' || execution.status === 'partial';
  const bySnapshot = new Map();
  (data || []).map(normalizeTierlistSnapshotRecord).forEach(execution => {
    const snapshotIdentity = execution.snapshot_key || String(execution.id);
    const current = bySnapshot.get(snapshotIdentity);
    if (!current || (!isSuccessful(current) && isSuccessful(execution))) {
      bySnapshot.set(snapshotIdentity, execution);
    }
  });
  const uniqueExecutions = [...bySnapshot.values()];

  return limit ? uniqueExecutions.slice(0, limit) : uniqueExecutions;
}

export async function getTierlistConfig() {
  const { data, error } = await supabase
    .from("tierlist_configs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getTierlistPatchGroups(limit = 10) {
  let query = supabase
    .from("tierlist_patch_groups")
    .select("*")
    .order("last_snapshot_date", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Promedio acumulado de uno o más grupos de parche (7.3 = 7.3, 7.3a, 7.3b...).
export async function getTierlistPatchAverages(patchGroups = []) {
  const groups = [...new Set(patchGroups.filter(Boolean))];
  if (!groups.length) return [];

  const { data, error } = await supabase
    .from("tierlist_patch_averages")
    .select("*")
    .in("patch_group", groups)
    .order("ranking_final", { ascending: false })
    .limit(1000 * groups.length);

  if (error) throw error;
  return (data || []).map(normalizePatchAverage);
}

export async function getCurrentTierlist() {
  const [latestGroup] = await getTierlistPatchGroups(1);
  return latestGroup ? getTierlistPatchAverages([latestGroup.patch_group]) : [];
}

export async function getRecentTierlistRuns(limit = 7) {
  const { data, error } = await supabase
    .from("tierlist_executions")
    .select("id, patch, snapshot_date, executed_at, status, champions_processed, error_message, weights_used")
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
