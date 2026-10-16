import { Percent, PenLine, Sigma, SlidersHorizontal, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { listMetrics } from '../../metrics/index';
import { METRIC_FAMILY } from '../../model/goalConstants';
import { GOAL_GROUPS } from '../../suggestions';
import { FAMILY_LABELS } from '../../texts';
import { INPUT_CLASS } from '../goalUi';
import HorizontalRail from '../HorizontalRail';

/** Sugeridos visibles por categoría; el resto de las métricas queda en el selector. */
const MAX_SUGGESTIONS = 3;

const GROUP_ICONS = {
  [METRIC_FAMILY.CUMULATIVE]: Sigma,
  [METRIC_FAMILY.AVERAGE]: TrendingUp,
  [METRIC_FAMILY.PERCENTAGE]: Percent,
  [METRIC_FAMILY.RECORD]: Trophy,
};

function OptionButton({ title, onClick, icon: Icon = Sparkles }) {
  return (
    <button type="button" onClick={onClick} className="rd-action-card group w-full justify-between gap-2 px-3 py-2 text-left">
      <span className="text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary">{title}</span>
      <Icon size={13} className="shrink-0 text-primary/70" />
    </button>
  );
}

/**
 * Selector compacto de métricas: al elegir una, se pasa a configurarla.
 * Con más de un grupo muestra las métricas agrupadas por familia.
 * @param {{ groups: { label: string, metrics: any[] }[], onPick: (metricId: string) => void, label: string }} props
 */
function MetricPicker({ groups, onPick, label }) {
  const options = metrics => metrics.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>);
  return (
    <select
      value=""
      onChange={event => event.target.value && onPick(event.target.value)}
      aria-label={label}
      className={`${INPUT_CLASS} cursor-pointer`}
    >
      <option value="" disabled>Elegí una métrica…</option>
      {groups.length === 1
        ? options(groups[0].metrics)
        : groups.map(group => <optgroup key={group.label} label={group.label}>{options(group.metrics)}</optgroup>)}
    </select>
  );
}

/** Tarjeta de categoría: encabezado, opciones y selector de métrica, con el mismo formato para todas. */
function ChoiceCard({ icon: Icon, title, description, tone = 'primary', optionsLabel, children, picker }) {
  const toneClass = tone === 'accent' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-primary/20 bg-primary/10 text-primary';
  return (
    <section className="rd-card rd-goal-choice flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="rd-card-title">{title}</h2>
          <p className="text-xs leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rd-goal-choice-body flex flex-1 flex-col gap-3">
        <div className="space-y-2">
          <p className="rd-label">{optionsLabel}</p>
          {children}
        </div>
        <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
          <p className="rd-label">O elegí la métrica</p>
          {picker}
        </div>
      </div>
    </section>
  );
}

/**
 * Paso 1: cinco categorías (acumulativos, promedios, porcentajes, únicos y a medida)
 * en un carril horizontal con flechas.
 * @param {{ suggestions: any[], onPickSuggestion: (suggestion: any) => void, onPickCustom: (metricId: string) => void }} props
 */
export default function StepSelect({ suggestions, onPickSuggestion, onPickCustom }) {
  const metrics = listMetrics();
  const firstMatchMetric = metrics.find(metric => metric.source === 'matches');

  const groupCards = GOAL_GROUPS.map(group => ({
    key: group.id,
    node: (
      <ChoiceCard
        icon={GROUP_ICONS[group.id] || Sparkles}
        title={group.label}
        description={group.description}
        optionsLabel="Sugeridos"
        picker={(
          <MetricPicker
            groups={[{ label: group.label, metrics: metrics.filter(metric => metric.family === group.id) }]}
            onPick={onPickCustom}
            label={`Métricas de ${group.label}`}
          />
        )}
      >
        {suggestions
          .filter(suggestion => suggestion.category === group.id)
          .slice(0, MAX_SUGGESTIONS)
          .map(suggestion => <OptionButton key={suggestion.id} title={suggestion.title} onClick={() => onPickSuggestion(suggestion)} />)}
      </ChoiceCard>
    ),
  }));

  const customCard = {
    key: 'a-medida',
    node: (
      <ChoiceCard
        icon={SlidersHorizontal}
        tone="accent"
        title="A medida"
        description="Combiná dato y cálculo (total, promedio, en una sola partida o porcentaje), meta, filtros y período."
        optionsLabel="Empezar"
        picker={(
          <MetricPicker
            groups={Object.values(METRIC_FAMILY).map(family => ({
              label: FAMILY_LABELS[family],
              metrics: metrics.filter(metric => metric.family === family),
            }))}
            onPick={onPickCustom}
            label="Todas las métricas"
          />
        )}
      >
        <OptionButton title="Configurar desde cero" icon={SlidersHorizontal} onClick={() => onPickCustom(firstMatchMetric.id)} />
        <OptionButton title="Hábito manual con check-ins" icon={PenLine} onClick={() => onPickCustom('manual')} />
      </ChoiceCard>
    ),
  };

  return (
    <HorizontalRail
      label="Categorías de objetivos"
      itemLabel="categorías"
      itemClassName="basis-[85%] md:basis-[calc((100%-0.75rem)/2)] xl:basis-[calc((100%-2.25rem)/4)]"
      items={[...groupCards, customCard]}
    />
  );
}
