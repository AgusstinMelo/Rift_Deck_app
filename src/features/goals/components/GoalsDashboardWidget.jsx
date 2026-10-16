import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useGoalsAccess } from '../access';
import { useEvaluatedGoals } from '../hooks/useGoals';
import { partitionGoals, summarizeCurrent } from '../model/goalLists';
import { getMetric } from '../metrics/index';
import { formatDifference, formatMetricValue, formatPeriod, operatorPhrase } from '../texts';
import { AGGREGATION } from '../model/goalConstants';
import { cumulativeProgressPct } from '../engine/evaluateGoal';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import { OUTCOME_BAR } from './goalUi';

const ARROW_CLASS =
  'flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary/70 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed';

/** Un objetivo a la vez: nombre, valor contra meta y estado. */
function GoalSlide({ item }) {
  const { goal, evaluation } = item;
  // Barra solo en totales; los objetivos únicos y de rendimiento muestran meta en texto.
  const pct = cumulativeProgressPct(evaluation);
  const isSingleMatch = evaluation.aggregation === AGGREGATION.BEST;

  return (
    <Link to={`/objetivos/${goal.id}`} className="block min-h-0 flex-1 space-y-2 rounded-lg px-2 py-1.5 hover:bg-primary/5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{getMetric(goal.metric).label}</p>
          <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatMetricValue(goal, evaluation.value)} / {formatMetricValue(goal, evaluation.target)}
        </span>
      </div>

      {pct !== null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
          <div className={`h-full rounded-full ${OUTCOME_BAR[evaluation.outcome]}`} style={{ width: `${pct}%` }} />
        </div>
      ) : isSingleMatch ? (
        <p className="text-xs text-muted-foreground">
          Objetivo único · Meta: {operatorPhrase(goal)} {formatMetricValue(goal, evaluation.target)} en una partida
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Meta: {operatorPhrase(goal)} {formatMetricValue(goal, evaluation.target)}
          {' · '}Diferencia {formatDifference(goal, evaluation.difference)}
          {' · '}Muestra {evaluation.sampleSize}/{evaluation.minSample}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays size={12} /> {formatPeriod(evaluation.period)}
        </span>
      </div>
    </Link>
  );
}

/** Resumen compacto de los objetivos activos para el Dashboard, navegable con flechas. */
export default function GoalsDashboardWidget() {
  const access = useGoalsAccess();
  const { items, isLoading } = useEvaluatedGoals();
  const [index, setIndex] = useState(0);
  if (!access.hasAccess) return null;

  const { current } = partitionGoals(items);
  const summary = summarizeCurrent(current);
  // Si se archivan o cierran objetivos, el índice no puede quedar fuera de rango.
  const safeIndex = Math.min(index, Math.max(current.length - 1, 0));
  const go = delta => setIndex(Math.min(Math.max(safeIndex + delta, 0), current.length - 1));

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
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {summary.total} activos · <span className="text-green-400">{summary.achieved} alcanzados</span>
              {summary.atRisk > 0 && <> · <span className="text-red-400">{summary.atRisk} hoy no cumplirían</span></>}
            </p>
            {current.length > 1 && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => go(-1)} disabled={safeIndex === 0} className={ARROW_CLASS} aria-label="Objetivo anterior">
                  <ChevronLeft size={15} />
                </button>
                <span className="w-9 text-center text-[11px] text-muted-foreground" aria-live="polite">
                  {safeIndex + 1}/{current.length}
                </span>
                <button type="button" onClick={() => go(1)} disabled={safeIndex === current.length - 1} className={ARROW_CLASS} aria-label="Objetivo siguiente">
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
          <GoalSlide key={current[safeIndex].goal.id} item={current[safeIndex]} />
        </>
      )}
    </article>
  );
}
