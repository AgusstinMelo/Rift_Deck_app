import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { daysUntil, getMyMembership } from '@/api/membershipSupabase';
import { MembershipOffer } from '@/components/membership/MembershipGate';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { BarChart3, Crown } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';
import { formatLocale, labels, tr } from '@/i18n/uiI18n';

const PLAN_NAMES = labels({
  premium: 'membership.plans.premium',
  premium_quarterly: 'membership.plans.premium_quarterly',
  premium_annual: 'membership.plans.premium_annual',
  trial: 'membership.plans.trial',
});

const PROVIDER_NAMES = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
};

function formatDate(date) {
  return date?.toLocaleDateString(formatLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

function describeMembership(info) {
  const row = info.membership;
  const until = info.accessUntil;

  if (!info.hasAccess) {
    return { title: tr('membership.noTenesUnaMembresia'), detail: tr('membership.elegiUnPlanPara') };
  }

  if (info.status === 'trialing') {
    const days = daysUntil(until);
    return {
      title: tr('membership.pruebaGratisActiva'),
      detail: tr('membership.terminaElPodesSuscribirte', { formatDate: formatDate(until), value: days === 1 ? tr('membership.queda1Dia') : tr('membership.quedanDias', { days }) }),
    };
  }

  const plan = PLAN_NAMES[row?.plan_code] || tr('membership.premium');
  const provider = PROVIDER_NAMES[row?.provider];

  if (info.status === 'cancelled') {
    return {
      title: tr('membership.premiumCancelado', { plan }),
      detail: until ? tr('membership.mantenesElAccesoHasta', { formatDate: formatDate(until) }) : tr('membership.tuAccesoSigueVigente'),
    };
  }

  // Las membresías de PayPal activadas a mano no tienen suscripción ni se renuevan.
  const isSubscription = Boolean(row?.provider_subscription_id);
  const renewal = isSubscription && row?.current_period_end
    ? tr('membership.proximaRenovacion', { formatDate: formatDate(new Date(row.current_period_end)) })
    : until ? tr('membership.vigenteHastaEl', { formatDate: formatDate(until) }) : '';
  const cancelHint = isSubscription ? {
    mercadopago: tr('membership.podesCancelarlaCuandoQuieras'),
    paypal: tr('membership.podesCancelarlaCuandoQuieras2'),
  }[row?.provider] || '' : '';

  return {
    title: tr('membership.premiumActivo', { plan }),
    detail: `${provider ? tr('membership.pagasCon', { provider }) : ''}${renewal}${cancelHint}`.trim(),
    paid: true,
  };
}

export default function Membresia() {
  const t = useT();
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
        <PageHeader title={t('membership.membresia')} />
        <div className="rd-card p-6 text-sm text-muted-foreground">
         {t('membership.noPudimosCargarTu')}
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
      <PageHeader title={t('membership.membresia')} />

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
             {t('membership.irAEstadisticas')}
            </Button>
          </Link>
        }
      </div>

      {!summary.paid && <MembershipOffer membership={info} onAccessGranted={load} />}
    </div>);

}
