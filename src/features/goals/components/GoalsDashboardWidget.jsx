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
import { useT } from '@/lib/LocaleContext';

const ARROW_CLASS = 'rd-arrow h-7 w-7';

/** Un objetivo a la vez: nombre, valor contra meta y estado. */
function GoalSlide({ item }) {
  const t = useT();
  const { goal, evaluation } = item;
  // Barra solo en totales; los objetivos únicos y de rendimiento muestran meta en texto.
  const pct = cumulativeProgressPct(evaluation);
  const isSingleMatch = evaluation.aggregation === AGGREGATION.BEST;

  return (
    // Cada fila tiene un alto exacto: la barra/meta y la fila de estado y fechas
    // quedan siempre en la misma posición, sea cual sea el objetivo.
    <Link to={`/objetivos/${goal.id}`} className="rd-goal-slide flex shrink-0 flex-col gap-2 overflow-hidden rounded-lg px-2 py-1.5 hover:bg-primary/5">
      <div className="rd-goal-slide-top flex h-9 shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="rd-goal-slide-kicker truncate text-[10px] leading-4 uppercase tracking-[0.14em] text-muted-foreground">{getMetric(goal.metric).label}</p>
          <p className="truncate text-sm leading-5 font-semibold text-foreground">{goal.name}</p>
        </div>
        <span className="shrink-0 text-xs leading-4 text-muted-foreground">
          {formatMetricValue(goal, evaluation.value)} / {formatMetricValue(goal, evaluation.target)}
        </span>
      </div>

      {/* Altura fija: barra o texto ocupan el mismo espacio, así nada se mueve al cambiar de objetivo. */}
      <div className="rd-goal-slide-meter flex h-5 shrink-0 items-center">
        {pct !== null ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
            <div className={`h-full rounded-full ${OUTCOME_BAR[evaluation.outcome]}`} style={{ width: `${pct}%` }} />
          </div>
        ) : isSingleMatch ? (
          <p className="truncate text-xs text-muted-foreground">
            {t('goals.widget.singleTarget', { op: operatorPhrase(goal), value: formatMetricValue(goal, evaluation.target) })}
          </p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {t('goals.progressInfo.targetValue', { op: operatorPhrase(goal), value: formatMetricValue(goal, evaluation.target) })}
            {' · '}{t('goals.progressInfo.difference')} {formatDifference(goal, evaluation.difference)}
            {' · '}{t('goals.progressInfo.sample')} {evaluation.sampleSize}/{evaluation.minSample}
          </p>
        )}
      </div>

      <div className="rd-goal-slide-status flex h-6 shrink-0 items-center justify-between gap-2 overflow-hidden">
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
          <CalendarDays size={12} /> {formatPeriod(evaluation.period)}
        </span>
      </div>
    </Link>
  );
}

/** Resumen compacto de los objetivos activos para el Dashboard, navegable con flechas. */
export default function GoalsDashboardWidget() {
  const t = useT();
  const access = useGoalsAccess();
  const { items, isLoading } = useEvaluatedGoals();
  const [index, setIndex] = useState(0);
  if (!access.hasAccess) return null;

  const { current } = partitionGoals(items);
  const summary = summarizeCurrent(current, items);
  // Si se archivan o cierran objetivos, el índice no puede quedar fuera de rango.
  const safeIndex = Math.min(index, Math.max(current.length - 1, 0));
  const go = delta => setIndex(Math.min(Math.max(safeIndex + delta, 0), current.length - 1));

  return (
    <article className="rd-card rd-goals-widget p-4 min-h-0 overflow-hidden flex flex-col gap-2" aria-label={t('goals.widget.aria')}>
      <div className="rd-goals-widget-head flex items-center justify-between gap-2">
        <span className="rd-label flex items-center gap-2"><Target size={15} className="text-primary" /> {t('goals.widget.title')}<span className="rd-goals-widget-title-extra">{t('goals.widget.titleExtra')}</span></span>
        <Link to="/objetivos" className="rd-goals-widget-all flex items-center gap-1 text-xs text-primary hover:underline">
          {t('common.seeAll')} <ArrowRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-secondary/50" />
      ) : current.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-1">
          <p className="text-sm text-muted-foreground">{t('goals.widget.empty')}</p>
          <Link to="/objetivos/nuevo" className="text-xs font-semibold text-primary hover:underline">{t('goals.widget.create')}</Link>
        </div>
      ) : (
        <>
          <div className="rd-goals-widget-summary flex items-center justify-between gap-2">
            <p className="rd-goals-widget-count min-w-0 truncate text-xs text-muted-foreground">
              {t('goals.widget.active', { count: summary.total })}
              {summary.dueSoon > 0 && <> · <span className="text-amber-300">{t('goals.widget.dueSoon', { count: summary.dueSoon })}</span></>}
              {' · '}<span className="text-green-400">{t('goals.widget.achieved', { count: summary.achieved })}</span>
            </p>
            {current.length > 1 && (
              <div className="rd-goals-widget-nav flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => go(-1)} disabled={safeIndex === 0} className={ARROW_CLASS} aria-label={t('goals.widget.previous')}>
                  <ChevronLeft size={15} />
                </button>
                <span className="w-9 text-center text-[11px] text-muted-foreground" aria-live="polite">
                  {safeIndex + 1}/{current.length}
                </span>
                <button type="button" onClick={() => go(1)} disabled={safeIndex === current.length - 1} className={ARROW_CLASS} aria-label={t('goals.widget.next')}>
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
