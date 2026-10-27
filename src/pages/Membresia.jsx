import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { daysUntil, getMyMembership } from '@/api/membershipSupabase';
import { MembershipOffer } from '@/components/membership/MembershipGate';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { BarChart3, Crown } from 'lucide-react';

const PLAN_NAMES = {
  premium: 'Mensual',
  premium_quarterly: 'Trimestral',
  premium_annual: 'Anual',
  trial: 'Prueba gratis',
};

const PROVIDER_NAMES = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
};

function formatDate(date) {
  return date?.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function describeMembership(info) {
  const row = info.membership;
  const until = info.accessUntil;

  if (!info.hasAccess) {
    return { title: 'No tenés una membresía activa', detail: 'Elegí un plan para acceder a las estadísticas avanzadas.' };
  }

  if (info.status === 'trialing') {
    const days = daysUntil(until);
    return {
      title: 'Prueba gratis activa',
      detail: `Termina el ${formatDate(until)} (${days === 1 ? 'queda 1 día' : `quedan ${days} días`}). Podés suscribirte ahora y no perdés los días que te quedan.`,
    };
  }

  const plan = PLAN_NAMES[row?.plan_code] || 'Premium';
  const provider = PROVIDER_NAMES[row?.provider];

  if (info.status === 'cancelled') {
    return {
      title: `Premium ${plan} cancelado`,
      detail: until ? `Mantenés el acceso hasta el ${formatDate(until)}.` : 'Tu acceso sigue vigente.',
    };
  }

  // Las membresías de PayPal activadas a mano no tienen suscripción ni se renuevan.
  const isSubscription = Boolean(row?.provider_subscription_id);
  const renewal = isSubscription && row?.current_period_end
    ? ` Próxima renovación: ${formatDate(new Date(row.current_period_end))}.`
    : until ? ` Vigente hasta el ${formatDate(until)}.` : '';
  const cancelHint = isSubscription ? {
    mercadopago: ' Podés cancelarla cuando quieras desde Mercado Pago → Suscripciones.',
    paypal: ' Podés cancelarla cuando quieras desde PayPal → Configuración → Pagos → Pagos automáticos.',
  }[row?.provider] || '' : '';

  return {
    title: `Premium ${plan} activo`,
    detail: `${provider ? `Pagás con ${provider}.` : ''}${renewal}${cancelHint}`.trim(),
    paid: true,
  };
}

export default function Membresia() {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    getMyMembership(user?.id)
      .then((data) => {
        setInfo(data);
        setError(false);
      })
      .catch(() => setError(true));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="rd-page">
        <PageHeader title="Membresía" />
        <div className="rd-card p-6 text-sm text-muted-foreground">
          No pudimos cargar tu membresía. Intentá de nuevo en unos minutos.
        </div>
      </div>);

  }

  if (!info) {
    return (
      <div className="rd-page">
        <div className="rd-card h-40 animate-pulse" />
      </div>);

  }

  const summary = describeMembership(info);

  return (
    <div className="rd-page space-y-6">
      <PageHeader title="Membresía" />

      <div className="rd-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Crown size={22} className="text-primary" />
        </div>

        <div className="flex-1 space-y-1">
          <h2 className="font-rajdhani font-bold text-xl text-foreground uppercase tracking-tight">
            {summary.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary.detail}</p>
        </div>

        {info.hasAccess &&
        <Link to="/stats">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <BarChart3 size={16} />
              Ir a Estadísticas
            </Button>
          </Link>
        }
      </div>

      {!summary.paid && <MembershipOffer membership={info} onAccessGranted={load} />}
    </div>);

}
