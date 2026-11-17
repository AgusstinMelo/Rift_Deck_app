// Diálogo "Compartí tu semana": elige período y formato, muestra la tarjeta y la
// comparte (menú nativo del celular) o la descarga como PNG.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatLocale } from '@/i18n/uiI18n';
import { getPatchGroup } from '@/utils/patches';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/LocaleContext';
import ShareCard, { CARD_SIZES } from './ShareCard';
import { SHARE_PERIODS, summarizePeriod } from './periodSummary';
import { championArtId, loadChampionIds, splashUrl } from './championArt';

/** Título de la tarjeta según el winrate del período. */
const tierOf = winrate => (winrate >= 65 ? 'legend' : winrate >= 58 ? 'unstoppable' : winrate >= 52 ? 'onFire' : winrate >= 45 ? 'inForm' : 'comeback');

const PREVIEW_WIDTH = { story: 230, square: 300 };

const dateLabel = iso => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
};

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="rd-panel-tabs w-full" role="tablist" aria-label={label}>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`rd-panel-tab flex-1 ${value === id ? 'rd-panel-tab-active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, matches: any[], champions: any[], patch?: string }} props
 */
export default function ShareDialog({ open, onOpenChange, matches, champions, patch = '' }) {
  const t = useT();
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [period, setPeriod] = useState('week');
  // Tipos de partida incluidos: arranca como Estadísticas (Clasificatoria) para que los
  // números coincidan. Se pueden combinar; siempre queda al menos uno.
  const [matchTypes, setMatchTypes] = useState([DEFAULT_MATCH_TYPE]);
  const toggleMatchType = value => setMatchTypes(current => (
    current.includes(value)
      ? (current.length > 1 ? current.filter(type => type !== value) : current)
      : [...current, value]
  ));
  const [format, setFormat] = useState('story');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const summary = useMemo(
    () => (open ? summarizePeriod(matches, { period, patch, types: matchTypes, now: new Date() }) : null),
    [open, matches, period, patch, matchTypes],
  );
  const champion = summary?.topChampion
    ? champions.find(row => row.name === summary.topChampion.name)
    : null;

  // Arte del campeón, de mejor a peor: el splash guardado en la base (image_url_splash),
  // el de Data Dragon si todavía no se cargó y, por último, la imagen card del catálogo.
  const storedSplash = champion?.image_url_splash || null;
  const [artIds, setArtIds] = useState(null);
  useEffect(() => {
    if (!open || artIds || storedSplash) return undefined;
    let cancelled = false;
    loadChampionIds().then(ids => { if (!cancelled) setArtIds(ids); });
    return () => { cancelled = true; };
  }, [open, artIds, storedSplash]);
  const catalogArt = champion?.image_url_card || champion?.image_url;
  const artId = artIds ? championArtId(artIds, champion) : null;
  const championArt = storedSplash || (artId ? splashUrl(artId) : catalogArt);

  const periodText = !summary ? '' : period === 'patch'
    ? t('share.card.periodPatch', { patch: getPatchGroup(patch) || patch })
    : t(period === 'week' ? 'share.card.periodWeek' : 'share.card.periodMonth', { from: dateLabel(summary.from), to: dateLabel(summary.to) });

  const texts = summary ? {
    period: periodText,
    featured: t('share.card.featured'),
    featuredRecord: t(summary.topChampion?.games === 1 ? 'share.card.featuredRecordOne' : 'share.card.featuredRecord', {
      games: summary.topChampion?.games, winrate: summary.topChampion?.winrate,
    }),
    winrate: t('share.card.winrate'),
    winsShort: t('share.card.winsShort', { wins: summary.wins }),
    lossesShort: t('share.card.lossesShort', { losses: summary.losses }),
    tier: t(`share.card.tier.${tierOf(summary.winrate)}`),
    streakBadge: summary.winStreak >= 3 ? t('share.card.streakBadge', { count: summary.winStreak }) : '',
    games: t('share.card.games'),
    kda: t('share.card.kda'),
    streak: t('share.card.streak'),
    deaths: t('share.card.deaths'),
    kdaTotal: t('share.card.kdaTotal'),
    bestMatch: t('share.card.bestMatch'),
  } : null;

  const { width, height } = CARD_SIZES[format];
  const scale = PREVIEW_WIDTH[format] / width;

  /** PNG de la tarjeta a tamaño real. html-to-image se carga recién acá. */
  const renderPng = async () => {
    const { toBlob } = await import('html-to-image');
    const blob = await toBlob(cardRef.current, { width, height, pixelRatio: 1, cacheBust: true });
    if (!blob) throw new Error('empty image');
    return new File([blob], `rift-deck-${period}.png`, { type: 'image/png' });
  };

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const file = await renderPng();
      if (action === 'share' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rift Deck', text: t('share.shareText') });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (shareError) {
      // Cerrar el menú de compartir sin elegir nada no es un error.
      if (shareError?.name !== 'AbortError') setError(t('share.error'));
    } finally {
      setBusy(false);
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Sin rd-card: su position: relative le gana al fixed del diálogo y lo saca de lugar. */}
      <DialogContent onOpenAutoFocus={event => event.preventDefault()} className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-primary/20 bg-card p-5 sm:p-6">
        {/* Escritorio: vista previa a la izquierda, opciones y botones a la derecha.
            Celular: opciones, vista previa y botones, en ese orden. */}
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-6">
          {/* Vista previa escalada; la tarjeta mide su tamaño real adentro. */}
          <div className="order-2 flex justify-center md:order-none md:col-start-1 md:row-span-2 md:row-start-1">
            {summary ? (
              <div style={{ width: width * scale, height: height * scale }} className="overflow-hidden rounded-xl border border-primary/20 shadow-[0_0_24px_rgba(212,175,55,.08)]">
                <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <ShareCard
                    ref={cardRef}
                    summary={summary}
                    format={format}
                    championArt={championArt}
                    fallbackArt={catalogArt}
                    playerName={user?.visible_name || user?.full_name || ''}
                    texts={texts}
                    locale={formatLocale()}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{ width: PREVIEW_WIDTH[format], minHeight: 160 }}
                className="flex items-center justify-center rounded-xl border border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground"
              >
                {t('share.empty')}
              </div>
            )}
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-5 md:order-none md:col-start-2 md:row-start-1">
            <DialogHeader className="text-left">
              <DialogTitle className="font-rajdhani text-xl uppercase sm:text-2xl">{t('share.title')}</DialogTitle>
              <DialogDescription>{t('share.description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <p className="rd-label">{t('share.periodLabel')}</p>
              <Segmented
                label={t('share.periodLabel')}
                value={period}
                onChange={setPeriod}
                options={SHARE_PERIODS.filter(id => id !== 'patch' || patch).map(id => [id, t(`share.period.${id}`)])}
              />
            </div>

            <div className="space-y-2">
              <p className="rd-label">{t('share.typeLabel')}</p>
              {/* Misma barra que Período y Formato, pero cada tipo se prende y apaga por separado
                  (se pueden combinar; siempre queda al menos uno). */}
              <div className="rd-panel-tabs w-full" role="group" aria-label={t('share.typeLabel')}>
                {MATCH_TYPES.map(option => {
                  const active = matchTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleMatchType(option.value)}
                      className={`rd-panel-tab inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 ${active ? 'rd-panel-tab-active' : ''}`}
                    >
                      {active && <Check size={14} strokeWidth={3} className="shrink-0" />}
                      <span className="truncate">{t(`share.type.${option.value}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="rd-label">{t('share.formatLabel')}</p>
              <Segmented
                label={t('share.formatLabel')}
                value={format}
                onChange={setFormat}
                options={[['story', t('share.format.story')], ['square', t('share.format.square')]]}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          {/* En celular los botones quedan fijos al pie mientras se scrollea la vista previa. */}
          <div className="sticky -bottom-5 order-3 -mx-5 -mb-5 flex flex-col gap-2 border-t border-border/60 bg-card px-5 pb-5 pt-3 sm:flex-row md:static md:order-none md:col-start-2 md:row-start-2 md:m-0 md:border-0 md:bg-transparent md:p-0">
              {canNativeShare && (
                <button
                  type="button"
                  onClick={() => run('share')}
                  disabled={!summary || busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Share2 size={16} /> {busy ? t('share.generating') : t('share.share')}
                </button>
              )}
              <button
                type="button"
                onClick={() => run('download')}
                disabled={!summary || busy}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  canNativeShare ? 'border border-border text-foreground hover:border-primary/40' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <Download size={16} /> {busy && !canNativeShare ? t('share.generating') : t('share.download')}
              </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
