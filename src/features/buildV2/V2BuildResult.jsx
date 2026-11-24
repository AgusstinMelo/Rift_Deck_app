import { useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CircleCheck, Loader2, Package, ShieldAlert, Sparkles, Swords, TrendingUp, Users, Zap } from 'lucide-react';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { pieceDraftFacts } from './v2DraftReasons';
import ReportAiContent from '@/components/ai/ReportAiContent';

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

/** Etiqueta de cada valor de item_scalings (las estadísticas de la ficha del objeto). */
const SCALING_LABELS = {
  daño_ataque: 'library.danoDeAtaque', velocidad_ataque: 'library.velAtaque', on_hit: 'buildV2.facts.alImpacto',
  poder_habilidad: 'library.poderDeHabilidad', aceleracion_habilidad: 'library.aceleracionDeHabilidad',
  vida: 'builds.vida', armadura: 'builds.armadura', resistencia_magica: 'library.resistMagica',
  penetracion_armadura_porcentual: 'library.penArmadura', penetracion_armadura_plana: 'library.penArmadura',
  penetracion_magica_porcentual: 'library.penMagica', penetracion_magica_plana: 'library.penMagica',
  vampirismo_fisico: 'library.vampFisico', vampirismo_magico: 'library.vampMagico', velocidad_movimiento: 'library.velMov',
  probabilidad_critico: 'library.tasaDeCriticos', daño_critico: 'library.danoCritico',
  mana: 'builds.mana', regeneracion_mana: 'builds.regMana', regeneracion_vida: 'builds.regVida',
  poder_curacion: 'library.curacionEscudo', poder_escudo: 'library.curacionEscudo',
};

/**
 * Por qué encaja en esta partida, calculado localmente (pieceDraftFacts, lo mismo que recibe
 * la IA): las amenazas del rival a las que responde y quiénes las forman; si no responde a
 * ninguna, con qué estadísticas de tu campeón escala. No depende de que la IA lo mencione.
 */
function DraftFacts({ facts }) {
  const t = useT();
  // Chips en una sola línea al lado del nombre: los que no entran se ocultan enteros (sin
  // "…"); el detalle completo, con quiénes forman cada amenaza, queda en el tooltip.
  if (facts.answers.length) {
    const label = signal => t(`library.runePerfil.counters.${signal}.nombre`);
    const full = facts.answers.map(({ signal, champions }) => `${label(signal)}${champions.length ? ` (${champions.join(', ')})` : ''}`).join(' · ');
    return <span className="rd-v2-facts" data-kind="answers" title={`${t('buildV2.facts.respondeA')}: ${full}`}>
      <em>{t('buildV2.facts.vs')}</em>
      {facts.answers.map(({ signal }) => <span key={signal}>{label(signal)}</span>)}
    </span>;
  }
  const scalings = [...new Set(facts.scalings.map(key => SCALING_LABELS[key]).filter(Boolean))].map(key => t(key));
  if (!scalings.length) return null;
  return <span className="rd-v2-facts" data-kind="kit" title={`${t('buildV2.facts.escalaConTuKit')} ${scalings.join(' · ')}`}>
    <TrendingUp size={11} aria-hidden="true" />
    {scalings.map(text => <span key={text}>{text}</span>)}
  </span>;
}

function ReasonRow({ selection, label, badge, round = false, featured = false, className = '', kind, draft }) {
  const entity = selection.entity;
  const { entityName } = useCatalogText();
  const facts = draft && entity ? pieceDraftFacts(entity, kind, draft) : null;
  return <li className={`flex items-center gap-2.5 border-b border-border/30 py-1.5 ${className}`}>
    <EntityIcon selection={selection} label={label} badge={badge} round={round} featured={featured} small />
    <div className="min-w-0 flex-1 text-[13px] leading-snug">
      <p className="rd-v2-row-head"><span className="shrink-0 font-semibold text-foreground">{entityName(entity)}</span><span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{label}</span>{facts && <DraftFacts facts={facts} />}</p>
      <p title={cleanText(selection.reason)} className="rd-v2-reason whitespace-pre-line">{cleanText(selection.reason)}</p>
    </div>
  </li>;
}

// Las filas se reparten el alto disponible del panel (auto-rows-fr) para no dejar hueco abajo.
function ReasonList({ children }) {
  return <ul className="grid flex-1 auto-rows-fr gap-x-5 md:grid-cols-2">{children}</ul>;
}

/**
 * Oculta los hijos de una lista que no entran enteros en su alto. Solo actúa si la lista
 * tiene alto fijo (overflow hidden, en escritorio: styles/11-suggester.css): así un texto
 * largo de la IA nunca obliga a scrollear ni queda cortado a la mitad.
 */
function useHideOverflowing(ref) {
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const clipped = getComputedStyle(list).overflowY === 'hidden';
      const bottom = list.getBoundingClientRect().bottom + 1;
      [...list.children].forEach(child => {
        // visibility no cambia el layout: medir y ocultar no se realimenta.
        child.style.visibility = !clipped || child.getBoundingClientRect().bottom <= bottom ? '' : 'hidden';
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  });
}

