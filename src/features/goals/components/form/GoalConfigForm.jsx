import { Lock } from 'lucide-react';
import { AGGREGATION_LABELS, STATS, aggregationsFor, findMetric, getMetric, listStats } from '../../metrics/index';
import { AGGREGATION, GOAL_LIMITS, METRIC_KIND } from '../../model/goalConstants';
import { OPERATOR_LABELS, operatorPhrase, unitOf } from '../../texts';
import { INPUT_CLASS } from '../goalUi';
import Field from './Field';
import GoalFiltersFields from './GoalFiltersFields';

/** Cambiar de métrica en la creación: valores por defecto y solo filtros compatibles. */
export function draftForMetric(draft, metricId) {
  const metric = getMetric(metricId);
  const filters = Object.fromEntries(
    Object.entries(draft.filters || {}).filter(([key]) => metric.allowedFilters.includes(key)),
  );
  return {
    ...draft,
    metric: metricId,
    operator: metric.operator,
    target: metric.target.default,
    minSample: metric.defaultMinSample,
    unit: metric.source === 'checkins' ? draft.unit : '',
    filters,
  };
}

/**
 * Paso de configuración de un objetivo (creación y edición).
 * @param {{
 *   value: any, onChange: (value: any) => void, errors: Record<string, string>,
 *   mode: 'create' | 'edit', canEditConfig?: boolean, championOptions: any[],
 * }} props
 */
