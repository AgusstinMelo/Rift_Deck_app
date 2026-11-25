import { useState } from 'react';
import { Check, ExternalLink, Gift, Smartphone } from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import HomeFooter from '@/components/home/HomeFooter';
import Seo from '@/components/Seo';
import { TESTERS_SEO } from '@/seo/publicSeo';
import { useSwipeTabs } from '@/hooks/useSwipeTabs';
import { useT } from '@/lib/LocaleContext';

// Página para sumar testers a la prueba cerrada de Google Play: Play exige 12 testers
// durante 14 días antes de publicar. El tester tiene que unirse al grupo con la misma cuenta
// de Google de Play Store; recién ahí la invitación le muestra "Convertirse en verificador".
//
// Entra en la pantalla: en escritorio, dos columnas (pasos | qué probar y preguntas); en el
// celular, "Cómo sumarte" / "Qué probar" / "Preguntas" van en pestañas (también deslizables).
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
const INFO_TABS = ['steps', 'try', 'faq'];
// En el celular las pestañas llevan nombres cortos: tres entran en 360 px.
const TAB_TITLES = { steps: 'testers.stepsTitle', try: 'testers.tryTitle', faq: 'testers.faqShort' };

const SECTION_TITLE = 'font-rajdhani text-lg font-bold uppercase lg:text-xl';

export default function PublicTesters() {
  const t = useT();
  const [infoTab, setInfoTab] = useState('steps');
  const swipe = useSwipeTabs({ ids: INFO_TABS, active: infoTab, onChange: setInfoTab });
  // En escritorio se ven todas las secciones; en el celular, solo la de la pestaña elegida.
  const panelClass = id => (infoTab === id ? '' : 'hidden lg:block');

  return (
    <div className="relative z-10 flex min-h-dvh flex-col text-foreground">
      <Seo {...TESTERS_SEO} indexable />
      <PublicHeader />

      <main {...swipe} className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-5 px-4 py-5 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.15fr_1fr] lg:content-center lg:gap-10 lg:px-6 lg:py-6">
        <div className="flex flex-col gap-4">
          <header>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary lg:text-[11px]">
              <span className="h-px w-8 bg-primary/60" aria-hidden="true" />
              {t('testers.kicker')}
            </p>
            <h1 className="mt-2 font-rajdhani text-[25px] font-bold uppercase leading-none min-[380px]:text-[28px] tracking-[-0.04em] lg:text-[44px]">
              {t('testers.title')}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground min-[380px]:text-sm lg:mt-3 lg:text-base">{t('testers.intro')}</p>
          </header>

          <section className="rd-card flex gap-3 border-primary/40 p-3 lg:gap-4 lg:p-4" aria-labelledby="testers-reward">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary lg:h-10 lg:w-10" aria-hidden="true">
              <Gift size={18} />
            </span>
            <div>
              <h2 id="testers-reward" className="font-rajdhani text-base font-bold text-primary lg:text-lg">{t('testers.reward.title')}</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground lg:hidden">{t('testers.reward.short')}</p>
              <p className="mt-0.5 hidden text-sm leading-relaxed text-muted-foreground lg:block">{t('testers.reward.text')}</p>
            </div>
          </section>

          <div className="rd-panel-tabs lg:hidden" role="tablist" aria-label={t('testers.title')}>
            {INFO_TABS.map(id => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={infoTab === id}
                onClick={() => setInfoTab(id)}
                className={`rd-panel-tab flex-1 ${infoTab === id ? 'rd-panel-tab-active' : ''}`}
              >
                {t(TAB_TITLES[id])}
              </button>
            ))}
          </div>

          <section className={panelClass('steps')} aria-labelledby="testers-steps">
            <h2 id="testers-steps" className={`${SECTION_TITLE} hidden lg:block`}>{t('testers.stepsTitle')}</h2>
            <ol className="space-y-2 lg:mt-2">
              {STEPS.map((step, index) => (
                <li key={step.id}>
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rd-card group flex items-center gap-3 p-3 transition-colors hover:border-primary/50"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-rajdhani text-base font-bold text-primary-foreground" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(`testers.steps.${step.id}.title`)}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t(`testers.steps.${step.id}.text`)}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 p-2 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/20 lg:px-3">
                      <span className="hidden lg:inline">{t(`testers.steps.${step.id}.cta`)}</span>
                      <ExternalLink size={14} aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-2 flex items-start gap-2 text-[11px] leading-snug text-muted-foreground lg:text-xs">
              <Smartphone size={13} className="mt-px shrink-0" aria-hidden="true" />
              {t('testers.sameAccount')}
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4 lg:gap-6">

          <section className={panelClass('try')} aria-labelledby="testers-try">
            <h2 id="testers-try" className={`${SECTION_TITLE} hidden lg:block`}>{t('testers.tryTitle')}</h2>
            <ul className="space-y-2 lg:mt-3">
              {TRY_ITEMS.map(id => (
                <li key={id} className="flex items-start gap-2.5 text-sm leading-snug">
                  <Check size={16} className="mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
                  {t(`testers.try.${id}`)}
                </li>
              ))}
            </ul>
          </section>

          <section className={panelClass('faq')} aria-labelledby="testers-faq">
            <h2 id="testers-faq" className={`${SECTION_TITLE} hidden lg:block`}>{t('testers.faqTitle')}</h2>
            <div className="space-y-1.5 lg:mt-3">
              {FAQ.map(id => (
                <details key={id} className="rd-card group px-3 py-2.5">
                  <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
                    <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                    {t(`testers.faq.${id}.q`)}
                  </summary>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t(`testers.faq.${id}.a`, { email: CONTACT_EMAIL })}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            {t('testers.thanks')}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
