import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_FIELDS,
  buildModelJsonSchema,
  mergeCaptures,
  validateCaptureResponse,
} from '../../supabase/functions/_shared/matchCapture.js';
import {
  fieldsToPrefill,
  runeBranchesFor,
  secondsToMinutes,
  teamToSlots,
} from '../../src/features/matchCapture/captureFields.js';
import { assignCodes, buildCodeMaps, catalogSignature } from '../../src/features/matchCapture/referenceCodes.js';
import {
  EMPTY_SPREAD,
  SHAPES,
  bestMatch,
  buildMask,
  matchConfidence,
  searchWindows,
  toFeature,
} from '../../src/features/matchCapture/iconMatcher.js';
import { assignUnique, runesFromModelNames } from '../../src/features/matchCapture/iconIdentify.js';

// Respuesta del modelo con todos los campos "sin leer" (confidence none).
const MISSING_ENTRY = { code: '', enum: 'unknown', count: 0, amount: 0, codes: [], team: [] };
const EMPTY_FIELDS = Object.fromEntries(CAPTURE_FIELDS.map(({ key, kind }) => [key, { value: MISSING_ENTRY[kind], confidence: 'none' }]));

const capture = (imageIndex, fields = {}, extra = {}) => ({
  image_index: imageIndex,
  screen: 'scoreboard',
  rune_names: [],
  fields: { ...EMPTY_FIELDS, ...fields },
  ...extra,
});

const field = (value, confidence = 'high') => ({ value, confidence });

const validated = captures => {
  const result = validateCaptureResponse({ captures }, { imageCount: captures.length });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.captures;
};

// ── Esquema ─────────────────────────────────────────────────────────────────

test('el modelo lee los datos de la partida; objetos, runas y hechizos solo se ubican', () => {
  const keys = CAPTURE_FIELDS.map(({ key }) => key);
  for (const key of ['champion', 'lane', 'result', 'match_type', 'kills', 'deaths', 'assists', 'duration_seconds', 'gold', 'allies', 'enemies']) {
    assert.ok(keys.includes(key), key);
  }
  for (const key of ['side', 'damage', 'items', 'runes', 'spells']) assert.equal(keys.includes(key), false, key);

  const captureSchema = buildModelJsonSchema().properties.captures.items;
  assert.deepEqual(captureSchema.required, ['image_index', 'screen', 'rune_names', 'fields']);
  assert.equal('icon_boxes' in captureSchema.properties, false);
});

test('el JSON Schema no usa nulls ni anyOf y no admite campos extra', () => {
  const schema = buildModelJsonSchema();
  const text = JSON.stringify(schema);
  assert.equal(text.includes('anyOf'), false);
  assert.equal(text.includes('"null"'), false);
  assert.equal(schema.properties.captures.items.properties.fields.additionalProperties, false);
});

// ── Validación del JSON del modelo ──────────────────────────────────────────

test('valida códigos de campeón y los normaliza a mayúsculas', () => {
  const [result] = validated([capture(0, {
    champion: field(' c12 '),
    lane: field('adc'),
    allies: field([{ champion: 'C7', lane: 'support' }, { champion: 'c8', lane: 'unknown' }]),
  })]);
  assert.equal(result.fields.champion.value, 'C12');
  assert.deepEqual(result.fields.allies.value, [{ champion: 'C7', lane: 'support' }, { champion: 'C8', lane: null }]);
  assert.deepEqual(result.fields.gold, { value: null, confidence: null });
});

test('los valores inválidos quedan como faltantes sin tirar abajo el resto de la lectura', () => {
  const result = validateCaptureResponse({ captures: [capture(0, {
    champion: field('Ahri'),                                  // nombre en lugar de código
    enemies: field([{ champion: 'C1', lane: 'bot' }]),        // línea inválida
    kills: field(-1),
    deaths: field(2.5),
    result: field('victory'),
    assists: field(7),                                        // válido
    gold: field(10674),                                       // válido
  })] }, { imageCount: 1 });
  assert.equal(result.ok, true);
  const [read] = result.captures;
  for (const key of ['champion', 'enemies', 'kills', 'deaths', 'result']) assert.deepEqual(read.fields[key], { value: null, confidence: null }, key);
  assert.equal(read.fields.assists.value, 7);
  assert.equal(read.fields.gold.value, 10674);
  assert.ok(result.warnings.length >= 5);
});

