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

const FEATURES = [
'Winrate personal por campeón y línea',
'Matchups personales directos y generales',
'Análisis de sinergias personales',
'Insights personalizados',
'Objetivos personales ilimitados'];

// Se usan si membership_plans todavía no se pudo leer.
const FALLBACK_PLANS = [
{ code: 'premium', name: 'Mensual', amount_ars: 3000, amount_usd: 2, interval_months: 1 },
{ code: 'premium_quarterly', name: 'Trimestral', amount_ars: 8500, amount_usd: 5.5, interval_months: 3 },
{ code: 'premium_annual', name: 'Anual', amount_ars: 30000, amount_usd: 20, interval_months: 12 }];

const PERIOD_LABELS = { 1: 'mes', 3: '3 meses', 12: 'año' };

function formatAmount(value) {
  const amount = Number(value);
  return amount.toLocaleString('es-AR', {
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
    <div className="flex items-start gap-2.5">
      <span
        className={`shrink-0 w-5 h-5 rounded-full ${bubbleClass} text-[10px] font-bold flex items-center justify-center mt-0.5`}>

        {index}
      </span>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {children}
      </p>
    </div>);

}

function CardHeaderRow({ region, variant = 'primary' }) {
  const regionClass =
  variant === 'accent' ?
  'text-accent/80 border-accent/30' :
  'text-primary/80 border-primary/30';

  return (
    <div className="flex items-center justify-between gap-3 h-7">
      <span
        className={`text-[10px] uppercase tracking-[0.2em] font-bold border rounded-full px-2.5 py-0.5 ${regionClass}`}>

        {region}
      </span>
    </div>);

}

function PriceBlock({ title, description, price, period, monthlyEquivalent, priceClass }) {
  return (
    <div className="min-h-[132px] flex flex-col">
      <h3 className="font-rajdhani font-bold text-xl text-foreground uppercase tracking-tight h-7 flex items-center">
        {title}
      </h3>

      <p className="text-muted-foreground text-sm mt-1 leading-relaxed min-h-[44px]">
        {description}
      </p>

      <div className="flex items-baseline gap-1 mt-4">
        <span className={`font-rajdhani font-bold text-3xl ${priceClass}`}>
          {price}
        </span>
        <span className="text-muted-foreground text-sm">/ {period}</span>
      </div>

      {monthlyEquivalent &&
      <p className="text-xs text-muted-foreground mt-0.5">{monthlyEquivalent}</p>
      }
    </div>);

}

function PeriodSelector({ plans, selectedCode, onSelect }) {
  const monthly = plans.find((plan) => plan.interval_months === 1);

  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-xl border border-border bg-secondary/30 p-1 gap-1" role="radiogroup" aria-label="Período de la membresía">
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

              {plan.name}
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

function TrialCard({ onStarted }) {
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
    <div className="rd-card p-5 border-primary/40 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Gift size={22} className="text-primary" />
      </div>

      <div className="flex-1 space-y-1">
        <h3 className="font-rajdhani font-bold text-xl text-foreground uppercase tracking-tight">
          Probá Premium {TRIAL_DAYS} días gratis
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sin tarjeta ni medio de pago. Cuando termine la prueba elegís si querés seguir.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <Button className="h-10 sm:w-auto w-full" onClick={handleStart} disabled={loading}>
        {loading ? 'Activando...' : 'Empezar prueba gratis'}
      </Button>
    </div>);

}

function MercadoPagoCard({ plan, period, monthlyEquivalent }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mpEmail, setMpEmail] = useState('');

  const handleActivate = async () => {
    if (!mpEmail || !mpEmail.includes('@')) {
      setError('Ingresá tu email de Mercado Pago.');
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
        setError('No se pudo obtener el link de pago. Intentá de nuevo.');
      }
    } catch (e) {
      setError(e?.message || 'Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rd-card h-full p-6 grid auto-rows-max gap-5 relative border-primary/20">
      <CardHeaderRow region="🇦🇷 Argentina" />

      <div className="h-12 flex items-center">
        <div className="bg-[#ffe900] rounded-xl px-4 py-2.5 inline-flex items-center shadow-sm">
          <img
            src={mercadoPagoLogo}
            alt="Mercado Pago"
            className="h-7 w-auto object-contain" />

        </div>
      </div>

      <PriceBlock
        title="Pagar con Mercado Pago"
        description="Recomendado para usuarios de Argentina. Necesitás tener una cuenta activa en Mercado Pago"
        price={`AR$ ${formatAmount(plan.amount_ars)}`}
        period={period}
        monthlyEquivalent={monthlyEquivalent && `≈ AR$ ${formatAmount(monthlyEquivalent)} por mes`}
        priceClass="text-primary" />


      <div className="min-h-[158px] flex flex-col">
        <div className="min-h-[102px] space-y-2">
          <label className="rd-label">Tu email de Mercado Pago</label>

          <Input
            type="email"
            placeholder="ejemplo@gmail.com"
            value={mpEmail}
            onChange={(e) => setMpEmail(e.target.value)}
            disabled={loading} />


          <p className="text-xs text-muted-foreground leading-relaxed">
            Puede ser distinto al email con el que te registraste en Rift Deck.
          </p>
        </div>

        <Button
          className="w-full h-10 mt-auto"
          onClick={handleActivate}
          disabled={loading || !mpEmail}>

          {loading ? 'Redirigiendo...' : 'Activar membresía'}
        </Button>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2 min-h-[172px]">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Cómo funciona:
        </p>

        <StepItem index={1}>Ingresá tu email de Mercado Pago.</StepItem>

        <StepItem index={2}>
          Tocá “Activar membresía” para ir al checkout seguro.
        </StepItem>

        <StepItem index={3}>
          La membresía se activa automáticamente y se renueva cada {period}.
        </StepItem>
      </div>

      <div className="h-11 flex items-end justify-center text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pago seguro con Mercado Pago · Cancelá cuando quieras
        </p>
      </div>
    </div>);

}

function PayPalCard({ plan, period, monthlyEquivalent }) {
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
        setError('No se pudo obtener el link de pago. Intentá de nuevo.');
        setLoading(false);
      }
    } catch (e) {
      setError(e?.message || 'Ocurrió un error. Intentá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="rd-card h-full p-6 grid auto-rows-max gap-5 relative border-border">
      <CardHeaderRow region="🌎 Internacional" variant="accent" />

      <div className="h-12 flex items-center">
        <div className="bg-white rounded-xl px-4 py-2.5 inline-flex items-center gap-1.5 shadow-sm">
          <img
            src={paypalLogo}
            alt="PayPal"
            className="h-7 w-auto object-contain"
          />
        </div>
      </div>

      <PriceBlock
        title="Pagar con PayPal"
        description="Opción para usuarios internacionales. Podés pagar con tu saldo de PayPal o con una tarjeta asociada."
        price={`U$D ${formatAmount(plan.amount_usd)}`}
        period={period}
        monthlyEquivalent={monthlyEquivalent && `≈ U$D ${formatAmount(monthlyEquivalent)} por mes`}
        priceClass="text-accent" />
      

      <div className="min-h-[158px] flex flex-col">
        <div className="min-h-[102px] space-y-2">
          <label className="rd-label">Suscripción con PayPal</label>

          <p className="text-xs text-muted-foreground leading-relaxed">
            No necesitás completar datos acá: el pago se hace en PayPal.
          </p>
        </div>

        <Button
          className="w-full h-10 mt-auto bg-[#003087] hover:bg-[#002070] text-white border-0"
          onClick={handleSubscribe}
          disabled={loading}>
          
          {loading ? 'Redirigiendo...' : 'Suscribirme con PayPal'}
        </Button>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2 min-h-[172px]">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Cómo funciona:
        </p>

        <StepItem index={1} variant="accent">
          Tocá “Suscribirme con PayPal”.
        </StepItem>

        <StepItem index={2} variant="accent">
          Iniciá sesión en PayPal y aprobá la suscripción.
        </StepItem>

        <StepItem index={3} variant="accent">
          La membresía se activa automáticamente y se renueva cada {period}.
        </StepItem>
      </div>

      <div className="h-11 flex items-end justify-center text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pago seguro con PayPal · Cancelá cuando quieras
        </p>
      </div>
    </div>);

}

