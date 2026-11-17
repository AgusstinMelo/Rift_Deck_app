import test from 'node:test';
import assert from 'node:assert/strict';
import { withCatalogIcons } from '../../src/utils/tierlist.js';

const TENCENT = 'https://game.gtimg.cn/images/lgamem/act/lrlib/img/HeadIcon/H_S_10138.png';
const CATALOG = [
  { external_id: '10138', name: 'Smolder', image_url: 'https://x.supabase.co/champions_icon/Smolder.webp' },
  { external_id: 10083, name: 'Malphite', image_url: 'https://x.supabase.co/champions_icon/Malphite.webp' },
  { external_id: null, name: "Kai'Sa", image_url: 'https://x.supabase.co/champions_icon/Kaisa.webp' },
];

test('tierlist: usa el ícono del catálogo en lugar del avatar de Tencent (por external_id o nombre)', () => {
  const rows = withCatalogIcons([
    { external_id: '10138', champion_name: 'Smolder', image_url: TENCENT },
    { external_id: '10083', champion_name: 'Malphite', image_url: TENCENT },
    { external_id: '99999', champion_name: 'Kai’Sa', image_url: TENCENT },
    { external_id: '12345', champion_name: 'Norra', image_url: TENCENT, tier: 'A' },
  ], CATALOG);
  assert.equal(rows[0].image_url, CATALOG[0].image_url);
  assert.equal(rows[1].image_url, CATALOG[1].image_url);
  assert.equal(rows[2].image_url, CATALOG[2].image_url);
  // Sin coincidencia en el catálogo: queda la imagen original y el resto de los datos.
  assert.equal(rows[3].image_url, TENCENT);
  assert.equal(rows[3].tier, 'A');
});

test('tierlist: sin catálogo devuelve las filas tal cual', () => {
  const rows = [{ external_id: '1', champion_name: 'X', image_url: TENCENT }];
  assert.equal(withCatalogIcons(rows, []), rows);
  assert.deepEqual(withCatalogIcons(null, CATALOG), []);
});