test('campos ausentes, confianza rara y pantalla desconocida no invalidan la respuesta', () => {
  const result = validateCaptureResponse({ captures: [{
    image_index: 0,
    screen: 'lobby',
    fields: { kills: { value: 4, confidence: 'muy alta' }, deaths: { value: 0 } },
  }] }, { imageCount: 1 });
  assert.equal(result.ok, true);
  const [read] = result.captures;
  assert.equal(read.screen, null);
  assert.equal(read.isResultScreen, true);
  assert.deepEqual(read.fields.kills, { value: 4, confidence: 'low' });
  assert.deepEqual(read.fields.deaths, { value: 0, confidence: 'low' });
  assert.deepEqual(read.fields.gold, { value: null, confidence: null });
  assert.deepEqual(read.runeNames, []);
});

test('confidence "none", opciones "unknown" y listas vacías cuentan como faltantes', () => {
  const [result] = validated([capture(0, {
    match_type: field('unknown', 'low'),
    champion: field('', 'medium'),
    gold: { value: null, confidence: 'high' },
  })]);
  for (const key of ['match_type', 'champion', 'gold', 'enemies']) {
    assert.deepEqual(result.fields[key], { value: null, confidence: null }, key);
  }
});

test('limpia los nombres de runas inválidos', () => {
  const [result] = validated([capture(0, {}, {
    screen: 'runes',
    rune_names: ['CADENCIA LETAL', '', 42, 'x'.repeat(61)],
  })]);
  assert.equal(result.screen, 'runes');
  assert.deepEqual(result.runeNames, ['CADENCIA LETAL']);
});

