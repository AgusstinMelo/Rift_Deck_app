import { AlertTriangle, CircleCheck, Loader2, Package, ShieldAlert, Sparkles, Target, Zap } from 'lucide-react';

function EntityTile({ selection, eyebrow }) {
  const entity = selection.entity;
  return <div className="group flex min-w-0 flex-col items-center px-2 py-1 text-center">
    <span className="rd-label mb-2">{eyebrow}</span>
    {entity.image_url ? <img src={entity.image_url} alt={entity.name} className="h-14 w-14 rounded-xl border border-primary/25 object-cover shadow-[0_0_20px_rgba(212,175,55,.08)] transition-transform group-hover:-translate-y-0.5 md:h-16 md:w-16" /> : <div className="h-14 w-14 rounded-xl bg-secondary md:h-16 md:w-16" />}
    <p className="mt-2 line-clamp-2 min-h-10 text-xs font-semibold leading-tight text-foreground">{entity.name}</p>
  </div>;
}

function EntityDetail({ selection, eyebrow, featured = false, compact = false, indented = false }) {
  const entity = selection.entity;
  return <div className={`flex items-start rounded-xl border bg-secondary/30 ${featured ? 'border-primary/35' : 'border-border/60'} ${indented ? 'ml-5' : ''} ${compact ? 'gap-2.5 p-2.5' : 'gap-3 p-3'}`}>
    {entity.image_url ? <img src={entity.image_url} alt={entity.name} className={`${compact ? 'h-10 w-10' : 'h-14 w-14'} shrink-0 rounded-full border border-primary/30 object-cover`} /> : <div className={`${compact ? 'h-10 w-10' : 'h-14 w-14'} shrink-0 rounded-full bg-secondary`} />}
    <div className="min-w-0"><p className="rd-label mb-0.5">{eyebrow}</p><p className={`${compact ? 'text-sm' : ''} font-semibold text-foreground`}>{entity.name}</p><p className={`${compact ? 'text-[11px]' : 'text-xs'} mt-1 leading-relaxed text-muted-foreground`}>{selection.reason}</p></div>
  </div>;
}

function SectionTitle({ icon: Icon, children }) {
  return <div className="mb-3 flex items-center gap-2"><Icon size={17} className="text-primary" /><h3 className="font-rajdhani text-lg font-bold uppercase tracking-[-0.04em] text-foreground">{children}</h3></div>;
}

function CopyBlock({ title, icon = Target, className = '', children }) {
  return <section className={`rounded-xl border border-border/50 bg-secondary/20 p-4 ${className}`}><SectionTitle icon={icon}>{title}</SectionTitle><div className="text-sm leading-relaxed text-muted-foreground">{children}</div></section>;
}

function EmptyResult() {
  return <div className="rd-card min-h-[520px] border-primary/15 p-8"><div className="flex min-h-[455px] flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Sparkles className="text-primary" size={28} /></div><p className="rd-label mb-2">Tu build aparecer&aacute; ac&aacute;</p><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">Prepar&aacute; el draft</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Complet&aacute; ambas composiciones para recibir objetos, runas, hechizos y una explicaci&oacute;n estrat&eacute;gica.</p></div></div>;
}

