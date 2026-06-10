export default function TierBadge({ tier, size = 'md' }) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-12 h-12 text-lg' };
  const classes = {
    'S+': 'tier-splus',
    'S': 'tier-s',
    'A': 'tier-a',
    'B': 'tier-b',
    'C': 'tier-c',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded font-rajdhani font-bold text-white ${sizes[size]} ${classes[tier] || 'bg-muted text-muted-foreground'}`}>
      {tier}
    </span>
  );
}