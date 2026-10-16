import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { METRIC_KIND, OUTCOME, PERIOD_STATUS } from '../model/goalConstants';
import { cumulativeProgressPct, remainingToTarget } from '../engine/evaluateGoal';
import { formatDifference, formatMetricValue, operatorPhrase } from '../texts';
import { OUTCOME_BAR } from './goalUi';

/** Barra de progreso para métricas acumulativas. */
function CumulativeProgress({ goal, evaluation, compact }) {
  const pct = cumulativeProgressPct(evaluation) ?? 0;
  const remaining = remainingToTarget(evaluation) ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-rajdhani font-bold tracking-[-0.04em] text-foreground ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {formatMetricValue(goal, evaluation.value ?? 0)}
        </p>
        <p className="text-xs text-muted-foreground">Meta: {formatMetricValue(goal, evaluation.target)}</p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Progreso del objetivo"
      >
        <div className={`h-full rounded-full transition-all ${OUTCOME_BAR[evaluation.outcome]}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining > 0 ? `Faltan ${formatMetricValue(goal, remaining)}` : 'Meta cumplida'}
        {' · '}{Math.round(pct)}%
      </p>
    </div>
  );
}

function TodayIndicator({ evaluation }) {
  if (evaluation.meetsToday === null) return null;
  const notEnough = evaluation.sampleSize < evaluation.minSample;
  if (notEnough) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashed size={14} /> Todavía sin muestra suficiente
      </p>
    );
  }
  return evaluation.meetsToday ? (
    <p className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle2 size={14} /> Hoy cumpliría la meta</p>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-red-400"><XCircle size={14} /> Hoy no cumpliría la meta</p>
  );
}

/** Valor actual, diferencia y muestra para métricas de rendimiento (sin barra). */
function PerformanceProgress({ goal, evaluation, compact }) {
  const sampleTone = evaluation.sampleSize >= evaluation.minSample ? 'text-foreground' : 'text-amber-300';
  const differenceTone = evaluation.difference === null
    ? 'text-muted-foreground'
    : evaluation.outcome === OUTCOME.ACHIEVED || evaluation.meetsToday
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-rajdhani font-bold tracking-[-0.04em] text-foreground ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {formatMetricValue(goal, evaluation.value)}
        </p>
        <p className="text-xs text-muted-foreground text-right">
          Meta: {operatorPhrase(goal)} {formatMetricValue(goal, evaluation.target)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Diferencia: <span className={`font-semibold ${differenceTone}`}>{formatDifference(goal, evaluation.difference)}</span>
        </span>
        <span className="text-muted-foreground">
          Muestra: <span className={`font-semibold ${sampleTone}`}>{evaluation.sampleSize}/{evaluation.minSample}</span>
        </span>
      </div>
      {evaluation.periodStatus === PERIOD_STATUS.OPEN && <TodayIndicator evaluation={evaluation} />}
    </div>
  );
}

/**
 * @param {{ goal: any, evaluation: import('../model/goalConstants').GoalEvaluation, compact?: boolean }} props
 */
export default function GoalProgress({ goal, evaluation, compact = false }) {
  return evaluation.kind === METRIC_KIND.CUMULATIVE
    ? <CumulativeProgress goal={goal} evaluation={evaluation} compact={compact} />
    : <PerformanceProgress goal={goal} evaluation={evaluation} compact={compact} />;
}