export default function V2BuildResult({ state, result, error }) {
  if (state === 'idle') return <EmptyResult />;
  if (state === 'loading') return <div className="rd-card min-h-[520px] p-8"><div className="flex min-h-[455px] flex-col items-center justify-center gap-4 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Loader2 size={28} className="animate-spin text-primary" /></div><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">Analizando la partida</h2><p className="max-w-md text-sm text-muted-foreground">Cruzando sinergias, amenazas, objetos, runas y hechizos.</p></div></div>;
  if (state !== 'success') {
    const labels = { validation_error: 'La respuesta no cumplio las reglas estructurales.', malformed_response: 'Gemini devolvio una respuesta malformada.', provider_error: 'No se pudo completar la solicitud a Gemini.' };
    return <div className="rd-card border-red-500/30 p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-semibold text-red-300">{labels[state] || 'Error'}</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div></div></div>;
  }

  const orderedItems = [...result.core_items, result.movement_item];
  const runes = [result.keystone, ...result.primary_runes, result.secondary_rune];

  return <main className="space-y-4">
    <section className="rd-card p-4 md:p-5"><SectionTitle icon={Package}>Orden recomendado de objetos</SectionTitle><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{orderedItems.map((item, index) => <EntityTile key={item.id} selection={item} eyebrow={index === orderedItems.length - 1 ? 'Movimiento' : `${index + 1}`} />)}</div></section>

    <div className="grid items-stretch gap-4 lg:grid-cols-[3fr_2fr]">
      <section className="rd-card h-full p-4 md:p-5 lg:flex lg:min-h-0 lg:flex-col"><SectionTitle icon={Sparkles}>Runas</SectionTitle><div className="flex flex-col gap-2 lg:grid lg:min-h-0 lg:flex-1 lg:grid-rows-5 lg:[&>*]:h-full lg:[&>*]:items-center">{runes.map((rune, index) => <EntityDetail key={rune.id} selection={rune} eyebrow={index === 0 ? 'Runa clave' : index === runes.length - 1 ? 'Secundaria' : `Principal ${index}`} featured compact={index > 0} indented={index > 0} />)}</div></section>
      <div className="grid h-full gap-4 lg:grid-rows-[auto_1fr]"><section className="rd-card p-4 md:p-5"><SectionTitle icon={Zap}>Hechizos</SectionTitle><div className="space-y-2">{result.spells.map((spell, index) => <EntityDetail key={spell.id} selection={spell} eyebrow={`Hechizo ${index + 1}`} featured compact />)}</div></section><CopyBlock title="Tem&aacute;tica y lectura del draft" className="h-full"><div className="space-y-3"><p className="font-semibold text-foreground">{result.build_theme}</p><p>{result.matchup_read}</p><p>{result.composition_analysis.archetype_rationale}</p></div></CopyBlock></div>
    </div>
    <section className="rd-card p-4 md:p-5"><div className="mb-4 border-b border-border/50 pb-4"><SectionTitle icon={Zap}>Adaptaciones clave</SectionTitle><ol className="grid gap-3 md:grid-cols-2">{result.key_adaptations.map((text, index) => <li key={index} className="flex gap-3 text-sm text-muted-foreground"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</span><span>{text}</span></li>)}</ol></div><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] p-3"><div className="mb-2 flex items-center gap-2 text-green-400"><CircleCheck size={15} /><span className="rd-label text-green-400">Fortalezas</span></div><ul className="space-y-2 text-sm text-muted-foreground"><li>{result.build_plan.target_damage_profile}</li><li>{result.composition_analysis.allied_damage_profile}</li></ul></div><div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3"><div className="mb-2 flex items-center gap-2 text-yellow-400"><AlertTriangle size={15} /><span className="rd-label text-yellow-400">Requerimientos</span></div><ul className="space-y-2 text-sm text-muted-foreground">{result.composition_analysis.required_responses.map((text, index) => <li key={index} className="flex gap-2"><span className="text-yellow-400">&bull;</span><span>{text}</span></li>)}</ul></div><div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3"><div className="mb-2 flex items-center gap-2 text-red-400"><ShieldAlert size={15} /><span className="rd-label text-red-400">Riesgos</span></div><ul className="space-y-2 text-sm text-muted-foreground">{result.composition_analysis.enemy_priority_threats.map((text, index) => <li key={index} className="flex gap-2"><span className="text-red-400">&bull;</span><span>{text}</span></li>)}</ul></div></div></section>
    <CopyBlock title="Por qu&eacute; esta build" icon={Sparkles}><div className="space-y-3"><p>{result.win_condition}</p><p>{result.build_plan.first_item_rationale}</p><ul className="grid gap-x-5 gap-y-2 md:grid-cols-2">{result.build_plan.item_relationships.map((text, index) => <li key={index} className="flex gap-2"><span className="text-primary">&bull;</span><span>{text}</span></li>)}</ul></div></CopyBlock>
  </main>;
}