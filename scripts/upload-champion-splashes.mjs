// Sube el splash en alta resolución de cada campeón a Storage y completa
// champions.image_url_splash (columna de 202611170003_champion_splash.sql).
//
// Origen: el splash oficial de Data Dragon (1215 x 717). Destino:
// riftdeck-assets/champions_splash/<IdDataDragon>.jpg
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "..."      # Project Settings > API > service_role
//   node scripts/upload-champion-splashes.mjs --dry-run   # solo muestra qué haría
//   node scripts/upload-champion-splashes.mjs             # sube y actualiza
//   node scripts/upload-champion-splashes.mjs --force     # rehace también los que ya tienen
//
// La URL del proyecto se toma de VITE_SUPABASE_URL (variable de entorno o .env.local).
// La service role key NO se guarda en ningún archivo: solo en la variable de entorno.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { championArtId, loadChampionIds, splashUrl } from '../src/features/share/championArt.js';

const BUCKET = 'riftdeck-assets';
const FOLDER = 'champions_splash';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

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

// Sin process.exit(): cortar de golpe con conexiones abiertas dispara un assert de Node en
// Windows ("UV_HANDLE_CLOSING"). Se marca el código de salida y se deja terminar solo.
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

  const { data: champions, error } = await supabase
    .from('champions')
    .select('id, name, original_name, image_url_splash')
    .order('name');
  if (error) {
    console.error('No se pudieron leer los campeones:', error.message);
    if (/image_url_splash/.test(error.message)) console.error('¿Aplicaste la migración 202611170003_champion_splash.sql?');
    process.exitCode = 1;
    return;
  }

  const ids = await loadChampionIds();
  if (!ids.size) {
    console.error('No se pudo bajar la lista de campeones de Data Dragon. Probá de nuevo.');
    process.exitCode = 1;
    return;
  }

  const results = { uploaded: [], skipped: [], missing: [], failed: [] };
  console.log(`${champions.length} campeones${dryRun ? ' (prueba: no se sube nada)' : ''}\n`);

  for (const champion of champions) {
    if (champion.image_url_splash && !force) {
      results.skipped.push(champion.name);
      continue;
    }
    const artId = championArtId(ids, champion);
    if (!artId) {
      results.missing.push(champion.name);
      continue;
    }
    const path = `${FOLDER}/${artId}.jpg`;
    if (dryRun) {
      console.log(`  ${champion.name.padEnd(22)} → ${path}`);
      results.uploaded.push(champion.name);
      continue;
    }
    try {
      const response = await fetch(splashUrl(artId));
      if (!response.ok) throw new Error(`Data Dragon respondió ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, body, {
        contentType: 'image/jpeg',
        // 1 día, igual que el resto de las imágenes del catálogo (optimize-catalog-images.mjs).
        cacheControl: '86400',
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { error: updateError } = await supabase
        .from('champions')
        .update({ image_url_splash: publicUrl })
        .eq('id', champion.id);
      if (updateError) throw updateError;
      results.uploaded.push(champion.name);
      console.log(`  ✓ ${champion.name}`);
    } catch (uploadFailure) {
      results.failed.push(`${champion.name} (${uploadFailure.message})`);
      console.log(`  ✗ ${champion.name}: ${uploadFailure.message}`);
    }
  }

  console.log(`\n${dryRun ? 'Se subirían' : 'Subidos'}: ${results.uploaded.length}`);
  console.log(`Ya tenían splash: ${results.skipped.length}${results.skipped.length ? ' (usá --force para rehacerlos)' : ''}`);
  if (results.missing.length) {
    console.log(`\nSin splash en Data Dragon (subilos a mano a ${BUCKET}/${FOLDER}/ y completá image_url_splash):`);
    results.missing.forEach(name => console.log(`  - ${name}`));
  }
  if (results.failed.length) {
    console.log('\nFallaron (volvé a correr el script; solo reintenta los que faltan):');
    results.failed.forEach(line => console.log(`  - ${line}`));
    process.exitCode = 1;
  }
}

await main();