test('descarta capturas con índice inválido o repetido (por ejemplo, una entrada para la lámina) y conserva el resto', () => {
  assert.equal(validateCaptureResponse(null, { imageCount: 1 }).ok, false);
  assert.equal(validateCaptureResponse({ captures: [] }, { imageCount: 1 }).ok, false);
  assert.equal(validateCaptureResponse({ captures: [capture(3)] }, { imageCount: 1 }).ok, false); // nada usable

  const result = validateCaptureResponse({ captures: [
    capture(2, { kills: field(99) }),       // fuera de rango (2 capturas → índices 0 y 1)
    capture(0, { kills: field(4) }),
    capture(0, { kills: field(5) }),        // repetido
    capture(1, { gold: field(10674) }),
  ] }, { imageCount: 2 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.captures.map(read => read.imageIndex), [0, 1]);
  assert.equal(result.captures[0].fields.kills.value, 4);
});

// ── Unificación de capturas ─────────────────────────────────────────────────

test('unifica campos entre capturas y devuelve los nombres de runas leídos', () => {
  const merged = mergeCaptures(validated([
    capture(0, { champion: field('C1'), result: field('win'), kills: field(8, 'low') }),
    capture(1, { kills: field(6, 'high') }, { screen: 'runes', rune_names: ['CORTE'] }),
  ]));
  assert.equal(merged.fields.result.value, 'win');
  assert.equal(merged.fields.kills.value, 6);
  assert.equal(merged.fields.kills.conflict, true);
  assert.equal(merged.fields.kills.needsReview, true);
  assert.deepEqual(merged.runeNames, [{ imageIndex: 1, names: ['CORTE'] }]);
});

test('con la misma confianza gana la primera captura; los equipos se comparan sin importar el orden', () => {
  const { fields } = mergeCaptures(validated([
    capture(0, { kills: field(8, 'medium'), enemies: field([{ champion: 'C5', lane: 'adc' }, { champion: 'C9', lane: 'mid' }]) }),
    capture(1, { kills: field(6, 'medium'), enemies: field([{ champion: 'C9', lane: 'unknown' }, { champion: 'C5', lane: 'adc' }]) }),
  ]));
  assert.equal(fields.kills.value, 8);
  assert.equal(fields.enemies.conflict, false);
});

test('ignora capturas que no son de resultados, salvo que no haya otra', () => {
  const mixed = mergeCaptures(validated([
    capture(0, { kills: field(99, 'high') }, { screen: 'other' }),
    capture(1, { kills: field(4, 'medium') }),
  ]));
  assert.equal(mixed.fields.kills.value, 4);
  assert.deepEqual(mixed.ignoredImages, [0]);
});

// ── Comparación de íconos (píxeles) ────────────────────────────────────────

/** Ícono sintético: cuadrantes de colores (o liso si `flat`). */
function syntheticIcon(shape, colors, { flat = false, noise = 0 } = {}) {
  const { size } = SHAPES[shape];
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = flat ? colors[0] : colors[(y < size / 2 ? 0 : 2) + (x < size / 2 ? 0 : 1)];
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = Math.max(0, Math.min(255, color[channel] + (noise ? Math.sin(x * 7 + y * 3 + channel) * noise : 0)));
      }
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

const RED = [220, 40, 40]; const BLUE = [40, 60, 220]; const GOLD = [230, 190, 60]; const GREEN = [40, 200, 90];

test('identifica el ícono correcto aunque cambie el brillo, y detecta slots vacíos', () => {
  const mask = buildMask('square');
  const candidates = [
    { key: 'A', vector: toFeature(syntheticIcon('square', [RED, BLUE, GOLD, GREEN]), mask).vector },
    { key: 'B', vector: toFeature(syntheticIcon('square', [GREEN, GOLD, BLUE, RED]), mask).vector },
  ];
  // Mismo dibujo que A, más oscuro y con ruido.
  const darker = syntheticIcon('square', [RED, BLUE, GOLD, GREEN].map(color => color.map(value => value * 0.6)), { noise: 6 });
  const match = bestMatch([toFeature(darker, mask)], candidates);
  assert.equal(match.key, 'A');
  assert.equal(matchConfidence(match), 'high');

  const empty = toFeature(syntheticIcon('square', [[30, 34, 40]], { flat: true }), mask);
  assert.ok(empty.spread < EMPTY_SPREAD);
  assert.equal(bestMatch([empty], candidates).empty, true);
  assert.equal(matchConfidence({ empty: true }), null);
});

test('la confianza baja cuando dos candidatos se parecen mucho', () => {
  assert.equal(matchConfidence({ score: 0.95, margin: 0.3, empty: false }), 'high');
  assert.equal(matchConfidence({ score: 0.82, margin: 0.04, empty: false }), 'medium');
  assert.equal(matchConfidence({ score: 0.7, margin: 0.01, empty: false }), 'low');
});

test('la primera variante de recorte es la centrada', () => {
  const windows = searchWindows({ x: 100, y: 100, size: 20 });
  assert.deepEqual(windows[0], { sx: 90, sy: 90, side: 20 });
});

test('asigna runas sin repetir: la caja con menor parecido pasa a su siguiente candidata', () => {
  const assigned = assignUnique([
    { empty: false, ranking: [{ key: 'Corte', score: 0.95 }, { key: 'Brutalidad', score: 0.5 }] },
    { empty: false, ranking: [{ key: 'Corte', score: 0.8 }, { key: 'Brutalidad', score: 0.78 }] },
    { empty: true, ranking: [] },
  ]);
  assert.deepEqual(assigned.map(entry => entry.name), ['Corte', 'Brutalidad', null]);
  assert.equal(assigned[0].confidence, 'high');
});

test('las runas leídas como texto se resuelven contra el catálogo, ignorando mayúsculas y acentos', () => {
  const candidates = {
    keystones: [{ key: 'Cadencia Letal' }, { key: 'Conquistador' }],
    minorRunes: [{ key: 'Brutalidad' }, { key: 'Coraza Ósea' }, { key: 'Leyenda: Celeridad' }],
  };
  assert.deepEqual(
    runesFromModelNames([{ imageIndex: 1, names: ['CADENCIA LETAL', 'BRUTALIDAD', 'LEYENDA: CELERIDAD', 'CORAZA OSEA'] }], candidates).map(rune => rune.name),
    ['Cadencia Letal', 'Brutalidad', 'Leyenda: Celeridad', 'Coraza Ósea'],
  );
  // Si algún nombre no está en el catálogo, se prefiere la comparación de píxeles.
  assert.equal(runesFromModelNames([{ imageIndex: 0, names: ['CADENCIA LETAL', 'RUNA INVENTADA'] }], candidates), null);
  assert.equal(runesFromModelNames([], candidates), null);
});

// ── Códigos de la lámina de campeones ──────────────────────────────────────

const CHAMPIONS = [
  { id: 10, name: 'Malphite' },
  { id: 1, name: "Kai'Sa" },
  { id: 8, name: 'Ahri' },
  { id: 5, name: 'Jhin' },
  { id: 7, name: 'Leona' },
  { id: 9, name: 'Zed' },
];

test('asigna códigos deterministas ordenados por nombre', () => {
  assert.deepEqual(assignCodes(CHAMPIONS, 'C').map(({ code, entry }) => `${code}=${entry.name}`), [
    'C1=Ahri', 'C2=Jhin', "C3=Kai'Sa", 'C4=Leona', 'C5=Malphite', 'C6=Zed',
  ]);
  assert.deepEqual(assignCodes([...CHAMPIONS].reverse(), 'C'), assignCodes(CHAMPIONS, 'C'));
  const base = catalogSignature({ champions: CHAMPIONS });
  assert.equal(catalogSignature({ champions: [...CHAMPIONS] }), base);
  assert.notEqual(catalogSignature({ champions: [...CHAMPIONS, { id: 11, name: 'Nuevo' }] }), base);
});

// ── Precarga del formulario manual ─────────────────────────────────────────

const MAPS = buildCodeMaps({ champions: CHAMPIONS }); // C1 Ahri, C2 Jhin, C3 Kai'Sa, C4 Leona, C5 Malphite, C6 Zed

test('reparte las líneas del equipo sin repetir y respeta la línea propia', () => {
  const slots = teamToSlots([
    { champion: 'C4', lane: 'support' },
    { champion: 'C1', lane: 'adc' },   // adc ya es del jugador → línea libre
    { champion: 'C5', lane: null },
    { champion: 'C3', lane: 'adc' },   // el propio campeón se excluye
    { champion: 'C99', lane: 'top' },  // código inexistente
  ], MAPS.champions, { takenRoles: ['adc'], excludeNames: ["Kai'Sa"] });
  assert.deepEqual(slots, [
    { name: 'Leona', role: 'support' },
    { name: 'Ahri', role: 'top' },
    { name: 'Malphite', role: 'jungler' },
  ]);
});

test('pasa segundos a minutos', () => {
  assert.equal(secondsToMinutes(1112), 19);
  assert.equal(secondsToMinutes(null), null);
});

test('arma la precarga completa con los íconos identificados, con el lado vacío', () => {
  const { fields } = mergeCaptures(validated([
    capture(0, {
      champion: field('C3'), lane: field('adc'), result: field('loss'), match_type: field('legendary_ranked'),
      kills: field(5), deaths: field(2), assists: field(5), duration_seconds: field(1112), gold: field(9500),
      allies: field([{ champion: 'C4', lane: 'support' }, { champion: 'C1', lane: 'mid' }]),
      enemies: field([{ champion: 'C2', lane: 'adc' }, { champion: 'C6', lane: 'mid' }], 'medium'),
    }),
  ]));
  const icons = {
    items: [{ name: 'Espada Larga', confidence: 'high' }, { name: 'Espada Larga', confidence: 'high' }, { name: 'Grebas de Armacero', confidence: 'high' }],
    runes: [{ name: 'Conquistador', confidence: 'high' }, { name: 'Brutalidad', confidence: 'high' }],
    spells: [{ name: 'Destello', confidence: 'high' }, { name: 'Barrera', confidence: 'medium' }],
  };
  const prefill = fieldsToPrefill(fields, MAPS, { defaultPatch: '7.3f', now: new Date(2026, 10, 12, 21, 5), icons });

  assert.equal(prefill.own_champion_name, "Kai'Sa");
  assert.equal(prefill.type, 'legendary_ranked');
  assert.equal(prefill.date, '2026-11-12');
  assert.equal(prefill.hour, '21:05');
  assert.equal(prefill.duration_minutes, 19);
  assert.deepEqual(prefill.items_used, ['Espada Larga', 'Espada Larga', 'Grebas de Armacero']); // repetidos permitidos
  assert.deepEqual(prefill.runes_used, ['Conquistador', 'Brutalidad']);
  assert.deepEqual(prefill.spells_used, ['Destello', 'Barrera']);
  assert.deepEqual(prefill.enemies, [{ name: 'Jhin', role: 'adc' }, { name: 'Zed', role: 'mid' }]);
  assert.equal('side' in prefill, false);
  assert.deepEqual(prefill.review, ['enemies', 'spells']); // confianza media en equipo rival y en un hechizo
});

test('sin datos leídos: clasificatoria por defecto y todo marcado para revisar', () => {
  const { fields } = mergeCaptures(validated([capture(0)]));
  const prefill = fieldsToPrefill(fields, MAPS, { defaultPatch: '7.3f' });
  assert.equal(prefill.type, 'ranked');
  assert.equal(prefill.own_champion_name, '');
  for (const key of ['champion', 'items', 'runes', 'spells']) assert.ok(prefill.review.includes(key), key);
});

test('la rama principal de runas es la que más runas tiene', () => {
  const runes = [
    { name: 'Conquistador', branch: 'Clave' },
    { name: 'Triunfo', branch: 'Precisión' },
    { name: 'Golpe bajo', branch: 'Dominación' },
    { name: 'Cazador voraz', branch: 'Dominación' },
  ];
  const branches = ['Dominación', 'Precisión', 'Valor', 'Brujería'];
  assert.deepEqual(runeBranchesFor(runes, branches), { primary: 'Dominación', secondary: 'Precisión' });
  assert.deepEqual(runeBranchesFor([], branches), { primary: 'Dominación', secondary: 'Precisión' });
});

// ── Marcador sin IA (disposición fija) ─────────────────────────────────────

import { LAYOUT, ROW_LANES, findHighlightBar, runeSlots, scoreboardSlots } from '../../src/features/matchCapture/scoreboardLayout.js';

/** Imagen sintética oscura con la barra dorada de la fila `row` (como en el juego). */
function boardImage(width, height, row) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 20; data[index + 1] = 28; data[index + 2] = 45; data[index + 3] = 255;
  }
  const barX = Math.round(width / 2 + LAYOUT.barX * height);
  const center = (LAYOUT.firstRowY + row * LAYOUT.rowPitch) * height;
  const half = (LAYOUT.rowHeight * height) / 2;
  for (let y = Math.round(center - half); y < Math.round(center + half); y += 1) {
    for (let x = barX; x < barX + 3; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 235; data[index + 1] = 185; data[index + 2] = 60;
    }
  }
  return { width, height, data };
}

