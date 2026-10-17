import { MATCH_TYPES } from '@/constants/matchTypes';
import { getMetric } from '../../metrics/index';
import { LANES } from '../../model/goalConstants';
import { LANE_LABELS } from '../../texts';
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from '../goalUi';
import ChampionMultiSelect from './ChampionMultiSelect';
import Field from './Field';

function ChipGroup({ options, value = [], onChange, disabled }) {
  const toggle = optionValue => onChange(
    value.includes(optionValue) ? value.filter(item => item !== optionValue) : [...value, optionValue],
  );
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={`${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF} disabled:opacity-50`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Solo muestra los filtros que admite la métrica elegida.
 * @param {{ metricId: string, filters: Record<string, any>, onChange: (filters: Record<string, any>) => void,
 *   errors: Record<string, string>, championOptions: any[], disabled?: boolean }} props
 */
export default function GoalFiltersFields({ metricId, filters, onChange, errors, championOptions, disabled = false }) {
  const metric = getMetric(metricId);
  if (metric.allowedFilters.length === 0) return null;

  const set = (key, value) => onChange({ ...filters, [key]: value });
  const allowed = key => metric.allowedFilters.includes(key);
  const errorFor = key => Object.entries(errors).find(([path]) => path === `filters.${key}` || path.startsWith(`filters.${key}.`))?.[1];
  const championsAreTarget = metric.consumedFilters.includes('champions');

  return (
    <div className="space-y-3">
      <div>
        <p className="rd-section-kicker">Filtros</p>
        <p className="text-xs text-muted-foreground">Sin filtros cuentan todas tus partidas del período.</p>
      </div>

      {allowed('champions') && (
        <Field
          label={championsAreTarget ? 'Campeones objetivo (obligatorio)' : 'Campeones'}
          hint={championsAreTarget ? 'Las partidas con estos campeones forman el porcentaje.' : 'Solo cuentan partidas con estos campeones.'}
          error={errorFor('champions')}
        >
          <ChampionMultiSelect
            options={championOptions}
            value={filters.champions || []}
            onChange={value => set('champions', value)}
            disabled={disabled}
          />
        </Field>
      )}

      {allowed('types') && (
        <Field label="Tipo de partida" error={errorFor('types')}>
          <ChipGroup options={MATCH_TYPES} value={filters.types} onChange={value => set('types', value)} disabled={disabled} />
        </Field>
      )}

      {allowed('lanes') && (
        <Field label="Línea" error={errorFor('lanes')}>
          <ChipGroup
            options={LANES.map(lane => ({ value: lane, label: LANE_LABELS[lane] }))}
            value={filters.lanes}
            onChange={value => set('lanes', value)}
            disabled={disabled}
          />
        </Field>
      )}
    </div>
  );
}
