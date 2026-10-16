import { Percent, PenLine, Sigma, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react';
import { listMetrics } from '../../metrics/index';
import { METRIC_FAMILY } from '../../model/goalConstants';
import { GOAL_GROUPS } from '../../suggestions';
import { INPUT_CLASS } from '../goalUi';

const GROUP_ICONS = {
  [METRIC_FAMILY.CUMULATIVE]: Sigma,
  [METRIC_FAMILY.AVERAGE]: TrendingUp,
  [METRIC_FAMILY.PERCENTAGE]: Percent,
};

function SuggestionButton({ suggestion, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(suggestion)}
      className="rd-action-card group w-full justify-between gap-2 px-3 py-2 text-left"
    >
      <span className="text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary">{suggestion.title}</span>
      <Sparkles size={13} className="shrink-0 text-primary/70" />
    </button>
  );
}

/** Selector compacto de las métricas de un grupo: al elegir una, se pasa a configurarla. */
function MetricPicker({ metrics, onPick, label }) {
  return (
    <select
      value=""
      onChange={event => event.target.value && onPick(event.target.value)}
      aria-label={label}
      className={`${INPUT_CLASS} cursor-pointer`}
    >
      <option value="" disabled>Elegí una métrica…</option>
      {metrics.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
    </select>
  );
}

function ChoiceHeader({ icon: Icon, title, description, tone = 'primary' }) {
  const toneClass = tone === 'accent' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-primary/20 bg-primary/10 text-primary';
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <h2 className="rd-card-title">{title}</h2>
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Paso 1: objetivos agrupados por tipo (acumulativos, promedios, porcentajes) y "A medida".
 * @param {{ suggestions: any[], onPickSuggestion: (suggestion: any) => void, onPickCustom: (metricId: string) => void }} props
 */
export default function StepSelect({ suggestions, onPickSuggestion, onPickCustom }) {
  const metrics = listMetrics();
  // En "A medida" van las ideas que no encajan en los otros grupos (mejor partida y hábitos).
  const customSuggestions = suggestions.filter(suggestion => [METRIC_FAMILY.RECORD, METRIC_FAMILY.MANUAL].includes(suggestion.category));
  const firstMatchMetric = metrics.find(metric => metric.source === 'matches');

  return (
    <div className="rd-goal-choices grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {GOAL_GROUPS.map(group => {
        const Icon = GROUP_ICONS[group.id] || Sparkles;
        const items = suggestions.filter(suggestion => suggestion.category === group.id);
        const groupMetrics = metrics.filter(metric => metric.family === group.id);
        return (
          <section key={group.id} className="rd-card rd-goal-choice flex flex-col gap-3 p-4">
            <ChoiceHeader icon={Icon} title={group.label} description={group.description} />
            <div className="rd-goal-choice-body flex flex-1 flex-col gap-3">
              <div className="space-y-2">
                <p className="rd-label">Sugeridos</p>
                {items.map(suggestion => <SuggestionButton key={suggestion.id} suggestion={suggestion} onPick={onPickSuggestion} />)}
              </div>
              <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
                <p className="rd-label">O elegí la métrica</p>
                <MetricPicker metrics={groupMetrics} onPick={onPickCustom} label={`Métricas de ${group.label}`} />
              </div>
            </div>
          </section>
        );
      })}

      <section className="rd-card rd-goal-choice flex flex-col gap-3 border-accent/25 p-4">
        <ChoiceHeader
          icon={SlidersHorizontal}
          tone="accent"
          title="A medida"
          description='Combiná dato y cálculo (total, promedio, mejor partida o porcentaje), meta, filtros y período.'
        />
        <div className="rd-goal-choice-body flex flex-1 flex-col gap-2">
          <button type="button" onClick={() => onPickCustom(firstMatchMetric.id)} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><SlidersHorizontal size={15} /> Configurar desde cero</span>
            <span className="text-[11px] text-muted-foreground">Elegí el dato y el cálculo: total, promedio, mejor partida o porcentaje.</span>
          </button>
          <button type="button" onClick={() => onPickCustom('manual')} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><PenLine size={15} /> Hábito manual</span>
            <span className="text-[11px] text-muted-foreground">Una unidad propia que sumás con check-ins.</span>
          </button>
          {customSuggestions.length > 0 && (
            <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
              <p className="rd-label">Ideas</p>
              {customSuggestions.map(suggestion => <SuggestionButton key={suggestion.id} suggestion={suggestion} onPick={onPickSuggestion} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
