import { CalendarClock, CheckCircle2, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { summarizeCurrent } from '../model/goalLists';

function SummaryStat({ label, value, icon: Icon, tone }) {
  return (
    <div className="rd-card rd-card-watermark flex items-center justify-between gap-3 p-4">
      <div>
        <p className="rd-label">{label}</p>
        <p className={`font-rajdhani text-3xl font-bold tracking-[-0.08em] ${tone}`}>{value}</p>
      </div>
      <Icon size={20} className={tone} />
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
      <SummaryStat label="Alcanzados" value={summary.achieved} icon={CheckCircle2} tone="text-green-400" />
      <SummaryStat label="Hoy cumplirían" value={summary.onTrack} icon={TrendingUp} tone="text-green-400" />
      <SummaryStat label="Hoy no cumplirían" value={summary.atRisk} icon={TrendingDown} tone="text-red-400" />
      <div className="col-span-2 lg:col-span-1">
        <SummaryStat label="Programados" value={summary.scheduled} icon={CalendarClock} tone="text-sky-300" />
      </div>
    </div>
  );
}