test('encuentra la barra dorada y deduce la fila y la línea del jugador, en distintas resoluciones', () => {
  for (const [width, height] of [[1356, 610], [2048, 921], [2400, 1080]]) {
    for (const row of [0, 3, 4]) {
      const bar = findHighlightBar(boardImage(width, height, row));
      assert.ok(bar, `${width}x${height} fila ${row}`);
      const slots = scoreboardSlots(width, height, bar);
      assert.equal(slots.ownRow, row);
      assert.equal(slots.ownLane, ROW_LANES[row]);
      assert.equal(slots.allies.length, 5);
      assert.equal(slots.enemies.length, 5);
      assert.equal(slots.items.length, 6);
      assert.equal(slots.spells.length, 2);
      // Los objetos están en fila, de izquierda a derecha, en la fila del jugador.
      slots.items.forEach((item, index) => {
        if (index) assert.ok(item.x > slots.items[index - 1].x);
        assert.ok(Math.abs(item.y - (bar.top + bar.length / 2)) < LAYOUT.rowHeight * height / 2);
      });
    }
  }
});

test('sin barra dorada no hay marcador', () => {
  const image = boardImage(1356, 610, 0);
  for (let index = 0; index < image.data.length; index += 4) image.data[index] = 20;
  assert.equal(findHighlightBar(image), null);
});

