import { useState } from 'react';
import { AlertTriangle, CircleCheck, Loader2, Package, ShieldAlert, Sparkles, Swords, Users, Zap } from 'lucide-react';
import { useCatalogText } from '@/lib/LocaleContext';

function EntityIcon({ selection, label, badge, round = false, featured = false, small = false }) {
  const entity = selection.entity;
  const { entityName } = useCatalogText();
  const shape = round ? 'rounded-full' : small ? 'rounded-md' : 'rounded-lg';
  const size = small ? 'h-7 w-7' : 'h-10 w-10 2xl:h-11 2xl:w-11';
  const tooltip = [label, entityName(entity)].filter(Boolean).join(' · ') + (selection.reason ? `\n${selection.reason}` : '');
  return <div title={small ? undefined : tooltip} className="group relative shrink-0">
    {entity.image_url ? <img src={entity.image_url} alt={entityName(entity)} className={`${size} ${shape} border object-cover transition-transform ${small ? '' : 'group-hover:-translate-y-0.5'} ${featured ? 'border-primary/70 shadow-[0_0_14px_rgba(212,175,55,.25)]' : 'border-primary/25'}`} /> : <div className={`${size} ${shape} bg-secondary`} />}
    {badge && <span className={`absolute flex items-center justify-center rounded-full border border-primary/40 bg-[#0f1420] font-bold leading-none text-primary ${small ? '-right-1.5 -top-1.5 h-3.5 min-w-3.5 px-0.5 text-[8px]' : '-right-1 -top-1 h-4 min-w-4 px-1 text-[9px]'}`}>{badge}</span>}
  </div>;
}

