import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY } from './goalUi';
import { useT } from '@/lib/LocaleContext';

/**
 * Modal de confirmación con el mismo estilo que los de Partidas.
 * @param {{ open: boolean, title: string, description: string, confirmLabel: string, tone?: 'danger' | 'primary',
 *   pending?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmDialog({ open, title, description, confirmLabel, tone = 'primary', pending = false, onConfirm, onCancel }) {
  const t = useT();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rd-card rd-modal-panel mx-4 w-full max-w-sm space-y-4 overflow-y-auto p-5">
        <div>
          <p className="font-rajdhani text-lg font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={`${BUTTON_SECONDARY} flex-1`}>{t('common.back')}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`${tone === 'danger' ? BUTTON_DANGER : BUTTON_PRIMARY} flex-1`}
          >
            {pending ? t('common.saving') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
