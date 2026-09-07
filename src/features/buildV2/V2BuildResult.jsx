import { AlertTriangle, CheckCircle2 } from 'lucide-react';

function EntityRow({ selection, index }) {
  const entity = selection.entity;
  return <div className="rd-list-row items-start gap-3">
    {index != null && <span className="text-primary font-bold mt-2">{index + 1}.</span>}
    {entity.image_url ? <img src={entity.image_url} alt={entity.name} className="w-11 h-11 rounded-lg object-cover border border-primary/20" /> : <div className="w-11 h-11 rounded-lg bg-secondary" />}
    <div className="min-w-0"><p className="font-semibold text-foreground">{entity.name}</p><p className="text-sm text-muted-foreground mt-0.5">{selection.reason}</p></div>
  </div>;
}

const Section = ({ title, children }) => <section className="rd-card p-5"><p className="rd-label mb-3">{title}</p>{children}</section>;

export default function V2BuildResult({ state, result, error }) {
  if (state === 'idle') return null;
  if (state === 'loading') return <div className="rd-card p-6 text-center text-muted-foreground">La IA está analizando la partida completa…</div>;
  if (state !== 'success') {
    const labels = { validation_error: 'La respuesta no cumplió las reglas estructurales.', malformed_response: 'Gemini devolvió una respuesta malformada.', provider_error: 'No se pudo completar la solicitud a Gemini.' };
    return <div className="rd-card p-5 border-red-500/30"><div className="flex gap-3"><AlertTriangle className="text-red-400 shrink-0" size={20} /><div><p className="font-semibold text-red-300">{labels[state] || 'Error'}</p><p className="text-sm text-muted-foreground mt-1">{error}</p></div></div></div>;
  }
  return <div className="space-y-4">
    <div className="rd-card p-5 border-primary/25"><div className="flex items-center gap-2 text-green-400 mb-3"><CheckCircle2 size={17} /><span className="rd-label">Build validada</span></div><h2 className="font-rajdhani text-2xl font-bold">{result.champion.name} · {result.role.toUpperCase()}</h2><div className="grid md:grid-cols-3 gap-4 mt-5"><div><p className="rd-label mb-1">Temática</p><p>{result.build_theme}</p></div><div><p className="rd-label mb-1">Lectura de partida</p><p className="text-sm text-muted-foreground">{result.matchup_read}</p></div><div><p className="rd-label mb-1">Condición de victoria</p><p className="text-sm text-muted-foreground">{result.win_condition}</p></div></div></div>
    <Section title="Análisis de composición">
      <div className="grid md:grid-cols-2 gap-4">
        <div><p className="rd-label mb-1">Perfil de daño aliado</p><p className="text-sm text-muted-foreground">{result.composition_analysis.allied_damage_profile}</p></div>
        <div><p className="rd-label mb-1">Por qué este arquetipo</p><p className="text-sm text-muted-foreground">{result.composition_analysis.archetype_rationale}</p></div>
        <div><p className="rd-label mb-1">Amenazas enemigas prioritarias</p><ul className="space-y-1">{result.composition_analysis.enemy_priority_threats.map((text, index) => <li key={index} className="text-sm text-muted-foreground">• {text}</li>)}</ul></div>
        <div><p className="rd-label mb-1">Respuestas requeridas</p><ul className="space-y-1">{result.composition_analysis.required_responses.map((text, index) => <li key={index} className="text-sm text-muted-foreground">• {text}</li>)}</ul></div>
      </div>
    </Section>
    <Section title="Plan y coherencia de build">
      <div className="grid md:grid-cols-2 gap-4">
        <div><p className="rd-label mb-1">Arquetipo principal</p><p className="text-sm text-muted-foreground">{result.build_plan.primary_archetype}</p></div>
        <div><p className="rd-label mb-1">Perfil final de daño</p><p className="text-sm text-muted-foreground">{result.build_plan.target_damage_profile}</p></div>
        <div><p className="rd-label mb-1">Primer power spike</p><p className="text-sm text-muted-foreground">{result.build_plan.first_item_rationale}</p></div>
        <div><p className="rd-label mb-1">Auditoría de transformaciones</p><p className="text-sm text-muted-foreground">{result.build_plan.transformation_audit}</p></div>
        <div className="md:col-span-2"><p className="rd-label mb-1">Relaciones entre objetos</p><ul className="space-y-1">{result.build_plan.item_relationships.map((text, index) => <li key={index} className="text-sm text-muted-foreground">• {text}</li>)}</ul></div>
      </div>
    </Section>    <div className="grid lg:grid-cols-2 gap-4"><Section title="Items">{result.core_items.map((item, index) => <EntityRow key={item.id} selection={item} index={index} />)}</Section><div className="space-y-4"><Section title="Movimiento"><EntityRow selection={result.movement_item} /></Section><Section title="Hechizos">{result.spells.map(spell => <EntityRow key={spell.id} selection={spell} />)}</Section></div></div>
    <div className="grid lg:grid-cols-3 gap-4"><Section title="Runa clave"><EntityRow selection={result.keystone} /></Section><Section title="Runas principales">{result.primary_runes.map(rune => <EntityRow key={rune.id} selection={rune} />)}</Section><Section title="Runa secundaria"><EntityRow selection={result.secondary_rune} /></Section></div>
    <Section title="Adaptaciones clave"><ul className="space-y-2">{result.key_adaptations.map((text, index) => <li key={index} className="text-sm text-muted-foreground">• {text}</li>)}</ul></Section>
  </div>;
}