test('la columna de runas escala con el alto de la pantalla', () => {
  const small = runeSlots(1356, 610);
  const large = runeSlots(2048, 921);
  assert.equal(small.length, 5);
  assert.ok(Math.abs(small[0].size / 610 - large[0].size / 921) < 1e-9);
  assert.ok(small[4].y > small[0].y);
});

test('la lectura local del marcador manda sobre la del modelo para campeones, líneas, objetos y hechizos', () => {
  const { fields } = mergeCaptures(validated([capture(0, {
    champion: field('C1'), lane: field('mid'), kills: field(0), deaths: field(4), assists: field(0),
    allies: field([{ champion: 'C2', lane: 'top' }]),
  })]));
  const high = name => ({ name, confidence: 'high', score: 0.95, empty: false });
  const scoreboard = {
    ownLane: 'top',
    own: high('Ornn'),
    allies: [{ ...high('Shyvana'), lane: 'jungler' }, { ...high('Katarina'), lane: 'mid' }, { ...high('Caitlyn'), lane: 'adc' }, { ...high('Lux'), lane: 'support' }],
    enemies: [{ ...high('Galio'), lane: 'top' }, { ...high('Zed'), lane: 'mid' }, { name: null, empty: true, lane: 'adc' }],
    spells: [high('Ignición'), high('Destello')],
    items: [high('Bacteriófago'), { name: null, empty: true }, high('Grebas del Berserker')],
  };
  const prefill = fieldsToPrefill(fields, MAPS, { scoreboard, icons: { runes: [high('Agarre del Perpetuo')] } });
  assert.equal(prefill.own_champion_name, 'Ornn');
  assert.equal(prefill.lane, 'top');
  assert.deepEqual(prefill.allies.map(ally => `${ally.name}/${ally.role}`), ['Shyvana/jungler', 'Katarina/mid', 'Caitlyn/adc', 'Lux/support']);
  assert.deepEqual(prefill.enemies.map(enemy => enemy.name), ['Galio', 'Zed']);
  assert.deepEqual(prefill.items_used, ['Bacteriófago', 'Grebas del Berserker']);
  assert.deepEqual(prefill.spells_used, ['Ignición', 'Destello']);
  assert.equal(prefill.kills, 0); // el texto sigue viniendo del modelo
  for (const key of ['champion', 'lane', 'allies', 'enemies', 'items', 'spells', 'runes']) assert.equal(prefill.review.includes(key), false, key);
});

