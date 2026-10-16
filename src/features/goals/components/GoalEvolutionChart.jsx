import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evolutionSeries } from '../engine/evolution';
import { formatDate, formatMetricValue } from '../texts';

/**
 * Evolución del valor de un objetivo a lo largo del período.
 * En modo compacto (tarjetas) no hay tooltip y ocupa el alto del contenedor.
 * @param {{ goal: any, evaluation: import('../model/goalConstants').GoalEvaluation, compact?: boolean, className?: string }} props
 */
export default function GoalEvolutionChart({ goal, evaluation, compact = false, className = 'h-56' }) {
  const data = useMemo(
    () => evolutionSeries(goal.metric, evaluation.contributions).map(point => ({ ...point, label: formatDate(point.date).slice(0, 5) })),
    [goal.metric, evaluation.contributions],
  );

  if (data.length < 2) {
    return (
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        La evolución se muestra cuando hay datos en al menos dos días distintos.
      </p>
    );
  }

  const tick = { fill: 'hsl(var(--muted-foreground))', fontSize: compact ? 10 : 11 };

  return (
    <div className={`w-full ${className}`} aria-label="Evolución del objetivo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: compact ? -24 : -12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
          {!compact && (
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              formatter={(value, _name, entry) => [formatMetricValue(goal, Number(value)), `Muestra: ${entry.payload.sample}`]}
            />
          )}
          <ReferenceLine y={evaluation.target} stroke="rgba(212,175,55,0.7)" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'rgba(212,175,55,0.9)', fontSize: compact ? 10 : 11, position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={compact ? false : { r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