// Entradas "Título: explicación" de la IA: el título se resalta y el texto se muestra
// completo. Por defecto máximo 3 por recuadro (los consejos de composición admiten 5); en
// escritorio, las que no entran en el alto del recuadro se ocultan (el resto, en el tooltip).
function InsightList({ items, tone, limit = 3 }) {
  const ref = useRef(null);
  useHideOverflowing(ref);
  return <ul ref={ref} className="rd-v2-insights space-y-1.5">{items.slice(0, limit).map((text, index) => {
    const separator = text.indexOf(':');
    const hasTitle = separator > 0 && separator <= 40;
    return <li key={index} className="text-[13px] leading-snug" title={text}>
      {hasTitle ? <><span className={`font-semibold ${tone}`}>{text.slice(0, separator)}</span>{text.slice(separator)}</> : text}
    </li>;
  })}</ul>;
}

const ANALYSIS_TABS = [
  { id: 'draft', label: 'buildV2.tabs.draft' },
  { id: 'adaptations', label: 'buildV2.tabs.adaptations' },
  { id: 'why', label: 'buildV2.tabs.why' },
  { id: 'loadout', label: 'buildV2.tabs.loadout' },
];

// Lo que generó la IA en esta build, para guardarlo con un reporte.
const reportableBuild = (result, items, runes) => ({
  champion: result.champion?.name || result.champion,
  role: result.role,
  build_theme: result.build_theme,
  matchup_read: result.matchup_read,
  win_condition: result.win_condition,
  composition_analysis: result.composition_analysis,
  build_plan: result.build_plan,
  key_adaptations: result.key_adaptations,
  picks: [...items, ...runes, ...result.spells].map(pick => ({ name: pick.entity?.name, reason: pick.reason })),
});

function AnalysisPanel({ result, items, itemLabel, runes, runeLabel }) {
  const t = useT();
  const [tab, setTab] = useState('draft');
  const allyTips = result.composition_analysis.ally_tips || [];
  const enemyTips = result.composition_analysis.enemy_tips || [];

  return <section className="rd-card rd-v2-build-analysis flex flex-col p-4">
    <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div role="tablist" className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/40 p-1">
        {ANALYSIS_TABS.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{t(label)}</button>)}
      </div>
      <ReportAiContent feature="build" content={reportableBuild(result, items, runes)} />
    </div>
    <div role="tabpanel" className="rd-v2-build-analysis-body text-sm leading-relaxed text-muted-foreground">
      {tab === 'draft' && <div className="rd-v2-draft flex min-h-full flex-col gap-3">
        <div className="space-y-2">
          <p className="rd-v2-clamp-1 font-semibold text-foreground" title={result.build_theme}>{result.build_theme}</p>
          <p className="rd-v2-clamp-3 text-[13px] leading-snug" title={result.matchup_read}>{result.matchup_read}</p>
          <p className="rd-v2-clamp-2 text-[13px] leading-snug" title={result.composition_analysis.archetype_rationale}>{result.composition_analysis.archetype_rationale}</p>
        </div>
        {(allyTips.length > 0 || enemyTips.length > 0) && <div className="rd-v2-tips grid flex-1 gap-2.5 md:grid-cols-2">
          {allyTips.length > 0 && <div className="rd-v2-tip-box rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-sky-400"><Users size={14} /><span className="rd-label text-sky-400">{t('buildV2.conTuEquipo')}</span></div><InsightList items={allyTips} tone="text-sky-400" limit={5} /></div>}
          {enemyTips.length > 0 && <div className="rd-v2-tip-box rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-orange-400"><Swords size={14} /><span className="rd-label text-orange-400">{t('buildV2.contraElRival')}</span></div><InsightList items={enemyTips} tone="text-orange-400" limit={5} /></div>}
        </div>}
      </div>}
      {tab === 'adaptations' && <div className="rd-v2-draft flex min-h-full flex-col gap-2.5">
        <ol className="grid gap-2.5 md:grid-cols-2">{result.key_adaptations.map((text, index) => <li key={index} className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-[13px] leading-snug"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</span><span className="rd-v2-clamp-3" title={text}>{text}</span></li>)}</ol>
        <div className="rd-v2-tips grid flex-1 gap-2.5 md:grid-cols-3">
          <div className="rd-v2-tip-box rounded-xl border border-green-500/20 bg-green-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-green-400"><CircleCheck size={14} /><span className="rd-label text-green-400">{t('buildV2.fortalezas')}</span></div><InsightList items={[t('buildV2.tuDano', { target_damage_profile: result.build_plan.target_damage_profile }), t('buildV2.tuEquipo', { allied_damage_profile: result.composition_analysis.allied_damage_profile })]} tone="text-green-400" /></div>
          <div className="rd-v2-tip-box rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-yellow-400"><AlertTriangle size={14} /><span className="rd-label text-yellow-400">{t('buildV2.requerimientos')}</span></div><InsightList items={result.composition_analysis.required_responses} tone="text-yellow-400" /></div>
          <div className="rd-v2-tip-box rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5"><div className="mb-1.5 flex items-center gap-2 text-red-400"><ShieldAlert size={14} /><span className="rd-label text-red-400">{t('buildV2.riesgos')}</span></div><InsightList items={result.composition_analysis.enemy_priority_threats} tone="text-red-400" /></div>
        </div>
      </div>}
      {tab === 'why' && <div className="flex min-h-full flex-col gap-2">
        <div className="space-y-1.5 text-[13px] leading-snug"><p className="rd-v2-intro" title={result.win_condition}>{result.win_condition}</p><p className="rd-v2-intro" title={result.build_plan.first_item_rationale}>{result.build_plan.first_item_rationale}</p></div>
        <ReasonList>{items.map((item, index) => <ReasonRow key={item.id} selection={item} {...itemLabel(index)} kind="item" draft={result.draft} />)}</ReasonList>
      </div>}
      {tab === 'loadout' && <div className="flex min-h-full flex-col">
        <ReasonList>
          {runes.map((rune, index) => <ReasonRow key={rune.id} selection={rune} label={runeLabel(index)} round featured={index === 0} className={index === 0 ? 'md:col-span-2' : ''} kind="rune" draft={result.draft} />)}
          {result.spells.map((spell, index) => <ReasonRow key={spell.id} selection={spell} label={t('buildV2.hechizo', { value: index + 1 })} kind="spell" draft={result.draft} />)}
        </ReasonList>
      </div>}
    </div>
  </section>;
}

function EmptyResult() {
  const t = useT();
  return <div className="rd-card rd-v2-build-placeholder min-h-[520px] border-primary/15 p-8"><div className="flex h-full min-h-[455px] flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Sparkles className="text-primary" size={28} /></div><p className="rd-label mb-2">{t('buildV2.tuBuildApareceraAca')}</p><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">{t('buildV2.preparaElDraft')}</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t('buildV2.completaAmbasComposicionesPara')}</p></div></div>;
}

