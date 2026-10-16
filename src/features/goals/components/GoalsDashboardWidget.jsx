import { Link } from 'react-router-dom';
import { ArrowRight, Target } from 'lucide-react';
import { useGoalsAccess } from '../access';
import { useEvaluatedGoals } from '../hooks/useGoals';
import { partitionGoals, summarizeCurrent } from '../model/goalLists';
import { formatMetricValue } from '../texts';
import { METRIC_KIND } from '../model/goalConstants';
import { cumulativeProgressPct } from '../engine/evaluateGoal';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import { OUTCOME_BAR } from './goalUi';

const MAX_ROWS = 3;

function GoalRow({ item }) {
  const { goal, evaluation } = item;
  const pct = evaluation.kind === METRIC_KIND.CUMULATIVE ? cumulativeProgressPct(evaluation) : null;
  return (
    <li>
      <Link to={`/objetivos/${goal.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-primary/5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatMetricValue(goal, evaluation.value)} / {formatMetricValue(goal, evaluation.target)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {pct !== null && (
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
              <div className={`h-full rounded-full ${OUTCOME_BAR[evaluation.outcome]}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
        </div>
      </Link>
    </li>
  );
}

/** Resumen compacto de los objetivos activos para el Dashboard. */
export default function GoalsDashboardWidget() {
  const access = useGoalsAccess();
  const { items, isLoading } = useEvaluatedGoals();
  if (!access.hasAccess) return null;

  const { current } = partitionGoals(items);
  const summary = summarizeCurrent(current);

  return (
    <article className="rd-card p-4 min-h-0 overflow-hidden flex flex-col gap-2" aria-label="Objetivos activos">
      <div className="flex items-center justify-between gap-2">
        <span className="rd-label flex items-center gap-2"><Target size={15} className="text-primary" /> Objetivos activos</span>
        <Link to="/objetivos" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Ver todos <ArrowRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-secondary/50" />
      ) : current.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-1">
          <p className="text-sm text-muted-foreground">No tenés objetivos activos.</p>
          <Link to="/objetivos/nuevo" className="text-xs font-semibold text-primary hover:underline">Crear un objetivo</Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {summary.total} activos · <span className="text-green-400">{summary.achieved} alcanzados</span>
            {summary.atRisk > 0 && <> · <span className="text-red-400">{summary.atRisk} hoy no cumplirían</span></>}
          </p>
          <ul className="min-h-0 space-y-1 overflow-y-auto">
            {current.slice(0, MAX_ROWS).map(item => <GoalRow key={item.goal.id} item={item} />)}
          </ul>
        </>
      )}
    </article>
  );
}
