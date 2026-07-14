export const championSlug = (name = '') =>
  String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const findChampionBySlug = (champions, slug) =>
  champions.find(champion => championSlug(champion.name) === slug) || null;
