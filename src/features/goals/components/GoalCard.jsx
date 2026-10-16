import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { getMetric } from '../metrics/index';
import { describeGoal, formatPeriod } from '../texts';
import GoalEvolutionChart from './GoalEvolutionChart';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import GoalProgress from './GoalProgress';
import InsufficientSampleNotice from './InsufficientSampleNotice';

/**
 * Tarjeta de progreso de un objetivo. Ocupa todo el alto disponible: el gráfico de evolución crece con el espacio.
 * @param {{ item: import('../model/goalLists').GoalItem }} props
 */
export default function GoalCard({ item }) {
  const { goal, evaluation } = item;
  const metric = getMetric(goal.metric);
  const objective = describeGoal(goal, { ...evaluation.period, timezone: goal.timezone }).objective;

  return (
    <Link
      to={`/objetivos/${goal.id}`}
      className="rd-card rd-goal-card group flex h-full flex-col gap-4 p-4 transition-all hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rd-label truncate">{metric.label}</p>
          <h3 className="mt-1 font-rajdhani text-lg font-bold leading-tight text-foreground group-hover:text-primary line-clamp-2">
            {goal.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{objective}</p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
      </div>

      <GoalProgress goal={goal} evaluation={evaluation} compact />
      <InsufficientSampleNotice evaluation={evaluation} />

      <div className="rd-goal-card-chart flex min-h-[9rem] flex-1 flex-col gap-1.5 border-t border-border/60 pt-3">
        <p className="rd-label">Evolución</p>
        <GoalEvolutionChart goal={goal} evaluation={evaluation} compact className="min-h-[8rem] flex-1" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays size={13} /> {formatPeriod(evaluation.period)}
        </span>
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
      </div>
    </Link>
  );
}
