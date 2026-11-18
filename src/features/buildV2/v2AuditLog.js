// Registro de intervenciones de Build V2 (tabla build_v2_audit_log): por cada build, cuántos
// errores de la respuesta reparó el estabilizador y qué cambió la auditoría. Si casi siempre
// es 0, la IA decide bien; si una regla actúa seguido, se mejora el prompt o los datos.
// Nunca bloquea ni rompe la generación: si falla, se ignora.
import { supabase } from '@/lib/supabaseClient';

const count = value => Math.max(0, Math.min(32767, Number(value) || 0));

/**
 * @param {{
 *   patchVersion?: string, champion: string, role: string, themed: boolean, enemiesKnown: number,
 *   attempt: number, repairs: number, audit: { itemChanges: string[], runeChanges: number, spellChanges: number } | null,
 *   promptTokens?: number,
 * }} entry
 */
export function logBuildAudit(entry) {
  const audit = entry.audit || { itemChanges: [], runeChanges: 0, spellChanges: 0 };
  const rules = [
    ...audit.itemChanges,
    ...Array(count(audit.runeChanges)).fill('runeClass'),
    ...Array(count(audit.spellChanges)).fill('spellClass'),
  ];
  Promise.resolve(supabase.from('build_v2_audit_log').insert({
    patch_version: entry.patchVersion || null,
    champion: String(entry.champion || '').slice(0, 80),
    role: String(entry.role || '').slice(0, 20),
    themed: Boolean(entry.themed),
    enemies_known: count(entry.enemiesKnown),
    attempt: count(entry.attempt) || 1,
    repairs: count(entry.repairs),
    item_changes: count(audit.itemChanges.length),
    rune_changes: count(audit.runeChanges),
    spell_changes: count(audit.spellChanges),
    rules,
    prompt_tokens: entry.promptTokens ? Math.round(entry.promptTokens) : null,
  })).then(({ error } = {}) => {
    if (error && import.meta.env?.DEV) console.debug('[Build IA V2] audit log', error.message);
  }).catch(() => {});
}