// ── Texto del marcador sin IA (K/D/A, oro, resultado) ─────────────────────

import { GLYPH_H, GLYPH_W, otsuThreshold, parseGold, parseKda, readResult, readText } from '../../src/features/matchCapture/scoreboardText.js';
import { GLYPH_TEMPLATES } from '../../src/features/matchCapture/scoreboardGlyphs.js';
import { mergeLocalText } from '../../src/features/matchCapture/captureFields.js';

/** Dibuja un texto con las plantillas (escala `scale` px por celda), texto claro sobre fondo oscuro. */
function renderText(text, { scale = 3, gap = 2, touching = false } = {}) {
  const glyphHeight = GLYPH_H * scale;
  const widths = [...text].map(char => (char === ' ' ? glyphHeight * 0.4 : Math.round(GLYPH_TEMPLATES[char].aspect * glyphHeight)));
  const width = widths.reduce((sum, w) => sum + w + (touching ? 0 : gap), 0) + 8;
  const height = glyphHeight + 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 25; data[i + 1] = 35; data[i + 2] = 60; data[i + 3] = 255; }
  let x = 4;
  [...text].forEach((char, index) => {
    const w = widths[index];
    if (char !== ' ') {
      const cells = GLYPH_TEMPLATES[char].cells;
      for (let py = 0; py < glyphHeight; py += 1) {
        for (let px = 0; px < w; px += 1) {
          const cell = cells[Math.floor((py / glyphHeight) * GLYPH_H) * GLYPH_W + Math.floor((px / w) * GLYPH_W)];
          if (cell >= 0.5) {
            const i = ((4 + py) * width + (x + px)) * 4;
            data[i] = 235; data[i + 1] = 235; data[i + 2] = 240;
          }
        }
      }
    }
    x += w + (touching ? 0 : gap);
  });
  return { image: { width, height, data }, rect: { x: 0, y: 0, w: width, h: height } };
}