/**
 * Prueba gratis (si corresponde), selector de período y medios de pago.
 * `onAccessGranted` se llama al activar la prueba; sin él se recarga la página.
 */
export function MembershipOffer({ membership, onAccessGranted }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedCode, setSelectedCode] = useState('premium');

  useEffect(() => {
    getMembershipPlans()
      .then((rows) => rows.length > 0 && setPlans(rows))
      .catch(() => {});
  }, []);

  const plan = plans.find((p) => p.code === selectedCode) || plans[0];
  const period = PERIOD_LABELS[plan.interval_months] || `${plan.interval_months} meses`;
  const monthlyEquivalent = plan.interval_months > 1 ? Math.round(plan.amount_ars / plan.interval_months) : null;
  const monthlyEquivalentUsd = plan.interval_months > 1 ? Math.round((plan.amount_usd / plan.interval_months) * 100) / 100 : null;
  const trialExpired = membership?.trialEndsAt && membership.trialEndsAt <= new Date() && !membership.hasAccess;

  const handleTrialStarted = () => {
    if (onAccessGranted) onAccessGranted();
    else window.location.reload();
  };

  return (
    <div className="space-y-6">
      {membership?.trialAvailable && <TrialCard onStarted={handleTrialStarted} />}

      {trialExpired &&
      <div className="rd-card p-4 text-center text-sm text-muted-foreground">
          Tu prueba gratis terminó. Elegí un plan para seguir usando Premium.
        </div>
      }

      <PeriodSelector plans={plans} selectedCode={plan.code} onSelect={setSelectedCode} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        <MercadoPagoCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalent} />
        <PayPalCard plan={plan} period={period} monthlyEquivalent={monthlyEquivalentUsd} />
      </div>
    </div>);

}

export default function MembershipGate({ onAccessGranted }) {
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
    <div className="min-h-[60vh] flex items-start justify-center pt-10 pb-16 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock size={26} className="text-primary" />
          </div>

          <div>
            <p className="rd-section-kicker mb-1">Premium</p>

            <h2 className="font-rajdhani font-bold text-3xl md:text-4xl text-foreground tracking-tight uppercase">
              Acceso Premium a Stats
            </h2>
          </div>

          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Para acceder a las estadísticas avanzadas necesitás tener una
            membresía Premium activa.
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 pt-2">
            {FEATURES.map((feature) =>
            <span
              key={feature}
              className="flex items-center gap-1.5 text-xs text-muted-foreground">

                <Sparkles size={11} className="text-primary shrink-0" />
                {feature}
              </span>
            )}
          </div>
        </div>

        <MembershipOffer membership={membership} onAccessGranted={onAccessGranted} />
      </div>
    </div>);

}