export default function V2BuildResult({ state, result, error }) {
  const t = useT();
  if (state === 'idle') return <EmptyResult />;
  if (state === 'loading') return <div className="rd-card rd-v2-build-placeholder min-h-[520px] p-8"><div className="flex h-full min-h-[455px] flex-col items-center justify-center gap-4 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Loader2 size={28} className="animate-spin text-primary" /></div><h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.05em]">{t('buildV2.analizandoLaPartida')}</h2><p className="max-w-md text-sm text-muted-foreground">{t('buildV2.cruzandoSinergiasAmenazasObjetos')}</p></div></div>;
  if (state !== 'success') {
    const labels = { validation_error: t('buildV2.laRespuestaNoCumplio'), malformed_response: t('buildV2.geminiDevolvioUnaRespuesta'), provider_error: t('buildV2.noSePudoCompletar') };
    return <div className="rd-card border-red-500/30 p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-semibold text-red-300">{labels[state] || t('buildV2.error')}</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div></div></div>;
  }

  const orderedItems = [...result.core_items, result.movement_item];
  const runes = [result.keystone, ...result.primary_runes, result.secondary_rune];
  const runeLabel = index => index === 0 ? t('buildV2.runaClave') : index === runes.length - 1 ? t('buildV2.secundaria') : t('buildV2.principal', { index });
  const itemLabel = index => index === orderedItems.length - 1
    ? { label: t('buildV2.movimiento'), badge: 'M' }
    : { label: t('buildV2.objeto', { value: index + 1 }), badge: index + 1 };
  const divider = 'md:border-l md:border-border/50 md:pl-5';

  return <main className="rd-v2-build-success flex flex-col gap-4">
    <section className="rd-card flex flex-wrap items-start gap-x-6 gap-y-4 px-4 py-3.5 md:grid md:grid-cols-[6fr_5fr_2fr] md:gap-5">
      <IconGroup icon={Package} title={t('common.items')} columns={6}>{orderedItems.map((item, index) => <EntityIcon key={item.id} selection={item} {...itemLabel(index)} />)}</IconGroup>
      <IconGroup icon={Sparkles} title={t('common.runes')} columns={5} className={divider}>{runes.map((rune, index) => <EntityIcon key={rune.id} selection={rune} label={runeLabel(index)} round featured={index === 0} />)}</IconGroup>
      <IconGroup icon={Zap} title={t('buildV2.hechizos')} columns={2} className={divider}>{result.spells.map((spell, index) => <EntityIcon key={spell.id} selection={spell} label={t('buildV2.hechizo', { value: index + 1 })} />)}</IconGroup>
    </section>

    <AnalysisPanel key={result.build_theme} result={result} items={orderedItems} itemLabel={itemLabel} runes={runes} runeLabel={runeLabel} />
  </main>;
}