test('lee K/D/A y oro dibujados con la tipografía del marcador', () => {
  for (const text of ['4/0/6', '13/4/4', '5/5/10', '0/4/0']) {
    const { image, rect } = renderText(text);
    assert.equal(readText(image, rect).text, text);
  }
  const gold = renderText('10674');
  assert.equal(readText(gold.image, gold.rect).text, '10674');
});

test('separa dígitos pegados (la tipografía del oro es apretada)', () => {
  const { image, rect } = renderText('8466', { touching: true });
  assert.equal(readText(image, rect).text, '8466');
});

test('interpreta K/D/A y oro y descarta lecturas con otra forma', () => {
  assert.deepEqual(parseKda('13/4/4'), { kills: 13, deaths: 4, assists: 4 });
  assert.equal(parseKda('4/0'), null);
  assert.equal(parseKda('4/0/6/1'), null);
  assert.equal(parseGold('10674'), 10674);
  assert.equal(parseGold('66'), null);
  assert.equal(parseGold('1/2'), null);
});

test('el umbral de Otsu separa fondo oscuro y texto claro', () => {
  const values = [...new Array(200).fill(40), ...new Array(50).fill(220)];
  const threshold = otsuThreshold(values);
  assert.ok(threshold >= 40 && threshold < 220);
});

test('victoria o derrota por el color del título', () => {
  const make = color => {
    const width = 400; const height = 200;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 15; data[i + 1] = 20; data[i + 2] = 35; data[i + 3] = 255; }
    for (let y = 10; y < 18; y += 1) for (let x = 180; x < 220; x += 1) {
      const i = (y * width + x) * 4; [data[i], data[i + 1], data[i + 2]] = color;
    }
    return { width, height, data };
  };
  assert.equal(readResult(make([90, 160, 240])), 'win');
  assert.equal(readResult(make([230, 60, 70])), 'loss');
  assert.equal(readResult(make([15, 20, 35])), null);
});

test('la lectura local segura manda; la dudosa solo completa lo que falta', () => {
  const model = { kills: { value: 5, confidence: 'high' }, deaths: { value: null, confidence: null }, gold: { value: 9000, confidence: 'medium' } };
  const local = {
    kills: { value: 4, confidence: 'high' },
    deaths: { value: 0, confidence: 'medium' },
    gold: { value: 10674, confidence: 'medium' },
    result: { value: 'win', confidence: 'high' },
  };
  const merged = mergeLocalText(model, local);
  assert.equal(merged.kills.value, 4);          // local segura > modelo
  assert.equal(merged.deaths.value, 0);         // local dudosa completa un faltante...
  assert.equal(merged.deaths.needsReview, true); // ...y queda para revisar
  assert.equal(merged.gold.value, 9000);        // local dudosa no pisa lo que leyó el modelo
  assert.equal(merged.result.value, 'win');
  assert.deepEqual(mergeLocalText(model, null), model);
});
