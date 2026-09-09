import { supabase } from '@/lib/supabaseClient';
import { normalizeV2Snapshot } from './v2CatalogNormalizer.js';

async function loadTable(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

export async function loadV2Snapshot() {
  const loadedAt = new Date().toISOString();
  const [champions, items, runes, spells] = await Promise.all([
    loadTable('current_champions'),
    loadTable('current_wr_items'),
    loadTable('current_runes'),
    loadTable('spells'),
  ]);
  return normalizeV2Snapshot({ loadedAt, champions, items, runes, spells });
}
