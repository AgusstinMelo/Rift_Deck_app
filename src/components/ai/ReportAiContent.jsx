import { useState } from 'react';
import { Flag, Loader2, Send } from 'lucide-react';
import { createBugReport } from '@/api/bugReportsSupabase';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/LocaleContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Reporte de una respuesta generada con IA (lo pide la política de contenido generado por IA
// de Google Play). Se guarda en bug_reports con la respuesta completa para poder revisarla.
const REASONS = ['ofensivo', 'incorrecto', 'otro'];

// Tope de la respuesta que se guarda con el reporte (alcanza para cualquier sugerencia).
const MAX_CONTENT_CHARS = 20000;

export default function ReportAiContent({ feature, content, className = '' }) {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('ofensivo');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('idle');

  const handleOpenChange = next => {
    setOpen(next);
    if (!next && status !== 'sending') {
      setStatus('idle');
      setComment('');
      setReason('ofensivo');
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setStatus('sending');
    try {
      await createBugReport(user, {
        // Valores guardados en español, como el resto de bug_reports.
        page: 'Sugeridor',
        description: `[Reporte de IA · ${feature}] ${reason}${comment.trim() ? `: ${comment.trim()}` : ''}`,
        severity: reason === 'ofensivo' ? 'alta' : 'media',
        additional_notes: JSON.stringify(content ?? null).slice(0, MAX_CONTENT_CHARS),
        browser: navigator.userAgent,
        status: 'pendiente',
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-red-400 ${className}`}
      >
        <Flag size={12} />
        {t('aiReport.reportar')}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="font-rajdhani text-xl uppercase">{t('aiReport.titulo')}</DialogTitle>
            <DialogDescription>{t('aiReport.descripcion')}</DialogDescription>
          </DialogHeader>

          {status === 'sent' ? (
            <p className="rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-3 text-sm text-green-300">
              {t('aiReport.enviado')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-xs text-muted-foreground">{t('aiReport.motivo')}</legend>
                {REASONS.map(value => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="ai-report-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    {t(`aiReport.motivos.${value}`)}
                  </label>
                ))}
              </fieldset>

              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t('aiReport.comentario')}
                className="w-full resize-none rounded-xl border border-border bg-secondary/70 px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-primary/40"
              />

              {status === 'error' && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {t('aiReport.error')}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('aiReport.enviar')}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
