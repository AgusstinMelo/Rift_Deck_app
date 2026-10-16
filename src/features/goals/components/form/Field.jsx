/**
 * Etiqueta, ayuda y error de un campo de formulario.
 * @param {{ label: string, htmlFor?: string, hint?: string, error?: string, children: any }} props
 */
export default function Field({ label, htmlFor = undefined, hint = '', error = '', children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-red-400" role="alert">{error}</p>}
    </div>
  );
}
