import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evolutionSeries } from '../engine/evolution';
import { formatDate, formatMetricValue } from '../texts';

/**
 * Evolución del valor de un objetivo de rendimiento a lo largo del período.
 * @param {{ goal: any, evaluation: import('../model/goalConstants').GoalEvaluation }} props
 */
export default function GoalEvolutionChart({ goal, evaluation }) {
  const data = useMemo(
    () => evolutionSeries(goal.metric, evaluation.contributions).map(point => ({ ...point, label: formatDate(point.date).slice(0, 5) })),
    [goal.metric, evaluation.contributions],
  );

  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">La evolución se muestra cuando hay datos en al menos dos días distintos.</p>;
  }

  return (
    <div className="h-56 w-full" aria-label="Evolución del objetivo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(value, _name, entry) => [formatMetricValue(goal, Number(value)), `Muestra: ${entry.payload.sample}`]}
          />
          <ReferenceLine y={evaluation.target} stroke="rgba(212,175,55,0.7)" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'rgba(212,175,55,0.9)', fontSize: 11, position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
