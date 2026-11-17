// Optimiza las imágenes del catálogo en Storage (riftdeck-assets) para que la app cargue
// rápido: achica las que son más grandes de lo que se muestran, las recomprime y les pone
// caché de 1 día. Mantiene el mismo nombre y formato: no hay que cambiar nada en la base.
//
//   carpeta          tamaño máx.   uso
//   champions_icon   128 px        íconos de campeón
//   items            160 px        objetos
//   runes            160 px        runas
//   spells           160 px        hechizos
//   champions_cards  300 px ancho  cards de campeón (solo se recomprimen)
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_..."        # Project Settings > API Keys > Secret keys
//   node scripts/optimize-catalog-images.mjs --dry-run      # solo muestra cuánto se ahorra
//   node scripts/optimize-catalog-images.mjs                # optimiza y sube
//
// La URL del proyecto sale de VITE_SUPABASE_URL (variable de entorno o .env.local). La
// clave secreta NO se guarda en ningún archivo: solo en la variable de entorno.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'riftdeck-assets';
// 1 día: durante ese día el navegador no vuelve a preguntar por la imagen. Si una imagen
// cambia con el mismo nombre, como mucho se ve la vieja hasta el día siguiente.
const CACHE_SECONDS = '86400';
const FOLDERS = [
  { folder: 'champions_icon', maxWidth: 128, quality: 82 },
  { folder: 'items', maxWidth: 160, quality: 82 },
  { folder: 'runes', maxWidth: 160, quality: 82 },
  { folder: 'spells', maxWidth: 160, quality: 82 },
  { folder: 'champions_cards', maxWidth: 300, quality: 76 },
];
const CONTENT_TYPES = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg' };
const dryRun = process.argv.includes('--dry-run');
/** Imágenes que se procesan a la vez. */
const CONCURRENCY = 8;

async function readLocalEnv() {
  try {
    const contents = await readFile(resolve('.env.local'), 'utf8');
    return Object.fromEntries(contents.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]] : [];
    }));
  } catch {
    return {};
  }
}

/** Todos los archivos de una carpeta del bucket (de a 100). */
async function listFolder(supabase, folder) {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    files.push(...data.filter(entry => entry.id && /\.(webp|png|jpe?g)$/i.test(entry.name)));
    if (data.length < 100) break;
  }
  return files;
}

/** Misma imagen, achicada si hace falta y recomprimida en su formato original. */
async function optimize(buffer, { maxWidth, quality }) {
  const image = sharp(buffer, { animated: false });
  const meta = await image.metadata();
  const pipeline = meta.width > maxWidth ? image.resize({ width: maxWidth, withoutEnlargement: true }) : image;
  const format = meta.format === 'jpg' ? 'jpeg' : meta.format;
  const output = format === 'png'
    ? await pipeline.png({ compressionLevel: 9, palette: true, quality }).toBuffer()
    : format === 'jpeg'
      ? await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
      : await pipeline.webp({ quality, effort: 6 }).toBuffer();
  return { output, format, width: meta.width };
}

async function main() {
  const localEnv = await readLocalEnv();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Faltan VITE_SUPABASE_URL (o .env.local) y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log(dryRun ? 'Prueba: no se sube nada.\n' : '');

  let totalBefore = 0;
  let totalAfter = 0;
  const failed = [];
  for (const config of FOLDERS) {
    process.stdout.write(`${config.folder}: listando…`);
    const files = await listFolder(supabase, config.folder);
    let before = 0;
    let after = 0;
    let resized = 0;
    let processed = 0;
    const progress = () => process.stdout.write(`\r${config.folder}: ${processed}/${files.length}   `);
    progress();
    // De a varias imágenes a la vez (bajar, recomprimir y subir), con progreso en pantalla.
    const queue = [...files];
    const worker = async () => {
      while (queue.length) {
        const file = queue.shift();
        await processFile(file);
        processed += 1;
        progress();
      }
    };
    const processFile = async file => {
      const path = `${config.folder}/${file.name}`;
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(path);
        if (error) throw error;
        const original = Buffer.from(await data.arrayBuffer());
        const { output, format, width } = await optimize(original, config);
        // Si recomprimir no achica, se sube la original igual (para ponerle la caché).
        const best = output.length < original.length ? output : original;
        before += original.length;
        after += best.length;
        if (width > config.maxWidth) resized += 1;
        if (dryRun) return;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, best, {
          contentType: CONTENT_TYPES[format] || data.type || 'application/octet-stream',
          cacheControl: CACHE_SECONDS,
          upsert: true,
        });
        if (uploadError) throw uploadError;
      } catch (failure) {
        failed.push(`${path} (${failure.message})`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    totalBefore += before;
    totalAfter += after;
    process.stdout.write('\r');
    console.log(`${config.folder.padEnd(16)} ${String(files.length).padStart(4)} imágenes · ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB · ${resized} achicadas`);
  }

  console.log(`\nTotal: ${Math.round(totalBefore / 1024)} KB → ${Math.round(totalAfter / 1024)} KB${dryRun ? ' (sin subir)' : ' · caché de 1 día'}`);
  if (failed.length) {
    console.log('\nFallaron (volvé a correr el script):');
    failed.forEach(line => console.log(`  - ${line}`));
    process.exitCode = 1;
  }
}

await main();
