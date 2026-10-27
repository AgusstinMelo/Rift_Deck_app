export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{title}</h1>
        {subtitle && <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
