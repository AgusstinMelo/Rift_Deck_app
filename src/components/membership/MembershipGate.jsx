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
import { Gift, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import mercadoPagoLogo from '@/assets/mercado-pago.png';
import paypalLogo from '@/assets/paypal.png';
import { useT } from '@/lib/LocaleContext';
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
{ code: 'premium', name: 'Mensual', amount_ars: 3000, amount_usd: 2, interval_months: 1 },
{ code: 'premium_quarterly', name: 'Trimestral', amount_ars: 8500, amount_usd: 5.5, interval_months: 3 },
{ code: 'premium_annual', name: 'Anual', amount_ars: 30000, amount_usd: 20, interval_months: 12 }];

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

function PeriodSelector({ plans, selectedCode, onSelect }) {
  const t = useT();
  const monthly = plans.find((plan) => plan.interval_months === 1);

  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-xl border border-border bg-secondary/30 p-1 gap-1" role="radiogroup" aria-label={t('membership.periodoDeLaMembresia')}>
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
              className={`rounded-lg px-3 sm:px-4 py-2 text-sm font-semibold transition-colors ${
              selected ?
              'bg-primary text-primary-foreground shadow-sm' :
              'text-muted-foreground hover:text-foreground'}`
              }>

              {PLAN_NAMES[plan.code] || plan.name}
              {savings > 0 &&
              <span className={`ml-1.5 text-[10px] font-bold ${selected ? 'opacity-90' : 'text-primary'}`}>
                  −{savings}%
                </span>
              }
            </button>);

        })}
      </div>
    </div>);

}

function TrialCard({ onStarted, className = '' }) {
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

      <Button className="h-10 sm:w-auto w-full" onClick={handleStart} disabled={loading}>
        {loading ? t('membership.activando') : t('membership.empezarPruebaGratis')}
      </Button>
    </div>);

}

function MercadoPagoCard({ plan, period, monthlyEquivalent }) {
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
        price={t('membership.ar', { formatAmount: formatAmount(plan.amount_ars) })}
        period={period}
        monthlyEquivalent={monthlyEquivalent && t('membership.arPorMes', { formatAmount: formatAmount(monthlyEquivalent) })}
        priceClass="text-primary"
        region={t('membership.argentina')} />

      <TitleBlock
        title={t('membership.pagarConMercadoPago')}
        description={t('membership.recomendadoParaUsuariosDe')}
 />

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

function PayPalCard({ plan, period, monthlyEquivalent }) {
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
        price={`U$D ${formatAmount(plan.amount_usd)}`}
        period={period}
        monthlyEquivalent={monthlyEquivalent && t('membership.uDPorMes', { formatAmount: formatAmount(monthlyEquivalent) })}
        priceClass="text-accent"
        region={t('membership.internacional')}
        variant="accent" />

      <TitleBlock
        title={t('membership.pagarConPaypal')}
        description={t('membership.opcionParaUsuariosInternacionales')}
 />

      <div className="flex flex-col gap-1.5">
        <label className="rd-label">{t('membership.suscripcionConPaypal')}</label>

        <p className="text-xs text-muted-foreground leading-snug">
         {t('membership.noNecesitasCompletarDatos')}
        </p>

        <div className="mt-auto pt-1">
          <Button
            className="w-full h-10 bg-[#003087] hover:bg-[#002070] text-white border-0"
            onClick={handleSubscribe}
            disabled={loading}>

            {loading ? t('membership.redirigiendo') : t('membership.suscribirmeConPaypal')}
          </Button>
        </div>

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

/**
 * Prueba gratis (si corresponde), selector de período y medios de pago.
 * `onAccessGranted` se llama al activar la prueba; sin él se recarga la página.
 */
export function MembershipOffer({ membership, onAccessGranted }) {
  const t = useT();
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedCode, setSelectedCode] = useState('premium');

  useEffect(() => {
    getMembershipPlans()
      .then((rows) => rows.length > 0 && setPlans(rows))
      .catch(() => {});
  }, []);

  const plan = plans.find((p) => p.code === selectedCode) || plans[0];
  const period = PERIOD_LABELS[plan.interval_months] || t('membership.meses', { interval_months: plan.interval_months });
  const monthlyEquivalent = plan.interval_months > 1 ? Math.round(plan.amount_ars / plan.interval_months) : null;
  const monthlyEquivalentUsd = plan.interval_months > 1 ? Math.round((plan.amount_usd / plan.interval_months) * 100) / 100 : null;
  const trialExpired = membership?.trialEndsAt && membership.trialEndsAt <= new Date() && !membership.hasAccess;

  const handleTrialStarted = () => {
    if (onAccessGranted) onAccessGranted();
    else window.location.reload();
  };

  return (
    <div className="space-y-4 [@media(max-height:700px)]:space-y-2.5">
      {trialExpired &&
      <div className="rd-card p-3 text-center text-sm text-muted-foreground">
         {t('membership.tuPruebaGratisTermino')}
        </div>
      }

      {membership?.trialAvailable && <TrialCard onStarted={handleTrialStarted} />}

      <PeriodSelector plans={plans} selectedCode={plan.code} onSelect={setSelectedCode} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <MercadoPagoCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalent} />
        <PayPalCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalentUsd} />
      </div>
    </div>);

}

export default function MembershipGate({ onAccessGranted }) {
  const t = useT();
  const { user } = useAuth();
  const [membership, setMembership] = useState(null);
  const hasAccess = user?.role === 'admin' || membership?.hasAccess === true;

  useEffect(() => {
    if (user?.role === 'admin') return;

    getMyMembership(user?.id)
      .then(setMembership)
      .catch(() => setMembership(null));
  }, [user?.id, user?.role]);

  if (hasAccess) return null;

  return (
    <div className="min-h-full flex items-center justify-center py-4 px-4 [@media(max-height:700px)]:py-3">
      <div className="w-full max-w-6xl space-y-3">
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
        </div>

        <MembershipOffer membership={membership} onAccessGranted={onAccessGranted} />
      </div>
    </div>);

}
