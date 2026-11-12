/** Encabezado de página estándar: volanta amarilla (kicker), título, bajada y acción. */
export default function PageHeader({ kicker, title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        {kicker && (
          <div className="rd-page-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">{kicker}</span>
          </div>
        )}
        <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{title}</h1>
        {subtitle && <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
