import { Check, ExternalLink, Gift, Smartphone } from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import HomeFooter from '@/components/home/HomeFooter';
import Seo from '@/components/Seo';
import { TESTERS_SEO } from '@/seo/publicSeo';
import { useT } from '@/lib/LocaleContext';

// Página para sumar testers a la prueba cerrada de Google Play: Play exige 12 testers
// durante 14 días antes de publicar. El tester tiene que unirse al grupo con la misma cuenta
// de Google de Play Store; recién ahí la invitación le muestra "Convertirse en verificador".
const GROUP_URL = 'https://groups.google.com/g/riftdeck-testers';
const OPT_IN_URL = 'https://play.google.com/apps/testing/com.riftdeckapp.app';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.riftdeckapp.app';
const CONTACT_EMAIL = 'riftdeckapp@gmail.com';

const STEPS = [
  { id: 'group', url: GROUP_URL },
  { id: 'optIn', url: OPT_IN_URL },
  { id: 'install', url: PLAY_URL },
];
const TRY_ITEMS = ['matches', 'stats', 'coach', 'library', 'feedback'];
const FAQ = ['notFound', 'pay', 'iphone', 'leave', 'bugs'];

export default function PublicTesters() {
  const t = useT();

  return (
    <div className="relative z-10 flex min-h-dvh flex-col text-foreground">
      <Seo {...TESTERS_SEO} indexable />
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <header>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <span className="h-px w-8 bg-primary/60" aria-hidden="true" />
            {t('testers.kicker')}
          </p>
          <h1 className="mt-3 font-rajdhani text-4xl font-bold uppercase leading-none tracking-[-0.04em] md:text-5xl">
            {t('testers.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t('testers.intro')}</p>
        </header>

        <section className="rd-card mt-6 flex gap-4 border-primary/40 p-5" aria-labelledby="testers-reward">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
            <Gift size={20} />
          </span>
          <div>
            <h2 id="testers-reward" className="font-rajdhani text-xl font-bold text-primary">{t('testers.reward.title')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('testers.reward.text')}</p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="testers-steps">
          <h2 id="testers-steps" className="font-rajdhani text-2xl font-bold uppercase">{t('testers.stepsTitle')}</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.id} className="rd-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-rajdhani text-lg font-bold text-primary-foreground" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{t(`testers.steps.${step.id}.title`)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`testers.steps.${step.id}.text`)}</p>
                  </div>
                </div>
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  {t(`testers.steps.${step.id}.cta`)}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Smartphone size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t('testers.sameAccount')}
          </p>
        </section>

        <section className="mt-10" aria-labelledby="testers-try">
          <h2 id="testers-try" className="font-rajdhani text-2xl font-bold uppercase">{t('testers.tryTitle')}</h2>
          <ul className="mt-4 space-y-2">
            {TRY_ITEMS.map(id => (
              <li key={id} className="flex items-start gap-3 text-sm leading-relaxed">
                <Check size={16} className="mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
                {t(`testers.try.${id}`)}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="testers-faq">
          <h2 id="testers-faq" className="font-rajdhani text-2xl font-bold uppercase">{t('testers.faqTitle')}</h2>
          <div className="mt-4 space-y-2">
            {FAQ.map(id => (
              <details key={id} className="rd-card group p-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                  {t(`testers.faq.${id}.q`)}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`testers.faq.${id}.a`, { email: CONTACT_EMAIL })}
                </p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t('testers.thanks')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>
        </p>
      </main>

      <HomeFooter />
    </div>
  );
}
