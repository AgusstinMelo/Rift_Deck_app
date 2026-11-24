import { useState } from 'react';
import { Flag, Loader2, Send } from 'lucide-react';
import { createBugReport } from '@/api/bugReportsSupabase';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/LocaleContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Reportar contenido desde la app: respuestas de la IA (política de contenido generado por IA
// de Google Play) y contenido de otros usuarios, como builds y perfiles públicos (política de
// contenido generado por usuarios). Se guarda en bug_reports con lo reportado, para revisarlo.
//
// Los valores que se guardan (página, descripción) van en español, como el resto de bug_reports.
const TYPES = {
  ai: {
    page: 'Sugeridor',
    label: 'aiReport.reportar',
    title: 'aiReport.titulo',
    description: 'aiReport.descripcion',
    reasons: ['ofensivo', 'incorrecto', 'otro'],
    reasonKey: reason => `aiReport.motivos.${reason}`,
    prefix: feature => `[Reporte de IA · ${feature}]`,
  },
  build: {
    page: 'Builds',
    label: 'contentReport.reportar',
    title: 'contentReport.tituloBuild',
    description: 'contentReport.descripcion',
    reasons: ['ofensivo', 'spam', 'otro'],
    reasonKey: reason => `contentReport.motivos.${reason}`,
    prefix: () => '[Reporte de build pública]',
  },
  profile: {
    page: 'Otro',
    label: 'contentReport.reportar',
    title: 'contentReport.tituloPerfil',
    description: 'contentReport.descripcion',
    reasons: ['ofensivo', 'spam', 'otro'],
    reasonKey: reason => `contentReport.motivos.${reason}`,
    prefix: () => '[Reporte de perfil público]',
  },
};

// Tope de lo reportado que se guarda con el reporte (alcanza para cualquier sugerencia).
const MAX_CONTENT_CHARS = 20000;

export default function ReportContent({ type = 'ai', feature = '', content, className = '' }) {
  const t = useT();
  const { user } = useAuth();
  const config = TYPES[type];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(config.reasons[0]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('idle');

  const handleOpenChange = next => {
    setOpen(next);
    if (!next && status !== 'sending') {
      setStatus('idle');
      setComment('');
      setReason(config.reasons[0]);
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setStatus('sending');
    try {
      await createBugReport(user, {
        page: config.page,
        description: `${config.prefix(feature)} ${reason}${comment.trim() ? `: ${comment.trim()}` : ''}`,
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
        onClick={event => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-red-400 ${className}`}
      >
        <Flag size={12} />
        {t(config.label)}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="font-rajdhani text-xl uppercase">{t(config.title)}</DialogTitle>
            <DialogDescription>{t(config.description)}</DialogDescription>
          </DialogHeader>

          {status === 'sent' ? (
            <p className="rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-3 text-sm text-green-300">
              {t('aiReport.enviado')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-xs text-muted-foreground">{t('aiReport.motivo')}</legend>
                {config.reasons.map(value => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name={`report-reason-${type}`}
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    {t(config.reasonKey(value))}
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
