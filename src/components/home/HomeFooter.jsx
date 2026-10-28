import { useState } from 'react';
import LegalInfoModal, { LEGAL_DOCUMENTS } from '@/components/LegalInfoModal';
import logoHorizontalUrl from '@/assets/riftdeck-logo-horizontal.png';
import { useT } from '@/lib/LocaleContext';

const CONTACT_EMAIL = 'riftdeckapp@gmail.com';

export default function HomeFooter() {
  const t = useT();
  const [legalModal, setLegalModal] = useState(null);

  return (
    <footer className="border-t border-primary/10 bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10 land:py-3">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between land:flex-row land:items-center land:justify-between">
          <img src={logoHorizontalUrl} alt="Rift Deck" width="174" height="22" loading="lazy" className="h-[22px] w-auto self-start object-contain" />

          <nav aria-label={t('home.enlacesDelPieDe')}>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {LEGAL_DOCUMENTS.map(({ type, label }) => (
                <li key={type}>
                  <button type="button" onClick={() => setLegalModal(type)} className="text-muted-foreground transition-colors hover:text-primary">
                    {label}
                  </button>
                </li>
              ))}
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-muted-foreground transition-colors hover:text-primary">
                 {t('home.contacto')}
                </a>
              </li>
              <li aria-hidden="true" className="hidden h-4 w-px bg-border md:block" />
              <li><a href="/campeones" className="text-muted-foreground transition-colors hover:text-primary">{t('common.champions')}</a></li>
              <li><a href="/objetos" className="text-muted-foreground transition-colors hover:text-primary">{t('common.items')}</a></li>
              <li><a href="/runas" className="text-muted-foreground transition-colors hover:text-primary">{t('common.runes')}</a></li>
            </ul>
          </nav>
        </div>

        <p className="mt-6 max-w-4xl text-xs leading-relaxed text-muted-foreground/80 md:mt-8 land:mt-2 land:text-[10px] short:mt-4 short:text-[11px]">
         {t('home.riftDeckNoEsta')}
        </p>
      </div>

      {legalModal && <LegalInfoModal type={legalModal} onClose={() => setLegalModal(null)} />}
    </footer>
  );
}
