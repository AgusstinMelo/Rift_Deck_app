export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon size={28} className="text-muted-foreground" />
        </div>
      )}
      <h3 className="font-rajdhani font-bold text-lg text-foreground mb-1">{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}