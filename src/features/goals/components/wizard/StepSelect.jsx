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
  const manualSuggestions = suggestions.filter(suggestion => suggestion.category === METRIC_FAMILY.MANUAL);
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
                <div className="flex flex-wrap gap-2">
                  {groupMetrics.map(metric => (
                    <button key={metric.id} type="button" onClick={() => onPickCustom(metric.id)} className={`${CHIP_BASE} ${CHIP_OFF}`}>
                      {metric.label}
                    </button>
                  ))}
                </div>
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
          description='Cualquier métrica, meta "al menos" o "como máximo", filtros y período a tu gusto.'
        />
        <div className="rd-goal-choice-body flex flex-1 flex-col gap-2">
          <button type="button" onClick={() => onPickCustom(firstMatchMetric.id)} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><SlidersHorizontal size={15} /> Configurar desde cero</span>
            <span className="text-[11px] text-muted-foreground">Elegí la estadística y armá la meta.</span>
          </button>
          <button type="button" onClick={() => onPickCustom('manual')} className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary"><PenLine size={15} /> Hábito manual</span>
            <span className="text-[11px] text-muted-foreground">Una unidad propia que sumás con check-ins.</span>
          </button>
          {manualSuggestions.length > 0 && (
            <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
              <p className="rd-label">Hábitos sugeridos</p>
              {manualSuggestions.map(suggestion => <SuggestionButton key={suggestion.id} suggestion={suggestion} onPick={onPickSuggestion} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
