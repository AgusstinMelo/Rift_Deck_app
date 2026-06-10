import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getMyMembership } from '@/api/membershipSupabase';
import { createMercadoPagoSubscription } from '@/api/mercadoPagoSupabase';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import mercadoPagoLogo from '@/assets/mercado-pago.png';
import paypalLogo from '@/assets/paypal.png';

const PAYPAL_LINK = 'https://www.paypal.com/ncp/payment/M283F4KMUZKLW';

const EMAIL_LINK =
'mailto:disquetegaming@gmail.com?subject=Comprobante%20membres%C3%ADa%20Premium%20RiftDeck&body=Hola,%20ya%20pagu%C3%A9%20la%20membres%C3%ADa%20Premium%20por%20PayPal.%20Mi%20email%20de%20cuenta%20es:';

const FEATURES = [
'Winrate personal por campeón y línea',
'Matchups personales directos y generales',
'Análisis de sinergias personales',
'Insights personalizados'];


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

function PriceBlock({ title, description, price, priceClass }) {
  return (
    <div className="h-[132px] flex flex-col">
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
        <span className="text-muted-foreground text-sm">/ mes</span>
      </div>
    </div>);

}

function MercadoPagoCard() {
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
      const res = await createMercadoPagoSubscription(mpEmail);
      const checkoutUrl = res?.checkout_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError('No se pudo obtener el link de pago. Intentá de nuevo.');
      }
    } catch (e) {
      const errData = e?.response?.data;

      if (errData) {
        setError(JSON.stringify(errData, null, 2));
      } else {
        setError(e?.message || 'Ocurrió un error. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rd-card h-full md:min-h-[665px] p-6 grid grid-rows-[28px_48px_132px_158px_172px_44px] gap-5 relative overflow-hidden border-primary/20">
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
        price="AR$ 3.000"
        priceClass="text-primary" />
      

      <div className="h-[158px] flex flex-col">
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
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2 h-[172px]">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Cómo funciona:
        </p>

        <StepItem index={1}>Ingresá tu email de Mercado Pago.</StepItem>

        <StepItem index={2}>
          Tocá “Activar membresía” para ir al checkout seguro.
        </StepItem>

        <StepItem index={3}>
          La membresía se activa automáticamente después del pago.
        </StepItem>
      </div>

      <div className="h-11 flex items-end justify-center text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pago seguro con Mercado Pago · Cancelá cuando quieras
        </p>
      </div>

      {error &&
      <pre className="absolute left-6 right-6 bottom-6 z-10 text-red-400 text-xs text-left bg-red-950 border border-red-500/30 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap shadow-xl">
          {error}
        </pre>
      }
    </div>);

}

function PayPalCard() {
  return (
    <div className="rd-card h-full md:min-h-[665px] p-6 grid grid-rows-[28px_48px_132px_158px_172px_44px] gap-5 relative overflow-hidden border-border">
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
        description="Opción para usuarios internacionales. Podés pagar con PayPal o con los métodos disponibles según tu país."
        price="U$D 2"
        priceClass="text-accent" />
      

      <div className="h-[158px] flex flex-col">
        <div className="min-h-[102px] space-y-2">
          <label className="rd-label">Pago manual por PayPal</label>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Luego enviás el comprobante por email para activar tu acceso.
          </p>

          <p className="text-xs text-muted-foreground leading-relaxed">
            No necesitás completar datos acá antes de pagar.
          </p>
        </div>

        <a
          href={PAYPAL_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mt-auto">
          
          <Button className="w-full h-10 bg-[#003087] hover:bg-[#002070] text-white border-0">
            Pagar con PayPal
          </Button>
        </a>
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2 h-[172px]">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Después de pagar:
        </p>

        <StepItem index={1} variant="accent">
          Enviá el comprobante por email a{' '}
          <span className="text-primary font-medium">
            disquetegaming@gmail.com
          </span>
        </StepItem>

        <StepItem index={2} variant="accent">
          Indicá el email con el que estás registrado en RiftDeck.
        </StepItem>

        <StepItem index={3} variant="accent">
          Verificamos el pago y activamos tu membresía.
        </StepItem>
      </div>

      <div className="h-11 flex items-end justify-center text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pago seguro con PayPal
        </p>
      </div>
    </div>);

}

export default function MembershipGate() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(user?.role === 'admin');

  useEffect(() => {
    if (user?.role === 'admin') {
      setHasAccess(true);
      return;
    }

    getMyMembership(user?.id)
      .then(result => setHasAccess(result.hasAccess))
      .catch(() => setHasAccess(false));
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
          <MercadoPagoCard />
          <PayPalCard />
        </div>
      </div>
    </div>);

}
