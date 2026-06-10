const LANE_CONFIG = {
  top: { label: 'Top', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  jungler: { label: 'Jungla', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mid: { label: 'Mid', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  adc: { label: 'ADC', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  support: { label: 'Support', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
};

export default function LaneBadge({ lane, size = 'sm' }) {
  const config = LANE_CONFIG[lane] || { label: lane, color: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-medium text-xs ${config.color}`}>
      {config.label}
    </span>
  );
}

export { LANE_CONFIG };