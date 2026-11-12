// Lámina de referencia de campeones: en la pantalla de resultados de Wild Rift los
// campeones son solo retratos. Se arma una grilla con cada retrato del catálogo y su
// código debajo, y el modelo responde con códigos. (Objetos, runas y hechizos se
// identifican aparte, comparando píxeles: ver iconIdentify.js.)
// Las imágenes salen del Storage público de Supabase (permite CORS), así el canvas no
// queda "tainted". Las láminas se guardan en caché (memoria + IndexedDB) por catálogo.
import { assignCodes, catalogSignature, CODE_PREFIX } from './referenceCodes';
import { cacheGet, cacheSet } from './captureDraft';

const ICON = 64;
const LABEL = 16;
const GAP = 6;
const JPEG_QUALITY = 0.85;

const memoryCache = new Map();

function loadIcon(url) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Dibuja una lámina: grilla de íconos con el código debajo de cada uno.
 * @param {Array<{ code: string, entry: { image_url?: string } }>} coded
 */
async function drawSheet(coded) {
  const columns = Math.min(14, Math.max(6, Math.ceil(Math.sqrt(coded.length))));
  const rows = Math.ceil(coded.length / columns);
  const cellWidth = ICON + GAP;
  const cellHeight = ICON + LABEL + GAP;
  const canvas = document.createElement('canvas');
  canvas.width = columns * cellWidth + GAP;
  canvas.height = rows * cellHeight + GAP;
  const context = canvas.getContext('2d');
  context.fillStyle = '#0b0f1a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.font = 'bold 13px sans-serif';

  const icons = await Promise.all(coded.map(({ entry }) => loadIcon(entry.image_url)));
  coded.forEach(({ code }, index) => {
    const x = GAP + (index % columns) * cellWidth;
    const y = GAP + Math.floor(index / columns) * cellHeight;
    const icon = icons[index];
    if (icon) {
      context.drawImage(icon, x, y, ICON, ICON);
    } else {
      context.fillStyle = '#1f2937';
      context.fillRect(x, y, ICON, ICON);
    }
    context.fillStyle = '#ffffff';
    context.fillText(code, x + ICON / 2, y + ICON + 1);
  });

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1] };
}

/**
 * Devuelve la lámina de campeones lista para mandar (en una lista, por si en el
 * futuro se suman otras).
 * @param {{ champions: any[] }} catalog
 * @returns {Promise<Array<{ media_type: string, data: string }>>}
 */
export async function getReferenceSheets(catalog) {
  const key = `sheets:champions:${catalogSignature({ champions: catalog.champions })}`;
  if (memoryCache.has(key)) return memoryCache.get(key);
  const cached = await cacheGet(key);
  if (Array.isArray(cached) && cached.length) {
    memoryCache.set(key, cached);
    return cached;
  }

  const groups = [assignCodes(catalog.champions, CODE_PREFIX.champion)].filter(group => group.length);

  const sheets = [];
  for (const group of groups) sheets.push(await drawSheet(group));
  memoryCache.set(key, sheets);
  await cacheSet(key, sheets);
  return sheets;
}
