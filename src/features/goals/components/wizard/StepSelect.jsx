import { ListChecks, Percent, PenLine, Settings2, Sigma, SlidersHorizontal, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { AGGREGATION_LABELS, listMetrics } from '../../metrics/index';
import { AGGREGATION, METRIC_FAMILY } from '../../model/goalConstants';
import { GOAL_GROUPS } from '../../suggestions';
import { BUTTON_GOLD } from '../goalUi';
import HorizontalRail from '../HorizontalRail';
import { useT } from '@/lib/LocaleContext';
import { DESKTOP_FIT_QUERY, useMatchMedia } from '@/hooks/useMatchMedia';

/** Sugeridos visibles por categoría; el resto de las métricas queda en el selector. */
const MAX_SUGGESTIONS = 3;
/** En la grilla de escritorio las tarjetas tienen todo el alto: entran más sugeridos. */
const MAX_SUGGESTIONS_GRID = 4;

/** Accesos de "A medida": cada tipo de cálculo abre la configuración con su primer dato. */
const CALCULATION_SHORTCUTS = [
  { aggregation: AGGREGATION.TOTAL, icon: Sigma },
  { aggregation: AGGREGATION.AVERAGE, icon: TrendingUp },
  { aggregation: AGGREGATION.BEST, icon: Trophy },
  { aggregation: AGGREGATION.COUNT, icon: ListChecks },
  { aggregation: AGGREGATION.PERCENTAGE, icon: Percent },
];

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

/** Acceso compacto (icono + texto corto) para la grilla de "A medida". */
function ShortcutButton({ title, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className="rd-action-card rd-goal-shortcut group w-full text-left">
      <Icon size={13} className="shrink-0 text-primary/70" />
      <span className="min-w-0 text-[12px] font-semibold leading-tight text-foreground group-hover:text-primary">{title}</span>
    </button>
  );
}

/**
 * Tarjeta de categoría: encabezado, opciones y botón para configurar, con el mismo formato para todas.
 * La métrica concreta (dato y cálculo) se elige en el paso de configuración.
 */
function ChoiceCard({ icon: Icon, title, description, tone = 'primary', optionsLabel, children, onConfigure }) {
  const t = useT();
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
            <Settings2 size={15} /> {t('goals.wizard.configureGoal')}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Paso 1: cinco categorías (acumulativos, promedios, porcentajes, únicos y a medida).
 * En escritorio van en una grilla que ocupa todo el alto disponible; en pantallas chicas,
 * en un carril horizontal con flechas.
 * @param {{ suggestions: any[], onPickSuggestion: (suggestion: any) => void, onPickCustom: (metricId: string) => void }} props
 */
export default function StepSelect({ suggestions, onPickSuggestion, onPickCustom }) {
  const t = useT();
  const isGrid = useMatchMedia(DESKTOP_FIT_QUERY);
  const maxSuggestions = isGrid ? MAX_SUGGESTIONS_GRID : MAX_SUGGESTIONS;
  const metrics = listMetrics();
  const firstMatchMetric = metrics.find(metric => metric.source === 'matches');
  const calculationShortcuts = CALCULATION_SHORTCUTS
    .map(shortcut => ({ ...shortcut, metric: metrics.find(metric => metric.aggregation === shortcut.aggregation && metric.source === 'matches') }))
    .filter(shortcut => shortcut.metric);

  const groupCards = GOAL_GROUPS.map(group => ({
    key: group.id,
    node: (
      <ChoiceCard
        icon={GROUP_ICONS[group.id] || Sparkles}
        title={group.label}
        description={group.description}
        optionsLabel={t('goals.wizard.suggested')}
        onConfigure={() => onPickCustom(metrics.find(metric => metric.family === group.id).id)}
      >
        {suggestions
          .filter(suggestion => suggestion.category === group.id)
          .slice(0, maxSuggestions)
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
        title={t('goals.wizard.customTitle')}
        description={t('goals.wizard.customDescription')}
        optionsLabel={t('goals.wizard.otherOptions')}
        onConfigure={() => onPickCustom(firstMatchMetric.id)}
      >
        {/* Accesos compactos en dos columnas: las seis opciones entran sin scroll. */}
        <div className="grid grid-cols-2 gap-1.5">
          {calculationShortcuts.map(({ aggregation, icon: Icon, metric }) => (
            <ShortcutButton key={aggregation} title={AGGREGATION_LABELS[aggregation]} icon={Icon} onClick={() => onPickCustom(metric.id)} />
          ))}
          <ShortcutButton title={t('goals.wizard.manualHabit')} icon={PenLine} onClick={() => onPickCustom('manual')} />
        </div>
      </ChoiceCard>
    ),
  };

  const cards = [...groupCards, customCard];

  if (isGrid) {
    return (
      <div className="rd-goal-choice-grid" role="list" aria-label={t('goals.wizard.categories')}>
        {cards.map(card => <div key={card.key} role="listitem" className="rd-goal-choice-cell">{card.node}</div>)}
      </div>
    );
  }

  return (
    <HorizontalRail
      label={t('goals.wizard.categories')}
      itemLabel={t('goals.wizard.categoriesItem')}
      itemClassName="basis-[85%] md:basis-[calc((100%-0.75rem)/2)] xl:basis-[calc((100%-2.25rem)/4)]"
      items={cards}
    />
  );
}
