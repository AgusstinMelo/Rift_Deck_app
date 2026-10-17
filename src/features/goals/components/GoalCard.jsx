import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { getMetric } from '../metrics/index';
import { evolutionSeries } from '../engine/evolution';
import { describeGoal, formatPeriod } from '../texts';
import GoalEvolutionChart from './GoalEvolutionChart';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import GoalProgress from './GoalProgress';
import InsufficientSampleNotice from './InsufficientSampleNotice';

/**
 * Tarjeta de progreso de un objetivo. Ocupa todo el alto disponible: el gráfico de evolución
 * usa el espacio sobrante y es lo único que se achica; el pie queda siempre abajo.
 * @param {{ item: import('../model/goalLists').GoalItem }} props
 */
export default function GoalCard({ item }) {
  const { goal, evaluation } = item;
  const metric = getMetric(goal.metric);
  const objective = describeGoal(goal, { ...evaluation.period, timezone: goal.timezone }).objective;
  const hasEvolution = useMemo(
    () => evolutionSeries(goal.metric, evaluation.contributions).length >= 2,
    [goal.metric, evaluation.contributions],
  );

  return (
    <Link
      to={`/objetivos/${goal.id}`}
      className="rd-card rd-goal-card group flex h-full flex-col gap-3 p-4 transition-all hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rd-label truncate">{metric.label}</p>
          <h3 className="mt-0.5 font-rajdhani text-lg font-bold leading-tight text-foreground group-hover:text-primary line-clamp-1">
            {goal.name}
          </h3>
          <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{objective}</p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
      </div>

      <div className="border-t border-border/60 pt-3">
        <GoalProgress goal={goal} evaluation={evaluation} compact />
      </div>
      <InsufficientSampleNotice evaluation={evaluation} compact />

      {hasEvolution ? (
        <div className="rd-goal-card-chart flex min-h-[8rem] flex-1 flex-col gap-1 overflow-hidden border-t border-border/60 pt-3">
          <p className="rd-label">Evolución</p>
          <GoalEvolutionChart goal={goal} evaluation={evaluation} compact className="min-h-0 flex-1" />
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">La evolución aparece con datos en al menos dos días distintos.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays size={13} /> {formatPeriod(evaluation.period)}
        </span>
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
      </div>
    </Link>
  );
}
