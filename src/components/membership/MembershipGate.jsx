import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  TRIAL_DAYS,
  getMembershipPlans,
  getMyMembership,
  startMembershipTrial,
} from '@/api/membershipSupabase';
import { createMercadoPagoSubscription } from '@/api/mercadoPagoSupabase';
import { createPayPalSubscription } from '@/api/paypalSupabase';
import {
  getPlayBillingService,
  getPlayPrices,
  isInAndroidApp,
  purchasePlaySubscription,
  restorePlayPurchases,
} from '@/lib/googlePlayBilling';
import { Gift, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import mercadoPagoLogo from '@/assets/mercado-pago.png';
import paypalLogo from '@/assets/paypal.png';
import googlePlayLogo from '@/assets/google-play.png';
import { useLocale, useT } from '@/lib/LocaleContext';
import { PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY, useMatchMedia } from '@/hooks/useMatchMedia';
import { formatLocale, labels } from '@/i18n/uiI18n';

const FEATURES = [
'membership.features.winrate',
'membership.features.matchups',
'membership.features.synergies',
'membership.features.insights',
'membership.features.goals'];

// Nombre visible de cada plan; el de la base (en español) queda de respaldo.
const PLAN_NAMES = labels({
  premium: 'membership.plans.premium',
  premium_quarterly: 'membership.plans.premium_quarterly',
  premium_annual: 'membership.plans.premium_annual',
});

// Se usan si membership_plans todavía no se pudo leer.
const FALLBACK_PLANS = [
{ code: 'premium', name: 'Mensual', amount_ars: 3200, amount_usd: 2, interval_months: 1, google_play_product_id: 'premium_monthly' },
{ code: 'premium_quarterly', name: 'Trimestral', amount_ars: 8750, amount_usd: 5.5, interval_months: 3, google_play_product_id: 'premium_quarterly' },
{ code: 'premium_annual', name: 'Anual', amount_ars: 31800, amount_usd: 20, interval_months: 12, google_play_product_id: 'premium_annual' }];

// Cada tarjeta ocupa 4 filas de la grilla padre (subgrid): logo/precio, descripción, acción y pasos
// quedan alineados entre Mercado Pago y PayPal sin alturas fijas.
const PAYMENT_CARD = 'rd-card p-5 row-span-4 grid grid-rows-subgrid gap-3 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-4';

const PERIOD_LABELS = labels({ 1: 'membership.period.1', 3: 'membership.period.3', 12: 'membership.period.12' });

function formatAmount(value) {
  const amount = Number(value);
  return amount.toLocaleString(formatLocale(), {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function savingsPct(plan, monthly) {
  if (!monthly || plan.interval_months <= 1) return 0;
  const full = Number(monthly.amount_ars) * plan.interval_months;
  return Math.round((1 - Number(plan.amount_ars) / full) * 100);
}

function StepItem({ index, children, variant = 'primary' }) {
  const bubbleClass =
  variant === 'accent' ?
  'bg-accent/15 text-accent' :
  'bg-primary/15 text-primary';

  return (
    <div className="flex items-start gap-2">
      <span
        className={`shrink-0 w-5 h-5 rounded-full ${bubbleClass} text-[10px] font-bold flex items-center justify-center mt-0.5`}>

        {index}
      </span>

      <p className="text-xs text-muted-foreground leading-snug">
        {children}
      </p>
    </div>);

}

function RegionBadge({ region, variant = 'primary' }) {
  const regionClass =
  variant === 'accent' ?
  'text-accent/80 border-accent/30' :
  'text-primary/80 border-primary/30';

  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-[0.2em] font-bold border rounded-full px-2.5 py-0.5 ${regionClass}`}>

      {region}
    </span>);

}

// Logo y región del medio de pago a la izquierda, precio a la derecha.
function LogoPriceRow({ logo, region, variant, price, period, monthlyEquivalent, priceClass }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {logo}
        <RegionBadge region={region} variant={variant} />
      </div>

      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className={`font-rajdhani font-bold text-2xl ${priceClass}`}>
            {price}
          </span>
          <span className="text-muted-foreground text-sm">/ {period}</span>
        </div>

        {monthlyEquivalent &&
        <p className="text-xs text-muted-foreground">{monthlyEquivalent}</p>
        }
      </div>
    </div>);

}

// El logo ya dice el medio de pago: el título queda solo para lectores de pantalla.
function TitleBlock({ title, description }) {
  return (
    <div>
      <h3 className="sr-only">{title}</h3>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>);

}

function StepsBox({ title, note, variant, steps }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-1">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{note}</p>
      </div>

      {steps.map((step, index) =>
      <StepItem key={index} index={index + 1} variant={variant}>{step}</StepItem>
      )}
    </div>);

}

// Celular (vertical u horizontal): versión compacta que entra en la pantalla sin scroll y crece
// con el alto disponible. Las clases van escritas enteras para que Tailwind las genere:
// 640px = un poco más de aire; 700px = todo más grande; 840px (o 380px en horizontal) = además,
// los pasos del pago.
const ROOMY = {
  card: 'p-3 space-y-2 [@media(min-height:700px)]:p-4 [@media(min-height:700px)]:space-y-3',
  button: 'h-9 [@media(min-height:640px)]:h-10',
  logo: 'h-5 [@media(min-height:700px)]:h-6',
  price: 'text-xl [@media(min-height:700px)]:text-2xl',
  note: 'text-[11px] [@media(min-height:700px)]:text-xs',
};

// Pasos del pago en el celular: solo si sobra alto.
function CompactSteps({ steps }) {
  return (
    <ol className="hidden [@media(min-height:840px)]:block [@media(orientation:landscape)_and_(min-height:380px)]:block space-y-1 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
      {steps.map((step, index) =>
      <li key={index} className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
          <span className="shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center mt-px">
            {index + 1}
          </span>
          {step}
        </li>
      )}
    </ol>);

}

function usePhoneLayout() {
  const portrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const landscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  return { compact: portrait || landscape, landscape };
}

function PeriodSelector({ plans, selectedCode, onSelect, compact = false }) {
  const t = useT();
  const monthly = plans.find((plan) => plan.interval_months === 1);

  return (
    <div className="flex justify-center">
      <div
        className={`rounded-xl border border-border bg-secondary/30 p-1 gap-1 ${compact ? 'flex w-full' : 'inline-flex'}`}
        role="radiogroup"
        aria-label={t('membership.periodoDeLaMembresia')}>
        {plans.map((plan) => {
          const selected = plan.code === selectedCode;
          const savings = savingsPct(plan, monthly);

          return (
            <button
              key={plan.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(plan.code)}
              className={`rounded-lg font-semibold transition-colors ${
              compact ? 'flex-1 px-1.5 py-1.5 text-xs [@media(min-height:700px)]:py-2 [@media(min-height:700px)]:text-sm' : 'px-3 sm:px-4 py-2 text-sm'} ${
              selected ?
              'bg-primary text-primary-foreground shadow-sm' :
              'text-muted-foreground hover:text-foreground'}`
              }>

              {PLAN_NAMES[plan.code] || plan.name}
              {savings > 0 &&
              <span className={`ml-1 text-[10px] font-bold ${selected ? 'opacity-90' : 'text-primary'}`}>
                  −{savings}%
                </span>
              }
            </button>);

        })}
      </div>
    </div>);

}

function TrialCard({ onStarted, compact = false, className = '' }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      await startMembershipTrial();
      onStarted();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const button =
  <Button className={compact ? `${ROOMY.button} w-full` : 'h-10 sm:w-auto w-full'} onClick={handleStart} disabled={loading}>
      {loading ? t('membership.activando') : t('membership.empezarPruebaGratis')}
    </Button>;

  if (compact) {
    return (
      <div className={`rd-card px-3 py-2.5 border-primary/40 bg-primary/5 space-y-2 [@media(min-height:700px)]:p-4 [@media(min-height:700px)]:space-y-3 ${className}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 [@media(min-height:700px)]:w-10 [@media(min-height:700px)]:h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Gift size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-rajdhani font-bold text-sm [@media(min-height:700px)]:text-base text-foreground uppercase tracking-tight leading-tight">
              {t('membership.probaPremium')} {TRIAL_DAYS} {t('membership.diasGratis')}
            </h3>
            <p className={`${ROOMY.note} text-muted-foreground leading-snug`}>{t('membership.sinTarjetaNiMedio')}</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {button}
      </div>);

  }

  return (
    <div className={`rd-card px-4 py-3 border-primary/40 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Gift size={20} className="text-primary" />
      </div>

      <div className="flex-1 space-y-0.5">
        <h3 className="font-rajdhani font-bold text-lg text-foreground uppercase tracking-tight">
         {t('membership.probaPremium')} {TRIAL_DAYS} {t('membership.diasGratis')}
        </h3>
        <p className="text-sm text-muted-foreground leading-snug">
         {t('membership.sinTarjetaNiMedio')}
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {button}
    </div>);

}

// Fila compacta de logo y precio (celular).
function CompactPriceRow({ logo, price, period, monthlyEquivalent, priceClass }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {logo}
      <div className="text-right leading-tight whitespace-nowrap">
        <span className={`font-rajdhani font-bold ${ROOMY.price} ${priceClass}`}>{price}</span>
        <span className="text-muted-foreground text-xs"> / {period}</span>
        {monthlyEquivalent && <p className="text-[10px] text-muted-foreground">{monthlyEquivalent}</p>}
      </div>
    </div>);

}

function MercadoPagoCard({ plan, period, monthlyEquivalent, compact = false }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mpEmail, setMpEmail] = useState('');

  const handleActivate = async () => {
    if (!mpEmail || !mpEmail.includes('@')) {
      setError(t('membership.ingresaTuEmailDe'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createMercadoPagoSubscription(mpEmail, plan.code);
      const checkoutUrl = res?.checkout_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError(t('membership.noSePudoObtener'));
      }
    } catch (e) {
      setError(e?.message || t('membership.ocurrioUnErrorIntenta'));
    } finally {
      setLoading(false);
    }
  };

  const price = t('membership.ar', { formatAmount: formatAmount(plan.amount_ars) });
  const monthlyText = monthlyEquivalent && t('membership.arPorMes', { formatAmount: formatAmount(monthlyEquivalent) });

  if (compact) {
    return (
      <div className={`rd-card ${ROOMY.card} border-primary/20`}>
        <CompactPriceRow
          logo={
          <div className="bg-[#ffe900] rounded-lg px-2.5 py-1 inline-flex items-center">
              <img src={mercadoPagoLogo} alt={t('membership.mercadoPago')} className={`${ROOMY.logo} w-auto object-contain`} />
            </div>
          }
          price={price}
          period={period}
          monthlyEquivalent={monthlyText}
          priceClass="text-primary" />

        <div className="space-y-1">
          <label htmlFor="mp-email-compact" className={`block ${ROOMY.note} text-muted-foreground`} title={t('membership.puedeSerDistintoAl')}>
            {t('membership.tuEmailDeMercado')}
          </label>
          <div className="flex gap-2">
            <Input
              id="mp-email-compact"
              type="email"
              placeholder={t('membership.ejemploGmailCom')}
              value={mpEmail}
              onChange={(e) => setMpEmail(e.target.value)}
              disabled={loading}
              className={`${ROOMY.button} flex-1 min-w-0 text-sm`} />
            <Button className={`${ROOMY.button} shrink-0 px-3`} onClick={handleActivate} disabled={loading || !mpEmail}>
              {loading ? t('membership.redirigiendo') : t('membership.activarMembresia')}
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <CompactSteps steps={[
        t('membership.ingresaTuEmailDe'),
        t('membership.tocaActivarMembresiaPara'),
        `${t('membership.laMembresiaSeActiva')} ${period}.`]
        } />
      </div>);

  }

  return (
    <div className={`${PAYMENT_CARD} border-primary/20`}>
      <LogoPriceRow
        logo={
        <div className="bg-[#ffe900] rounded-xl px-4 py-2 inline-flex items-center shadow-sm">
            <img
            src={mercadoPagoLogo}
            alt={t('membership.mercadoPago')}
            className="h-7 w-auto object-contain" />

          </div>
        }
        price={price}
        period={period}
        monthlyEquivalent={monthlyText}
        priceClass="text-primary"
        region={t('membership.argentina')} />

      <TitleBlock
        title={t('membership.pagarConMercadoPago')}
        description={t('membership.recomendadoParaUsuariosDe')} />

      <div className="flex flex-col gap-1.5">
        <label className="rd-label">{t('membership.tuEmailDeMercado')}</label>

        <p className="text-xs text-muted-foreground leading-snug">
         {t('membership.puedeSerDistintoAl')}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row">
          <Input
            type="email"
            placeholder={t('membership.ejemploGmailCom')}
            value={mpEmail}
            onChange={(e) => setMpEmail(e.target.value)}
            disabled={loading}
            className="h-10 flex-1" />

          <Button
            className="h-10 shrink-0"
            onClick={handleActivate}
            disabled={loading || !mpEmail}>

            {loading ? t('membership.redirigiendo') : t('membership.activarMembresia')}
          </Button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <StepsBox
        title={t('membership.comoFunciona')}
        note={t('membership.pagoSeguroConMercado')}
        steps={[
        t('membership.ingresaTuEmailDe'),
        t('membership.tocaActivarMembresiaPara'),
        `${t('membership.laMembresiaSeActiva')} ${period}.`]
        } />

    </div>);

}

function PayPalCard({ plan, period, monthlyEquivalent, compact = false }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await createPayPalSubscription(plan.code);

      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        setError(t('membership.noSePudoObtener'));
        setLoading(false);
      }
    } catch (e) {
      setError(e?.message || t('membership.ocurrioUnErrorIntenta'));
      setLoading(false);
    }
  };

  const price = `U$D ${formatAmount(plan.amount_usd)}`;
  const monthlyText = monthlyEquivalent && t('membership.uDPorMes', { formatAmount: formatAmount(monthlyEquivalent) });
  const button =
  <Button
    className={`w-full ${compact ? ROOMY.button : 'h-10'} bg-[#003087] hover:bg-[#002070] text-white border-0`}
    onClick={handleSubscribe}
    disabled={loading}>

      {loading ? t('membership.redirigiendo') : t('membership.suscribirmeConPaypal')}
    </Button>;

  if (compact) {
    return (
      <div className={`rd-card ${ROOMY.card} border-border`}>
        <CompactPriceRow
          logo={
          <div className="bg-white rounded-lg px-2.5 py-1 inline-flex items-center">
              <img src={paypalLogo} alt={t('membership.paypal')} className={`${ROOMY.logo} w-auto object-contain`} />
            </div>
          }
          price={price}
          period={period}
          monthlyEquivalent={monthlyText}
          priceClass="text-accent" />
        {button}
        {error ?
        <p className="text-xs text-red-400">{error}</p> :
        <p className={`${ROOMY.note} text-muted-foreground leading-snug`}>{t('membership.noNecesitasCompletarDatos')}</p>
        }
        <CompactSteps steps={[
        t('membership.tocaSuscribirmeConPaypal'),
        t('membership.iniciaSesionEnPaypal'),
        `${t('membership.laMembresiaSeActiva')} ${period}.`]
        } />
      </div>);

  }

  return (
    <div className={`${PAYMENT_CARD} border-border`}>
      <LogoPriceRow
        logo={
        <div className="bg-white rounded-xl px-4 py-2 inline-flex items-center shadow-sm">
            <img
            src={paypalLogo}
            alt={t('membership.paypal')}
            className="h-7 w-auto object-contain" />

          </div>
        }
        price={price}
        period={period}
        monthlyEquivalent={monthlyText}
        priceClass="text-accent"
        region={t('membership.internacional')}
        variant="accent" />

      <TitleBlock
        title={t('membership.pagarConPaypal')}
        description={t('membership.opcionParaUsuariosInternacionales')} />

      <div className="flex flex-col gap-1.5">
        <label className="rd-label">{t('membership.suscripcionConPaypal')}</label>

        <p className="text-xs text-muted-foreground leading-snug">
         {t('membership.noNecesitasCompletarDatos')}
        </p>

        <div className="mt-auto pt-1">{button}</div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <StepsBox
        title={t('membership.comoFunciona')}
        note={t('membership.pagoSeguroConPaypal')}
        variant="accent"
        steps={[
        t('membership.tocaSuscribirmeConPaypal'),
        t('membership.iniciaSesionEnPaypal'),
        `${t('membership.laMembresiaSeActiva')} ${period}.`]
        } />

    </div>);

}

// Celular, en la web: un medio de pago a la vez, con pestañas (los dos juntos no entran).
function CompactWebPayment({ plan, period, monthlyEquivalent, monthlyEquivalentUsd }) {
  const t = useT();
  const { locale } = useLocale();
  const [method, setMethod] = useState(locale === 'es-419' ? 'mercadopago' : 'paypal');
  const methods = [
  { id: 'mercadopago', label: t('membership.mercadoPago') },
  { id: 'paypal', label: t('membership.paypal') }];


  return (
    <div className="space-y-2">
      <div className="flex rounded-xl border border-border bg-secondary/30 p-1 gap-1" role="tablist">
        {methods.map(({ id, label }) =>
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={method === id}
          onClick={() => setMethod(id)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors [@media(min-height:700px)]:py-2 [@media(min-height:700px)]:text-sm ${
          method === id ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
          }>
            {label}
          </button>
        )}
      </div>

      {method === 'mercadopago' ?
      <MercadoPagoCard compact plan={plan} period={period} monthlyEquivalent={monthlyEquivalent} /> :
      <PayPalCard compact plan={plan} period={period} monthlyEquivalent={monthlyEquivalentUsd} />
      }
    </div>);

}

// App de Android: Google Play es el único medio de pago (política de pagos de Google Play).
function GooglePlayCard({ plan, plans, period, onPurchased, compact = false }) {
  const t = useT();
  const [available, setAvailable] = useState(null);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const productIds = plans.map((p) => p.google_play_product_id).filter(Boolean).join(',');

  useEffect(() => {
    let cancelled = false;
    getPlayBillingService().then(async (service) => {
      if (cancelled) return;
      setAvailable(Boolean(service));
      if (!service || !productIds) return;
      const loaded = await getPlayPrices(productIds.split(',')).catch(() => ({}));
      if (!cancelled) setPrices(loaded);
    });
    return () => {cancelled = true;};
  }, [productIds]);

  const productId = plan.google_play_product_id;
  const price = productId ? prices[productId] : null;

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      if (await purchasePlaySubscription(productId)) onPurchased();
    } catch (e) {
      setError(e?.message || t('membership.ocurrioUnErrorIntenta'));
    } finally {
      setLoading(false);
    }
  };

  if (available === false || available && !productId) {
    return (
      <div className={`rd-card text-center text-muted-foreground max-w-md mx-auto ${compact ? 'p-3 text-xs' : 'p-5 text-sm'}`}>
        {t('membership.googlePlay.noDisponible')}
      </div>);

  }

  const header =
  <div className="flex items-center justify-between gap-3">
      <div className={`bg-white inline-flex items-center shrink-0 ${compact ? 'rounded-lg px-2.5 py-1' : 'rounded-xl px-4 py-2 shadow-sm'}`}>
        <img src={googlePlayLogo} alt="Google Play" className={`${compact ? ROOMY.logo : 'h-7'} w-auto object-contain`} />
      </div>
      <div className="text-right whitespace-nowrap">
        <span className={`font-rajdhani font-bold ${compact ? ROOMY.price : 'text-2xl'} text-primary`}>{price || '—'}</span>
        <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}> / {period}</span>
      </div>
    </div>;

  const button =
  <Button className={`w-full ${compact ? ROOMY.button : 'h-10'}`} onClick={handleSubscribe} disabled={loading || !available || !price}>
      {loading ? t('membership.googlePlay.procesando') : t('membership.googlePlay.suscribirme')}
    </Button>;

  if (compact) {
    return (
      <div className={`rd-card ${ROOMY.card} border-primary/20 w-full`}>
        {header}
        {button}
        {error ?
        <p className="text-xs text-red-400">{error}</p> :
        <p className={`${ROOMY.note} text-muted-foreground leading-snug`}>{t('membership.googlePlay.descripcion')}</p>
        }
        <CompactSteps steps={[
        t('membership.googlePlay.paso1'),
        t('membership.googlePlay.paso2'),
        t('membership.googlePlay.paso3')]
        } />
      </div>);

  }

  return (
    <div className="rd-card p-5 space-y-3 border-primary/20 max-w-md mx-auto w-full">
      {header}

      <p className="text-sm text-muted-foreground leading-relaxed">{t('membership.googlePlay.descripcion')}</p>

      {button}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <StepsBox
        title={t('membership.comoFunciona')}
        note={t('membership.googlePlay.nota')}
        steps={[
        t('membership.googlePlay.paso1'),
        t('membership.googlePlay.paso2'),
        t('membership.googlePlay.paso3')]
        } />
    </div>);

}

/**
 * Prueba gratis (si corresponde), selector de período y medios de pago.
 * `onAccessGranted` se llama al activar la prueba; sin él se recarga la página.
 * `intro` (opcional): encabezado de la pantalla; en el celular horizontal va en la columna
 * izquierda, junto a la prueba gratis, para que todo entre sin scroll.
 */
export function MembershipOffer({ membership, onAccessGranted, intro = null }) {
  const t = useT();
  const { compact, landscape } = usePhoneLayout();
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedCode, setSelectedCode] = useState('premium');

  useEffect(() => {
    getMembershipPlans().
    then((rows) => rows.length > 0 && setPlans(rows)).
    catch(() => {});
  }, []);

  const plan = plans.find((p) => p.code === selectedCode) || plans[0];
  const period = PERIOD_LABELS[plan.interval_months] || t('membership.meses', { interval_months: plan.interval_months });
  const monthlyEquivalent = plan.interval_months > 1 ? Math.round(plan.amount_ars / plan.interval_months) : null;
  const monthlyEquivalentUsd = plan.interval_months > 1 ? Math.round(plan.amount_usd / plan.interval_months * 100) / 100 : null;
  const trialExpired = membership?.trialEndsAt && membership.trialEndsAt <= new Date() && !membership.hasAccess;

  const handleTrialStarted = () => {
    if (onAccessGranted) onAccessGranted();else
    window.location.reload();
  };

  const inAndroidApp = isInAndroidApp();

  // En la app, una suscripción de Play que todavía no se vinculó (reinstalación, otro celular)
  // da acceso sin volver a comprar.
  useEffect(() => {
    if (!inAndroidApp) return;
    restorePlayPurchases().then((restored) => {
      if (restored > 0) handleTrialStarted();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inAndroidApp]);

  const expiredNotice = trialExpired &&
  <div className={`rd-card text-center text-muted-foreground ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
       {t('membership.tuPruebaGratisTermino')}
      </div>;

  const trial = membership?.trialAvailable && <TrialCard compact={compact} onStarted={handleTrialStarted} />;
  const periodSelector = <PeriodSelector compact={compact} plans={plans} selectedCode={plan.code} onSelect={setSelectedCode} />;

  let payment;
  if (inAndroidApp) {
    payment = <GooglePlayCard compact={compact} plan={plan} plans={plans} period={period} onPurchased={handleTrialStarted} />;
  } else if (compact) {
    payment = <CompactWebPayment plan={plan} period={period} monthlyEquivalent={monthlyEquivalent} monthlyEquivalentUsd={monthlyEquivalentUsd} />;
  } else {
    payment =
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <MercadoPagoCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalent} />
        <PayPalCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalentUsd} />
      </div>;
  }

  if (landscape) {
    return (
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="space-y-2 [@media(min-height:370px)]:space-y-3">
          {intro}
          {expiredNotice}
          {trial}
        </div>
        <div className="space-y-2 [@media(min-height:370px)]:space-y-3">
          {periodSelector}
          {payment}
        </div>
      </div>);

  }

  return (
    <div className={compact ? 'space-y-2.5 [@media(min-height:640px)]:space-y-3.5' : 'space-y-4 [@media(max-height:700px)]:space-y-2.5'}>
      {intro}
      {expiredNotice}
      {trial}
      {periodSelector}
      {payment}
    </div>);

}

function GateIntro({ compact, landscape }) {
  const t = useT();

  if (compact) {
    return (
      <div className="space-y-2 [@media(min-height:700px)]:space-y-3">
        <div className="flex items-center gap-2.5 [@media(min-height:700px)]:gap-3">
          <div className="w-9 h-9 [@media(min-height:700px)]:w-11 [@media(min-height:700px)]:h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="rd-section-kicker text-[10px]">{t('membership.premium')}</p>
            <h2 className="font-rajdhani font-bold text-lg [@media(min-height:640px)]:text-xl [@media(min-height:700px)]:text-2xl text-foreground tracking-tight uppercase leading-tight">
              {t('membership.accesoPremiumAStats')}
            </h2>
          </div>
        </div>
        {!landscape &&
        <p className="hidden [@media(min-height:700px)]:block text-xs text-muted-foreground leading-relaxed">
            {t('membership.paraAccederALas')}
          </p>
        }
        {/* Beneficios: no entran en un celular muy bajo; en horizontal, solo si hay alto (la app). */}
        <ul className={landscape ?
        'hidden [@media(min-height:330px)]:block space-y-0.5' :
        'space-y-0.5 [@media(min-height:700px)]:space-y-1 [@media(max-height:599px)]:hidden'}>
          {FEATURES.map((feature) =>
          <li key={feature} className="flex items-center gap-1.5 text-[11px] [@media(min-height:700px)]:text-xs leading-tight text-muted-foreground">
              <Sparkles size={10} className="text-primary shrink-0" />
              {t(feature)}
            </li>
          )}
        </ul>
      </div>);

  }

  return (
    <div className="text-center space-y-2 [@media(max-height:700px)]:space-y-1.5">
      <div className="flex items-center justify-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Lock size={22} className="text-primary" />
        </div>

        <div className="text-left">
          <p className="rd-section-kicker">{t('membership.premium')}</p>

          <h2 className="font-rajdhani font-bold text-2xl md:text-3xl text-foreground tracking-tight uppercase leading-tight">
           {t('membership.accesoPremiumAStats')}
          </h2>
        </div>
      </div>

      <p className="text-muted-foreground text-sm max-w-2xl mx-auto leading-relaxed [@media(max-height:680px)]:hidden">
       {t('membership.paraAccederALas')}
      </p>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {FEATURES.map((feature) =>
        <span
          key={feature}
          className="flex items-center gap-1.5 text-xs text-muted-foreground">

            <Sparkles size={11} className="text-primary shrink-0" />
            {t(feature)}
          </span>
        )}
      </div>
    </div>);

}

export default function MembershipGate({ onAccessGranted }) {
  const { user } = useAuth();
  const { compact, landscape } = usePhoneLayout();
  const [membership, setMembership] = useState(null);
  const hasAccess = user?.role === 'admin' || membership?.hasAccess === true;

  useEffect(() => {
    if (user?.role === 'admin') return;

    getMyMembership(user?.id).
    then(setMembership).
    catch(() => setMembership(null));
  }, [user?.id, user?.role]);

  if (hasAccess) return null;

  return (
    <div className={compact ?
    'min-h-full flex items-center justify-center px-3 py-2.5 [@media(min-height:640px)]:px-4 [@media(min-height:700px)]:py-3' :
    'min-h-full flex items-center justify-center py-4 px-4 [@media(max-height:700px)]:py-3'}>
      <div className="w-full max-w-6xl">
        <MembershipOffer
          membership={membership}
          onAccessGranted={onAccessGranted}
          intro={<GateIntro compact={compact} landscape={landscape} />} />
      </div>
    </div>);

}