const GROUP_COLUMNS = { 2: 'md:grid-cols-2', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6' };

function IconGroup({ icon: Icon, title, columns, className = '', children }) {
  return <div className={`min-w-0 ${className}`}>
    <div className="mb-2 flex items-center gap-1.5"><Icon size={13} className="text-primary" /><span className="rd-label">{title}</span></div>
    <div className={`flex flex-wrap gap-2 md:grid md:justify-items-center ${GROUP_COLUMNS[columns] || ''}`}>{children}</div>
  </div>;
}

// Algunas descripciones llegan con saltos de línea escapados ("\n" literal).
const cleanText = text => String(text || '').replace(/\\n/g, '\n').replace(/\n{2,}/g, '\n').trim();

function ReasonRow({ selection, label, badge, round = false, featured = false, className = '' }) {
  const entity = selection.entity;
  const { entityName } = useCatalogText();
  return <li className={`flex items-center gap-2.5 border-b border-border/30 py-1.5 ${className}`}>
    <EntityIcon selection={selection} label={label} badge={badge} round={round} featured={featured} small />
    <div className="min-w-0 text-[13px] leading-snug">
      <p><span className="font-semibold text-foreground">{entityName(entity)}</span><span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{label}</span></p>
      <p title={cleanText(selection.reason)} className="rd-v2-reason whitespace-pre-line">{cleanText(selection.reason)}</p>
    </div>
  </li>;
}

// Las filas se reparten el alto disponible del panel (auto-rows-fr) para no dejar hueco abajo.
function ReasonList({ children }) {
  return <ul className="grid flex-1 auto-rows-fr gap-x-5 md:grid-cols-2">{children}</ul>;
}

// Entradas "Título: explicación" de la IA: el título se resalta y el texto se muestra
// completo. Por defecto máximo 3 por recuadro (los consejos de composición admiten 5).
function InsightList({ items, tone, limit = 3 }) {
  return <ul className="space-y-1.5">{items.slice(0, limit).map((text, index) => {
    const separator = text.indexOf(':');
    const hasTitle = separator > 0 && separator <= 40;
    return <li key={index} className="text-[13px] leading-snug">
      {hasTitle ? <><span className={`font-semibold ${tone}`}>{text.slice(0, separator)}</span>{text.slice(separator)}</> : text}
    </li>;
  })}</ul>;
}

const ANALYSIS_TABS = [
  { id: 'draft', label: 'Lectura del draft' },
  { id: 'adaptations', label: 'Adaptaciones' },
  { id: 'why', label: 'Por qué esta build' },
  { id: 'loadout', label: 'Runas y hechizos' },
];

function AnalysisPanel({ result, items, itemLabel, runes, runeLabel }) {
  const [tab, setTab] = useState('draft');
  const allyTips = result.composition_analysis.ally_tips || [];
  const enemyTips = result.composition_analysis.enemy_tips || [];

  return <section className="rd-card rd-v2-build-analysis flex flex-col p-4">
    <div role="tablist" className="mb-2.5 flex shrink-0 flex-wrap gap-1 self-start rounded-xl border border-border bg-secondary/40 p-1">
      {ANALYSIS_TABS.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
    </div>
    <div role="tabpanel" className="rd-v2-build-analysis-body text-sm leading-relaxed text-muted-foreground">
      {tab === 'draft' && <div className="flex min-h-full flex-col gap-3">
        <div className="space-y-2"><p className="font-semibold text-foreground">{result.build_theme}</p><p className="text-[13px] leading-snug">{result.matchup_read}</p><p className="text-[13px] leading-snug">{result.composition_analysis.archetype_rationale}</p></div>
        {(allyTips.length > 0 || enemyTips.length > 0) && <div className="grid flex-1 gap-2.5 md:grid-cols-2">
          {allyTips.length > 0 && <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-sky-400"><Users size={14} /><span className="rd-label text-sky-400">Con tu equipo</span></div><InsightList items={allyTips} tone="text-sky-400" limit={5} /></div>}
          {enemyTips.length > 0 && <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-orange-400"><Swords size={14} /><span className="rd-label text-orange-400">Contra el rival</span></div><InsightList items={enemyTips} tone="text-orange-400" limit={5} /></div>}
        </div>}
      </div>}
      {tab === 'adaptations' && <div className="flex min-h-full flex-col gap-2.5">
        <ol className="grid gap-2.5 md:grid-cols-2">{result.key_adaptations.map((text, index) => <li key={index} className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-[13px] leading-snug"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</span><span>{text}</span></li>)}</ol>
        <div className="grid flex-1 gap-2.5 md:grid-cols-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-green-400"><CircleCheck size={14} /><span className="rd-label text-green-400">Fortalezas</span></div><InsightList items={[`Tu daño: ${result.build_plan.target_damage_profile}`, `Tu equipo: ${result.composition_analysis.allied_damage_profile}`]} tone="text-green-400" /></div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-yellow-400"><AlertTriangle size={14} /><span className="rd-label text-yellow-400">Requerimientos</span></div><InsightList items={result.composition_analysis.required_responses} tone="text-yellow-400" /></div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-red-400"><ShieldAlert size={14} /><span className="rd-label text-red-400">Riesgos</span></div><InsightList items={result.composition_analysis.enemy_priority_threats} tone="text-red-400" /></div>
        </div>
      </div>}
      {tab === 'why' && <div className="flex min-h-full flex-col gap-2">
        <div className="space-y-1.5 text-[13px] leading-snug"><p>{result.win_condition}</p><p>{result.build_plan.first_item_rationale}</p></div>
        <ReasonList>{items.map((item, index) => <ReasonRow key={item.id} selection={item} {...itemLabel(index)} />)}</ReasonList>
      </div>}
      {tab === 'loadout' && <div className="flex min-h-full flex-col">
        <ReasonList>
          {runes.map((rune, index) => <ReasonRow key={rune.id} selection={rune} label={runeLabel(index)} round featured={index === 0} className={index === 0 ? 'md:col-span-2' : ''} />)}
          {result.spells.map((spell, index) => <ReasonRow key={spell.id} selection={spell} label={`Hechizo ${index + 1}`} />)}
        </ReasonList>
      </div>}
    </div>
  </section>;
}

function EmptyResult() {
  return <div className="rd-card rd-v2-build-placeholder min-h-[520px] border-primary/15 p-8"><div className="flex h-full min-h-[455px] flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Sparkles className="text-primary" size={28} /></div><p className="rd-label mb-2">Tu build aparecer&aacute; ac&aacute;</p><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">Prepar&aacute; el draft</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Complet&aacute; ambas composiciones para recibir objetos, runas, hechizos y una explicaci&oacute;n estrat&eacute;gica.</p></div></div>;
}

export default function V2BuildResult({ state, result, error }) {
  if (state === 'idle') return <EmptyResult />;
  if (state === 'loading') return <div className="rd-card rd-v2-build-placeholder min-h-[520px] p-8"><div className="flex h-full min-h-[455px] flex-col items-center justify-center gap-4 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Loader2 size={28} className="animate-spin text-primary" /></div><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">Analizando la partida</h2><p className="max-w-md text-sm text-muted-foreground">Cruzando sinergias, amenazas, objetos, runas y hechizos.</p></div></div>;
  if (state !== 'success') {
    const labels = { validation_error: 'La respuesta no cumplio las reglas estructurales.', malformed_response: 'Gemini devolvio una respuesta malformada.', provider_error: 'No se pudo completar la solicitud a Gemini.' };
    return <div className="rd-card border-red-500/30 p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-semibold text-red-300">{labels[state] || 'Error'}</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div></div></div>;
  }

  const orderedItems = [...result.core_items, result.movement_item];
  const runes = [result.keystone, ...result.primary_runes, result.secondary_rune];
  const runeLabel = index => index === 0 ? 'Runa clave' : index === runes.length - 1 ? 'Secundaria' : `Principal ${index}`;
  const itemLabel = index => index === orderedItems.length - 1
    ? { label: 'Movimiento', badge: 'M' }
    : { label: `Objeto ${index + 1}`, badge: index + 1 };
  const divider = 'md:border-l md:border-border/50 md:pl-5';

  return <main className="rd-v2-build-success flex flex-col gap-4">
    <section className="rd-card flex flex-wrap items-start gap-x-6 gap-y-4 px-4 py-3.5 md:grid md:grid-cols-[6fr_5fr_2fr] md:gap-5">
      <IconGroup icon={Package} title="Objetos" columns={6}>{orderedItems.map((item, index) => <EntityIcon key={item.id} selection={item} {...itemLabel(index)} />)}</IconGroup>
      <IconGroup icon={Sparkles} title="Runas" columns={5} className={divider}>{runes.map((rune, index) => <EntityIcon key={rune.id} selection={rune} label={runeLabel(index)} round featured={index === 0} />)}</IconGroup>
      <IconGroup icon={Zap} title="Hechizos" columns={2} className={divider}>{result.spells.map((spell, index) => <EntityIcon key={spell.id} selection={spell} label={`Hechizo ${index + 1}`} />)}</IconGroup>
    </section>

    <AnalysisPanel key={result.build_theme} result={result} items={orderedItems} itemLabel={itemLabel} runes={runes} runeLabel={runeLabel} />
  </main>;
}
