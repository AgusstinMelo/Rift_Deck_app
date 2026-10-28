import { CalendarClock, CheckCircle2, Hourglass, Percent, Target } from 'lucide-react';
import { summarizeCurrent } from '../model/goalLists';
import { useT } from '@/lib/LocaleContext';

function SummaryStat({ label, value, icon: Icon, tone }) {
  return (
    <div className="rd-card flex items-center gap-3 px-4 py-2.5">
      <Icon size={18} className={`shrink-0 ${tone}`} />
      <p className="rd-label min-w-0 flex-1 truncate">{label}</p>
      <p className={`font-rajdhani text-2xl font-bold leading-none tracking-[-0.06em] ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * Resumen: activos, programados y por vencer (presente); alcanzados y tasa de logro (historial).
 * @param {{ current: import('../model/goalLists').GoalItem[], all: import('../model/goalLists').GoalItem[] }} props
 */
export default function GoalsSummary({ current, all }) {
  const t = useT();
  const summary = summarizeCurrent(current, all);
  return (
    <div className="rd-goals-summary grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryStat label={t('goals.summary.active')} value={summary.total} icon={Target} tone="text-primary" />
      <SummaryStat label={t('goals.summary.scheduled')} value={summary.scheduled} icon={CalendarClock} tone="text-sky-300" />
      <SummaryStat label={t('goals.summary.dueSoon')} value={summary.dueSoon} icon={Hourglass} tone="text-amber-300" />
      <SummaryStat label={t('goals.summary.achieved')} value={summary.achieved} icon={CheckCircle2} tone="text-green-400" />
      <div className="col-span-2 lg:col-span-1">
        <SummaryStat
          label={t('goals.summary.successRate')}
          value={summary.successRate === null ? '—' : `${Math.round(summary.successRate)}%`}
          icon={Percent}
          tone="text-foreground"
        />
      </div>
    </div>
  );
}
