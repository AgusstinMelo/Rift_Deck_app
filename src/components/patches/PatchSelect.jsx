export default function PatchSelect({ value, onChange, patches, className = '' }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className={`w-full rounded-xl border border-border bg-secondary/70 px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-primary/40 ${className}`}
    >
      <option value={''} disabled>Seleccionar parche</option>
      {patches.map(patch => (
        <option key={patch.id} value={patch.version}>
          {patch.version}{patch.status === 'active' ? ' (actual)' : ''}
        </option>
      ))}
    </select>
  );
}