export default function GoalConfigForm({ value, onChange, errors, mode, canEditConfig = true, championOptions }) {
  const metric = getMetric(value.metric);
  const set = (key, fieldValue) => onChange({ ...value, [key]: fieldValue });
  const configLocked = mode === 'edit' && !canEditConfig;
  const unit = unitOf({ metric: value.metric, unit: value.unit });

  const applyMetric = next => {
    if (next && next.id !== value.metric) onChange(draftForMetric(value, next.id));
  };
  // Cambiar el dato conserva el cálculo si aplica; si no, usa el primero disponible para ese dato.
  const changeStat = stat => applyMetric(findMetric(stat, metric.aggregation) || findMetric(stat, aggregationsFor(stat)[0]));
  // Cambiar el cálculo conserva el dato si aplica; si no, pasa al primer dato que admite ese cálculo.
  const changeAggregation = aggregation => applyMetric(
    findMetric(metric.stat, aggregation)
      || findMetric(listStats().find(stat => aggregationsFor(stat).includes(aggregation)), aggregation),
  );

  const statLabel = STATS[metric.stat]?.label || metric.stat;
  const availableCalculations = aggregationsFor(metric.stat).map(aggregation => AGGREGATION_LABELS[aggregation]).join(', ');
  const targetLabel = `Valor (${operatorPhrase({ metric: value.metric, operator: value.operator })}${unit ? ` · ${unit}` : ''})`;
  const rangeHint = `Entre ${metric.target.min} y ${metric.target.max}`;

  const lockNotice = configLocked && (
    <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
      <Lock size={14} className="mt-0.5 shrink-0" />
      El período ya cerró o el objetivo no está activo: solo podés editar el nombre y la descripción.
    </p>
  );

  return (
    <div className="rd-goal-form grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Panel izquierdo: qué se quiere lograr y cuándo. Filas compactas para entrar sin scroll. */}
      <section className="rd-goal-form-pane space-y-3" aria-label="Objetivo">
        <p className="rd-section-kicker">Objetivo</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="goal-name" error={errors.name}>
            <input
              id="goal-name"
              value={value.name}
              maxLength={GOAL_LIMITS.NAME_MAX}
              onChange={event => set('name', event.target.value)}
              placeholder="Por ejemplo: Morir menos en Mid"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Descripción (opcional)" htmlFor="goal-description" error={errors.description}>
            <input
              id="goal-description"
              value={value.description || ''}
              maxLength={GOAL_LIMITS.DESCRIPTION_MAX}
              onChange={event => set('description', event.target.value)}
              placeholder="¿Por qué te importa?"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dato" htmlFor="goal-stat" error={errors.metric}>
              <select
                id="goal-stat"
                value={metric.stat}
                disabled={mode === 'edit'}
                onChange={event => changeStat(event.target.value)}
                className={INPUT_CLASS}
              >
                {listStats().map(stat => <option key={stat} value={stat}>{STATS[stat]?.label || stat}</option>)}
              </select>
            </Field>
            <Field label="Cálculo" htmlFor="goal-aggregation">
              <select
                id="goal-aggregation"
                value={metric.aggregation}
                disabled={mode === 'edit'}
                onChange={event => changeAggregation(event.target.value)}
                title={`Cálculos para ${statLabel}: ${availableCalculations}`}
                className={INPUT_CLASS}
              >
                {/* Todos los cálculos se pueden elegir; si el dato actual no lo admite, se cambia de dato. */}
                {Object.values(AGGREGATION).map(aggregation => (
                  <option key={aggregation} value={aggregation}>{AGGREGATION_LABELS[aggregation]}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
            {mode === 'edit'
              ? 'El dato y el cálculo no se pueden cambiar. Para medir otra cosa, creá un objetivo nuevo.'
              : <><span className="font-semibold text-foreground/80">{metric.label}:</span> {metric.description}</>}
          </p>
        </div>

        {lockNotice}

        <fieldset disabled={configLocked} className="space-y-3 disabled:opacity-60">
          <div className="grid gap-3 sm:grid-cols-3">
            {metric.source === 'checkins' && (
              <Field label="Unidad" htmlFor="goal-unit" error={errors.unit}>
                <input
                  id="goal-unit"
                  value={value.unit || ''}
                  maxLength={GOAL_LIMITS.UNIT_MAX}
                  onChange={event => set('unit', event.target.value)}
                  placeholder="horas de práctica"
                  className={INPUT_CLASS}
                />
              </Field>
            )}

            {metric.operators.length > 1 && (
              <Field label="Meta" htmlFor="goal-operator" error={errors.operator}>
                <select
                  id="goal-operator"
                  value={value.operator || metric.operator}
                  onChange={event => set('operator', event.target.value)}
                  className={INPUT_CLASS}
                >
                  {metric.operators.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
                </select>
              </Field>
            )}

            <Field label={targetLabel} htmlFor="goal-target" error={errors.target}>
              <input
                id="goal-target"
                type="number"
                inputMode="decimal"
                min={metric.target.min}
                max={metric.target.max}
                step={metric.target.step}
                value={value.target ?? ''}
                onChange={event => set('target', event.target.value)}
                title={rangeHint}
                className={INPUT_CLASS}
              />
            </Field>

            {metric.kind === METRIC_KIND.PERFORMANCE && (
              <Field label="Muestra mínima" htmlFor="goal-min-sample" error={errors.minSample}>
                <input
                  id="goal-min-sample"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GOAL_LIMITS.MIN_SAMPLE_MAX}
                  step={1}
                  value={value.minSample ?? ''}
                  onChange={event => set('minSample', event.target.value)}
                  title="Partidas válidas necesarias para que el resultado sea concluyente"
                  className={INPUT_CLASS}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha inicial" htmlFor="goal-start" error={errors.startDate}>
              <input id="goal-start" type="date" value={value.startDate} onChange={event => set('startDate', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Fecha final (incluida)" htmlFor="goal-end" error={errors.endDate || errors.timezone}>
              <input id="goal-end" type="date" value={value.endDate} onChange={event => set('endDate', event.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Valor: {rangeHint.toLowerCase()} · Zona horaria: {value.timezone}
          </p>
        </fieldset>
      </section>

      {/* Panel derecho: qué partidas cuentan. */}
      <section className="rd-goal-form-pane rd-goal-form-filters" aria-label="Filtros">
        {metric.allowedFilters.length > 0 ? (
          <fieldset disabled={configLocked} className="disabled:opacity-60">
            <GoalFiltersFields
              metricId={value.metric}
              filters={value.filters || {}}
              onChange={filters => set('filters', filters)}
              errors={errors}
              championOptions={championOptions}
              disabled={configLocked}
            />
          </fieldset>
        ) : (
          <div className="space-y-2">
            <p className="rd-section-kicker">Filtros</p>
            <p className="text-sm text-muted-foreground">
              Los objetivos manuales no usan partidas: el progreso se suma con los check-ins que registres desde el detalle del objetivo.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
