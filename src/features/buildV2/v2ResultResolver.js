export function resolveV2Result(result, snapshot) {
  const items = new Map(snapshot.items.map(x => [String(x.id), x]));
  const runes = new Map(snapshot.runes.map(x => [String(x.id), x]));
  const spells = new Map(snapshot.spells.map(x => [String(x.id), x]));
  const resolve = (selection, map) => ({ ...selection, entity: map.get(selection.id) });

  return {
    ...result,
    core_items: result.core_items.map(x => resolve(x, items)),
    movement_item: resolve(result.movement_item, items),
    keystone: resolve(result.keystone, runes),
    primary_runes: result.primary_runes
      .map(x => resolve(x, runes))
      .sort((a, b) => Number(a.entity.group) - Number(b.entity.group)),
    secondary_rune: resolve(result.secondary_rune, runes),
    spells: result.spells.map(x => resolve(x, spells)),
  };
}
