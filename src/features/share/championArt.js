// Arte en alta resolución para la tarjeta compartible: el splash oficial de Riot (Data
// Dragon, 1215 x 717 px) en lugar de la imagen "card" del catálogo (300 x 512), que en
// la tarjeta se estira más de 3 veces y se ve borrosa. Data Dragon permite CORS, así
// que la imagen entra en el PNG exportado.
// Los campeones exclusivos de Wild Rift (Norra) no tienen splash en LoL: se usa la
// imagen del catálogo.

const DDRAGON = 'https://ddragon.leagueoflegends.com';

/** Nombre normalizado para comparar: sin acentos, minúsculas y solo letras. */
export const artKey = value => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z]/g, '');

/** Nombres del catálogo (en español) que no coinciden con los de LoL. */
const ALIASES = {
  maestroyi: 'MasterYi',
  bardo: 'Bard',
  nunuywillump: 'Nunu',
};

let championIdsPromise = null;

/**
 * Mapa nombre normalizado → id de Data Dragon (Kai'Sa → Kaisa, Wukong → MonkeyKing).
 * Se baja una sola vez por sesión; si falla, queda vacío y se usa el arte del catálogo.
 */
export function loadChampionIds() {
  if (!championIdsPromise) {
    championIdsPromise = (async () => {
      const versions = await (await fetch(`${DDRAGON}/api/versions.json`)).json();
      const { data } = await (await fetch(`${DDRAGON}/cdn/${versions[0]}/data/en_US/champion.json`)).json();
      const ids = new Map();
      Object.values(data).forEach(champion => {
        ids.set(artKey(champion.name), champion.id);
        ids.set(artKey(champion.id), champion.id);
      });
      return ids;
    })().catch(() => {
      championIdsPromise = null;
      return new Map();
    });
  }
  return championIdsPromise;
}

/** Id de Data Dragon de un campeón del catálogo, o null si no existe en LoL. */
export function championArtId(ids, champion) {
  if (!champion) return null;
  for (const name of [champion.name, champion.original_name]) {
    const key = artKey(name);
    if (!key) continue;
    if (ALIASES[key]) return ALIASES[key];
    if (ids.has(key)) return ids.get(key);
  }
  return null;
}

/** URL del splash principal (skin base) de un id de Data Dragon. */
export const splashUrl = id => `${DDRAGON}/cdn/img/champion/splash/${id}_0.jpg`;
