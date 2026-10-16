import { CalendarClock, Hourglass, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { summarizeCurrent } from '../model/goalLists';

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
 * Resumen de los objetivos activos.
 * @param {{ current: import('../model/goalLists').GoalItem[] }} props
 */
export default function GoalsSummary({ current }) {
  const summary = summarizeCurrent(current);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryStat label="Activos" value={summary.total} icon={Target} tone="text-primary" />
      <SummaryStat label="Por vencer" value={summary.dueSoon} icon={Hourglass} tone="text-amber-300" />
      <SummaryStat label="Hoy cumplirían" value={summary.onTrack} icon={TrendingUp} tone="text-green-400" />
      <SummaryStat label="Hoy no cumplirían" value={summary.atRisk} icon={TrendingDown} tone="text-red-400" />
      <div className="col-span-2 lg:col-span-1">
        <SummaryStat label="Programados" value={summary.scheduled} icon={CalendarClock} tone="text-sky-300" />
      </div>
    </div>
  );
}
