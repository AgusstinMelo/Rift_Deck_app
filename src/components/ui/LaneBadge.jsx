import { tr } from '@/i18n/uiI18n';

const LANE_CONFIG = {
  top: { get label() { return tr('lanes.top'); }, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', border: 'border-orange-500/80' },
  jungler: { get label() { return tr('lanes.jungler'); }, color: 'bg-green-500/20 text-green-400 border-green-500/30', border: 'border-green-500/80' },
  mid: { get label() { return tr('lanes.mid'); }, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', border: 'border-purple-500/80' },
  adc: { get label() { return tr('lanes.adc'); }, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', border: 'border-cyan-500/80' },
  support: { get label() { return tr('lanes.support'); }, color: 'bg-rose-500/20 text-rose-400 border-rose-500/30', border: 'border-rose-500/80' },
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