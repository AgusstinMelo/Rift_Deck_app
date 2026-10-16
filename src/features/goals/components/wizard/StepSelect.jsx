import { Percent, PenLine, Settings2, Sigma, SlidersHorizontal, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { listMetrics } from '../../metrics/index';
import { METRIC_FAMILY } from '../../model/goalConstants';
import { GOAL_GROUPS } from '../../suggestions';
import { BUTTON_GOLD } from '../goalUi';
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
 * Tarjeta de categoría: encabezado, opciones y botón para configurar, con el mismo formato para todas.
 * La métrica concreta (dato y cálculo) se elige en el paso de configuración.
 */
function ChoiceCard({ icon: Icon, title, description, tone = 'primary', optionsLabel, children, onConfigure }) {
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
        <div className="mt-auto border-t border-border/60 pt-3">
          <button type="button" onClick={onConfigure} className={BUTTON_GOLD}>
            <Settings2 size={15} /> Configurar objetivo
          </button>
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
        onConfigure={() => onPickCustom(metrics.find(metric => metric.family === group.id).id)}
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
        optionsLabel="Otras opciones"
        onConfigure={() => onPickCustom(firstMatchMetric.id)}
      >
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
