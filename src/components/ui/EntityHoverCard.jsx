import { cloneElement, useState } from 'react';
import { createPortal } from 'react-dom';

const uniqueText = (...values) => [...new Set(
  values
    .map(value => String(value || '').replace(/\\n/g, '\n').trim())
    .filter(Boolean),
)];

export default function EntityHoverCard({ entity, kind, children }) {
  const [position, setPosition] = useState(null);

  const show = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const wouldOverflowRight = rect.left + width > window.innerWidth - 12;
    const left = wouldOverflowRight
      ? Math.max(12, rect.right - width)
      : Math.max(12, rect.left);
    const placeBelow = rect.top < Math.min(300, window.innerHeight / 2);

    setPosition(placeBelow
      ? { top: rect.bottom + 8, left, width }
      : { bottom: window.innerHeight - rect.top + 8, left, width });
  };

  const descriptions = uniqueText(entity?.description, entity?.effect, entity?.passive);
  const trigger = cloneElement(children, {
    onMouseEnter: event => {
      children.props.onMouseEnter?.(event);
      show(event);
    },
    onMouseLeave: event => {
      children.props.onMouseLeave?.(event);
      setPosition(null);
    },
    'aria-label': children.props['aria-label'] || entity?.name,
  });

  return (
    <>
      {trigger}
      {position && typeof document !== 'undefined' && createPortal(
        <div className="fixed z-[100] pointer-events-none" style={position}>
          <div className="w-full rounded-xl border border-primary/25 bg-popover p-3 shadow-2xl">
            <div className="flex items-start gap-3">
              {entity?.image_url && (
                <img src={entity.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border bg-secondary/30 object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-foreground">{entity?.name}</p>
                <p className="mt-1 text-[11px] text-primary">{kind || entity?.branch || entity?.category}</p>
              </div>
            </div>
            {descriptions.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-border/70 pt-2.5">
                {descriptions.map(text => (
                  <p key={text} className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{text}</p>
                ))}
              </div>
            ) : (
              <p className="mt-3 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">Sin descripción disponible.</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
