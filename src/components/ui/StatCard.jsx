export default function StatCard({ label, value, sub, icon: Icon, trend, color = 'primary' }) {
  const colorMap = {
    primary: 'text-primary',
    accent: 'text-accent',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 card-gradient-border">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} className={colorMap[color]} />}
      </div>
      <div className={`text-2xl font-bold font-rajdhani ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-xs font-medium ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}