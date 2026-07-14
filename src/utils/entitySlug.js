export const entitySlug = (name = '') =>
  String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const findEntityBySlug = (entities = [], slug = '') =>
  entities.find(entity => entitySlug(entity.name) === slug) || null;
