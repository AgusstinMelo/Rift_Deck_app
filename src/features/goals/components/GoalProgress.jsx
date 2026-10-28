import { CheckCircle2, CircleDashed, Trophy, XCircle } from 'lucide-react';
import { AGGREGATION, METRIC_KIND, OUTCOME, PERIOD_STATUS } from '../model/goalConstants';
import { cumulativeProgressPct, remainingToTarget } from '../engine/evaluateGoal';
import { formatDifference, formatMetricValue, operatorPhrase } from '../texts';
import { OUTCOME_BAR } from './goalUi';
import { useT } from '@/lib/LocaleContext';

/** Objetivo único: la mejor marca del período contra la meta, sin barra. */
function SingleMatchProgress({ goal, evaluation, compact }) {
  const t = useT();
  const achieved = evaluation.outcome === OUTCOME.ACHIEVED;
  const noData = evaluation.value === null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-rajdhani font-bold tracking-[-0.04em] text-foreground ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {formatMetricValue(goal, evaluation.value)}
        </p>
        <p className="text-xs text-muted-foreground text-right">
          {t('goals.progressInfo.targetValue', { op: operatorPhrase(goal), value: formatMetricValue(goal, evaluation.target) })}
        </p>
      </div>
      <p className={`flex items-center gap-1.5 text-xs ${achieved ? 'text-green-400' : 'text-muted-foreground'}`}>
        {achieved ? <Trophy size={14} /> : <CircleDashed size={14} />}
        {achieved
          ? t('goals.progressInfo.achievedInOne')
          : noData
            ? t('goals.progressInfo.noValidMatches')
            : t(evaluation.sampleSize === 1 ? 'goals.progressInfo.bestSoFarOne' : 'goals.progressInfo.bestSoFarOther', { count: evaluation.sampleSize })}
      </p>
    </div>
  );
}

/** Barra de progreso para métricas acumulativas. */
function CumulativeProgress({ goal, evaluation, compact }) {
  const t = useT();
  const pct = cumulativeProgressPct(evaluation) ?? 0;
  const remaining = remainingToTarget(evaluation) ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-rajdhani font-bold tracking-[-0.04em] text-foreground ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {formatMetricValue(goal, evaluation.value ?? 0)}
        </p>
        <p className="text-xs text-muted-foreground">{t('goals.progressInfo.targetOnly', { value: formatMetricValue(goal, evaluation.target) })}</p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={t('goals.progressInfo.aria')}
      >
        <div className={`h-full rounded-full transition-all ${OUTCOME_BAR[evaluation.outcome]}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining > 0 ? t('goals.progressInfo.remaining', { value: formatMetricValue(goal, remaining) }) : t('goals.progressInfo.done')}
        {' · '}{Math.round(pct)}%
      </p>
    </div>
  );
}

function TodayIndicator({ evaluation, compact }) {
  const t = useT();
  if (evaluation.meetsToday === null) return null;
  const notEnough = evaluation.sampleSize < evaluation.minSample;
  // En las tarjetas, el aviso de evidencia insuficiente ya lo dice.
  if (notEnough && compact) return null;
  if (notEnough) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashed size={14} /> {t('goals.progressInfo.notEnoughSample')}
      </p>
    );
  }
  return evaluation.meetsToday ? (
    <p className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle2 size={14} /> {t('goals.progressInfo.wouldMeet')}</p>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-red-400"><XCircle size={14} /> {t('goals.progressInfo.wouldNotMeet')}</p>
  );
}

/** Valor actual, diferencia y muestra para métricas de rendimiento (sin barra). */
function PerformanceProgress({ goal, evaluation, compact }) {
  const t = useT();
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
          {t('goals.progressInfo.targetValue', { op: operatorPhrase(goal), value: formatMetricValue(goal, evaluation.target) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          {t('goals.progressInfo.difference')}: <span className={`font-semibold ${differenceTone}`}>{formatDifference(goal, evaluation.difference)}</span>
        </span>
        <span className="text-muted-foreground">
          {t('goals.progressInfo.sample')}: <span className={`font-semibold ${sampleTone}`}>{evaluation.sampleSize}/{evaluation.minSample}</span>
        </span>
      </div>
      {evaluation.periodStatus === PERIOD_STATUS.OPEN && <TodayIndicator evaluation={evaluation} compact={compact} />}
    </div>
  );
}

/**
 * @param {{ goal: any, evaluation: import('../model/goalConstants').GoalEvaluation, compact?: boolean }} props
 */
export default function GoalProgress({ goal, evaluation, compact = false }) {
  if (evaluation.aggregation === AGGREGATION.BEST) {
    return <SingleMatchProgress goal={goal} evaluation={evaluation} compact={compact} />;
  }
  return evaluation.kind === METRIC_KIND.CUMULATIVE
    ? <CumulativeProgress goal={goal} evaluation={evaluation} compact={compact} />
    : <PerformanceProgress goal={goal} evaluation={evaluation} compact={compact} />;
}
