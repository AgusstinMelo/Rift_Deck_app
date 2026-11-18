import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogProblems, patchOverrideProblems } from '../../src/features/coach/taxonomy.js';

const base = [
  { id: 'aceleracion', name: 'Leyenda: Aceleración', description: 'Texto', trigger_tags: ['derribo'], counters: [], tags: ['x'] },
  { id: 'demolicion', name: 'Demolición', description: 'Texto nuevo', trigger_tags: ['autoataque'], counters: [] },
  { id: 'tenacidad', name: 'Leyenda: Tenacidad', description: 'Texto', trigger_tags: ['derribo'], counters: [] },
];

test('base y parche activo iguales: sin problemas', () => {
  const patch = [{ rune_id: 'demolicion', data: { description: 'Texto nuevo', lifesteal: 0, updated_date: 'hoy' } }];
  assert.deepEqual(patchOverrideProblems({ label: 'Runa', base, patch, key: 'rune_id' }), []);
});

test('marca el null del parche que tapa la base, el texto distinto y el perfil manual en el parche', () => {
  const patch = [
    { rune_id: 'aceleracion', data: { trigger_tags: null, tags: null } },
    { rune_id: 'demolicion', data: { description: 'Texto viejo', counters: ['kiteo'] } },
    { rune_id: 'tenacidad', data: { active: false, description: 'Copia equivocada' } },
  ];
  const problems = patchOverrideProblems({ label: 'Runa', base, patch, key: 'rune_id' });
  assert.equal(problems.length, 3);
  assert.ok(problems[0].includes('Leyenda: Aceleración: trigger_tags vale null'));
  assert.ok(problems.some(problem => problem.includes('Demolición: description es distinto')));
  assert.ok(problems.some(problem => problem.includes('Demolición: counters está en el parche')));
});

test('trigger_tags y benefit_tags de runas usan la lista cerrada', () => {
  const runes = [
    { name: 'Conquistador', branch: 'Clave', trigger_tags: ['golpe_consecutivo'], benefit_tags: ['curacion'] },
    { name: 'Leyenda: Aceleración', branch: 'Precisión', trigger_tags: null, benefit_tags: null },
    { name: 'Electrocutar', branch: 'Clave', trigger_tags: [] },
  ];
  const problems = catalogProblems({ runes });
  assert.ok(problems.some(problem => problem.includes('Conquistador: trigger_tags "golpe_consecutivo"')));
  assert.ok(problems.some(problem => problem.includes('Electrocutar: runa clave sin trigger_tags')));
  assert.equal(problems.length, 2);
});

test('fits_classes de objetos: lista cerrada y cobertura de objetos terminados', async () => {
  const { catalogProblems, catalogCoverage } = await import('../../src/features/coach/taxonomy.js');
  const items = [
    { name: 'Sterak', category: 'Mejorado', type: ['Daño Fisico'], effect_tags: ['escudo'], good_against: [], avoid_against: [], fits_classes: ['luchador'] },
    { name: 'Raro', category: 'Mejorado', type: ['Daño Fisico'], effect_tags: ['escudo'], good_against: [], avoid_against: [], fits_classes: ['bruiser'] },
    { name: 'Botas', category: 'Mejorado', type: ['Movimiento'], effect_tags: [], fits_classes: [] },
  ];
  assert.ok(catalogProblems({ items }).includes('Raro: fits_classes "bruiser" no está en la lista cerrada'));
  assert.equal(catalogCoverage({ items })['Objetos terminados con clases'], '2/2');
});
