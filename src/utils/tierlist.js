export const normalizeChampionName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const normalizeTierlistSnapshotRecord = (record = {}) => {
  const rawPatch = String(record.patch || '').trim();
  const legacyDateMatch = rawPatch.match(/\s+(\d{2})-(\d{2})-(\d{4})\s*$/);
  const normalizedPatch = legacyDateMatch
    ? rawPatch.replace(/\s+\d{2}-\d{2}-\d{4}\s*$/, '').trim()
    : rawPatch;
  const legacyDate = legacyDateMatch
    ? `${legacyDateMatch[3]}-${legacyDateMatch[2]}-${legacyDateMatch[1]}`
    : '';
  const snapshotDate = String(
    legacyDate || record.snapshot_date || record.executed_at || record.updated_at || ''
  ).slice(0, 10);
  const snapshotKey = normalizedPatch && snapshotDate
    ? `${normalizedPatch.toLowerCase()}::${snapshotDate}`
    : String(record.snapshot_key || '');

  return {
    ...record,
    patch: normalizedPatch || rawPatch,
    snapshot_date: snapshotDate || null,
    snapshot_key: snapshotKey,
  };
};

const getEntryTime = (entry) =>
  new Date(entry?.updated_at || entry?.created_date || entry?.updated_date || 0).getTime() || 0;

export const getLatestSuccessfulExecution = (executions = []) =>
  [...executions]
    .filter(execution => execution.status === 'success' || execution.status === 'partial')
    .sort((a, b) => new Date(b.executed_at || 0) - new Date(a.executed_at || 0))[0] || null;

export const getCurrentTierlistEntries = (tierlist = [], executions = []) => {
  const latestExecution = getLatestSuccessfulExecution(executions);
  const activeSnapshotKey = latestExecution?.snapshot_key;
  const activePatch = latestExecution?.patch ||
    [...new Set(tierlist.map(entry => entry.patch).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];

  const patchEntries = activeSnapshotKey
    ? tierlist.filter(entry => entry.snapshot_key === activeSnapshotKey)
    : tierlist.filter(entry => entry.patch === activePatch);
  const newestByChampionLane = new Map();

  for (const entry of patchEntries) {
    const key = [
      entry.champion_id || entry.external_id || normalizeChampionName(entry.champion_name),
      entry.lane || '',
    ].join('|');

    const current = newestByChampionLane.get(key);

    if (!current || getEntryTime(entry) >= getEntryTime(current)) {
      newestByChampionLane.set(key, entry);
    }
  }

  return [...newestByChampionLane.values()].sort((a, b) => {
    return (b.ranking_final || 0) - (a.ranking_final || 0);
  });
};

export const getTierEntriesForChampion = (champion, currentTierlist = []) => {
  const champNames = [
    champion?.name,
    champion?.original_name,
  ].map(normalizeChampionName).filter(Boolean);

  return currentTierlist.filter(entry => {
    const sameId = Boolean(
      (champion?.id && entry.champion_id === champion.id) ||
      (champion?.external_id && entry.external_id === champion.external_id)
    );

    if (sameId) return true;

    const tierNames = [
      entry.champion_name,
      entry.normalized_name,
      entry.original_name,
    ].map(normalizeChampionName).filter(Boolean);

    return tierNames.some(name => champNames.includes(name));
  });
};

export const getBestTierForChampion = (champion, currentTierlist = []) =>
  getTierEntriesForChampion(champion, currentTierlist)[0] || null;
