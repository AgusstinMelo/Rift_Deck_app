import { buildPatchOptions } from '@/utils/patches';
import { useT } from '@/lib/LocaleContext';

export default function PatchFilter({ value, onChange, patches = [], label, className = '' }) {
  const t = useT();
  label ??= t('patches.filtrarPorParche');
  const options = buildPatchOptions(patches);

  return (
    <label className={`min-w-56 text-xs text-muted-foreground ${className}`}>
      {label}
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
      >
        <option value="">{t('patches.todosLosParches')}</option>
        {options.map(option => (
          <option key={`${option.depth}-${option.value}`} value={option.value}>
            {t('patches.parche', { indent: '\u00a0\u00a0'.repeat(option.depth), label: option.label })}
          </option>
        ))}
      </select>
    </label>
  );
}
