const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const flattenText = values => normalizeText(values.flat(Infinity).filter(Boolean).join(' '));

export function championCanHealOrShieldAllies(champion) {
  const capabilities = flattenText([
    champion?.traits,
    champion?.item_scalings,
    champion?.tags,
    champion?.strategic_notes,
  ]);
  return [
    'curacion_aliada',
    'escudo_aliado',
    'poder_curacion',
    'poder_escudo',
    'curacion a aliados',
    'escudo a aliados',
  ].some(capability => capabilities.includes(capability));
}

export function requiresChampionAllyHealOrShield(entity) {
  const description = normalizeText(entity?.description);
  const triggers = flattenText([entity?.trigger_tags]);
  const conditionalDescription = [
    /cuando curas o escudas a un campeon aliado/,
    /curar u otorgar escudos a un aliado/,
    /habilidad que lances para curar u otorgar un escudo a un aliado/,
    /si otorgas a un aliado curaciones o escudos/,
    /al curar y otorgar escudos/,
  ].some(pattern => pattern.test(description));
  const onlyHealShieldTriggers = triggers &&
    ['curar', 'escudar'].some(trigger => triggers.includes(trigger)) &&
    !['autoataque', 'impacto', 'recibir dano', 'cerca aliado', 'lanzar ulti'].some(trigger => triggers.includes(trigger));
  return conditionalDescription || Boolean(onlyHealShieldTriggers);
}

export function createEligibleV2Snapshot(snapshot, championId) {
  const champion = snapshot.champions.find(candidate => String(candidate.id) === String(championId));
  if (!champion || championCanHealOrShieldAllies(champion)) return snapshot;

  const coreItems = snapshot.coreItems.filter(item => !requiresChampionAllyHealOrShield(item));
  const runes = snapshot.runes.filter(rune => !requiresChampionAllyHealOrShield(rune));
  const eligibleCoreIds = new Set(coreItems.map(item => String(item.id)));
  const originalCoreIds = new Set(snapshot.coreItems.map(item => String(item.id)));
  const items = snapshot.items.filter(item =>
    !originalCoreIds.has(String(item.id)) || eligibleCoreIds.has(String(item.id))
  );
  return { ...snapshot, items, coreItems, runes };
}
