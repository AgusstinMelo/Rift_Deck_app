import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evolutionSeries } from '../engine/evolution';
import { getMetric } from '../metrics/index';
import { formatDate, formatMetricValue } from '../texts';
import { useT } from '@/lib/LocaleContext';

/**
 * Evolución del valor de un objetivo a lo largo del período.
 * En modo compacto (tarjetas) no hay tooltip y ocupa el alto del contenedor.
 * @param {{ goal: any, evaluation: import('../model/goalConstants').GoalEvaluation, compact?: boolean, className?: string }} props
 */
export default function GoalEvolutionChart({ goal, evaluation, compact = false, className = 'h-56' }) {
  const t = useT();
  const data = useMemo(
    () => evolutionSeries(goal.metric, evaluation.contributions).map(point => ({ ...point, label: formatDate(point.date).slice(0, 5) })),
    [goal.metric, evaluation.contributions],
  );

  if (data.length < 2) {
    return (
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        {t('goals.evolutionEmptyLong')}
      </p>
    );
  }

  const tick = { fill: 'hsl(var(--muted-foreground))', fontSize: compact ? 10 : 11 };
  const metric = getMetric(goal.metric);
  // Porcentajes siempre entre 0 y 100; conteos (partidas) solo en enteros; el resto desde 0.
  const isPercent = metric.unit === '%';
  /** @type {import('recharts').YAxisProps['domain']} */
  const yDomain = isPercent ? [0, 100] : [0, 'auto'];
  const allowDecimals = !metric.target.integer;
  // Ancho del eje según la etiqueta más larga posible (valores, meta y "100%"), para que nunca se corte.
  const fontSize = compact ? 10 : 11;
  const longestLabel = isPercent ? '100%' : String(Math.ceil(Math.max(evaluation.target, ...data.map(point => point.value ?? 0))));
  // Margen extra: el eje puede redondear hacia arriba (95 → 100) y los decimales suman ".5".
  const extraChars = isPercent ? 0 : allowDecimals ? 2 : 1;
  const yAxisWidth = Math.ceil((longestLabel.length + extraChars) * fontSize * 0.62) + 10;

  return (
    <div className={`w-full ${className}`} aria-label={t('goals.evolutionAria')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={yAxisWidth}
            ticks={isPercent ? [0, 25, 50, 75, 100] : undefined}
            domain={yDomain}
            allowDecimals={allowDecimals}
            allowDataOverflow={isPercent}
            tickFormatter={value => (isPercent ? `${value}%` : String(value))}
          />
          {!compact && (
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              formatter={(value, _name, entry) => [formatMetricValue(goal, Number(value)), t('goals.sampleValue', { sample: entry.payload.sample })]}
            />
          )}
          <ReferenceLine y={evaluation.target} ifOverflow="extendDomain" stroke="rgba(212,175,55,0.7)" strokeDasharray="4 4" label={{ value: t('goals.target'), fill: 'rgba(212,175,55,0.9)', fontSize: compact ? 10 : 11, position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={compact ? false : { r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
