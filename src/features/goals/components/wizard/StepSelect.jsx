import { Percent, PenLine, Sigma, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react';
import { listMetrics } from '../../metrics/index';
import { METRIC_FAMILY } from '../../model/goalConstants';
import { GOAL_GROUPS } from '../../suggestions';
import { CHIP_BASE, CHIP_OFF } from '../goalUi';

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
      className="rd-action-card group w-full justify-between px-3 py-2.5 text-left"
    >
      <span className="text-sm font-semibold text-foreground group-hover:text-primary">{suggestion.title}</span>
      <Sparkles size={14} className="shrink-0 text-primary/70" />
    </button>
  );
}

/**
 * Paso 1: objetivos agrupados por tipo (acumulativos, promedios, porcentajes) y "A medida".
 * @param {{ suggestions: any[], onPickSuggestion: (suggestion: any) => void, onPickCustom: (metricId: string) => void }} props
 */
export default function StepSelect({ suggestions, onPickSuggestion, onPickCustom }) {
  const metrics = listMetrics();
  const manualSuggestions = suggestions.filter(suggestion => suggestion.category === METRIC_FAMILY.MANUAL);
  const firstMatchMetric = metrics.find(metric => metric.source === 'matches');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {GOAL_GROUPS.map(group => {
          const Icon = GROUP_ICONS[group.id] || Sparkles;
          const items = suggestions.filter(suggestion => suggestion.category === group.id);
          const groupMetrics = metrics.filter(metric => metric.family === group.id);
          return (
            <section key={group.id} className="rd-card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="rd-card-title">{group.label}</h2>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="rd-label">Sugeridos</p>
                {items.map(suggestion => <SuggestionButton key={suggestion.id} suggestion={suggestion} onPick={onPickSuggestion} />)}
              </div>

              <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
                <p className="rd-label">O elegí la métrica</p>
                <div className="flex flex-wrap gap-2">
                  {groupMetrics.map(metric => (
                    <button key={metric.id} type="button" onClick={() => onPickCustom(metric.id)} className={`${CHIP_BASE} ${CHIP_OFF}`}>
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="rd-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
            <SlidersHorizontal size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="rd-card-title">A medida</h2>
            <p className="text-xs text-muted-foreground">
              Configurá todo a tu gusto: cualquier métrica, si la meta es &quot;al menos&quot; o &quot;como máximo&quot;, filtros y período. O seguí un hábito propio con check-ins.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={() => onPickCustom(firstMatchMetric.id)} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><SlidersHorizontal size={15} /> Configurar desde cero</span>
            <span className="text-[11px] text-muted-foreground">Elegí la estadística y armá la meta.</span>
          </button>
          <button type="button" onClick={() => onPickCustom('manual')} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><PenLine size={15} /> Hábito manual</span>
            <span className="text-[11px] text-muted-foreground">Una unidad propia que sumás con check-ins.</span>
          </button>
          {manualSuggestions.map(suggestion => <SuggestionButton key={suggestion.id} suggestion={suggestion} onPick={onPickSuggestion} />)}
        </div>
      </section>
    </div>
  );
}
