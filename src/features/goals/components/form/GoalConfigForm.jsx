import { Lock } from 'lucide-react';
import { getMetric, listMetrics } from '../../metrics/index';
import { GOAL_LIMITS, METRIC_FAMILY, METRIC_KIND } from '../../model/goalConstants';
import { FAMILY_LABELS, OPERATOR_LABELS, operatorPhrase, unitOf } from '../../texts';
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
 *   mode: 'create' | 'edit', canEditConfig?: boolean,
 *   championOptions: any[], patchOptions: { value: string, label: string }[],
 * }} props
 */
export default function GoalConfigForm({ value, onChange, errors, mode, canEditConfig = true, championOptions, patchOptions }) {
  const metric = getMetric(value.metric);
  const set = (key, fieldValue) => onChange({ ...value, [key]: fieldValue });
  const configLocked = mode === 'edit' && !canEditConfig;
  const unit = unitOf({ metric: value.metric, unit: value.unit });

  const lockNotice = configLocked && (
    <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
      <Lock size={14} className="mt-0.5 shrink-0" />
      El período ya cerró o el objetivo no está activo: solo podés editar el nombre y la descripción.
    </p>
  );

  return (
    <div className="rd-goal-form grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Panel izquierdo: qué se quiere lograr y cuándo. */}
      <section className="rd-goal-form-pane space-y-4" aria-label="Objetivo">
        <p className="rd-section-kicker">Objetivo</p>
        <div className="grid gap-4 md:grid-cols-2">
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

          <Field
            label="Métrica"
            htmlFor="goal-metric"
            hint={mode === 'edit' ? 'La métrica no se puede cambiar. Para medir otra cosa, creá un objetivo nuevo.' : metric.description}
            error={errors.metric}
          >
            <select
              id="goal-metric"
              value={value.metric}
              disabled={mode === 'edit'}
              onChange={event => onChange(draftForMetric(value, event.target.value))}
              className={INPUT_CLASS}
            >
              {Object.values(METRIC_FAMILY).map(family => (
                <optgroup key={family} label={FAMILY_LABELS[family]}>
                  {listMetrics().filter(option => option.family === family).map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>

        {lockNotice}

        <fieldset disabled={configLocked} className="space-y-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metric.source === 'checkins' && (
              <Field label="Unidad" htmlFor="goal-unit" hint='Por ejemplo, "horas de replay".' error={errors.unit}>
                <input
                  id="goal-unit"
                  value={value.unit || ''}
                  maxLength={GOAL_LIMITS.UNIT_MAX}
                  onChange={event => set('unit', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            )}

            {metric.operators.length > 1 && (
              <Field label="Meta" htmlFor="goal-operator" hint="Por encima o por debajo del valor." error={errors.operator}>
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

            <Field
              label={`Valor (${operatorPhrase({ metric: value.metric, operator: value.operator })}${unit ? ` · ${unit}` : ''})`}
              htmlFor="goal-target"
              hint={`Entre ${metric.target.min} y ${metric.target.max}.`}
              error={errors.target}
            >
              <input
                id="goal-target"
                type="number"
                inputMode="decimal"
                min={metric.target.min}
                max={metric.target.max}
                step={metric.target.step}
                value={value.target ?? ''}
                onChange={event => set('target', event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            {metric.kind === METRIC_KIND.PERFORMANCE && (
              <Field
                label="Muestra mínima"
                htmlFor="goal-min-sample"
                hint="Partidas para que sea concluyente."
                error={errors.minSample}
              >
                <input
                  id="goal-min-sample"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GOAL_LIMITS.MIN_SAMPLE_MAX}
                  step={1}
                  value={value.minSample ?? ''}
                  onChange={event => set('minSample', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha inicial" htmlFor="goal-start" error={errors.startDate}>
              <input id="goal-start" type="date" value={value.startDate} onChange={event => set('startDate', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Fecha final (incluida)" htmlFor="goal-end" hint={`Zona horaria: ${value.timezone}`} error={errors.endDate || errors.timezone}>
              <input id="goal-end" type="date" value={value.endDate} onChange={event => set('endDate', event.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
        </fieldset>

        <Field label="Descripción (opcional)" htmlFor="goal-description" error={errors.description}>
          <textarea
            id="goal-description"
            value={value.description || ''}
            maxLength={GOAL_LIMITS.DESCRIPTION_MAX}
            rows={2}
            onChange={event => set('description', event.target.value)}
            placeholder="¿Por qué te importa este objetivo?"
            className={`${INPUT_CLASS} resize-none`}
          />
        </Field>
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
              patchOptions={patchOptions}
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
