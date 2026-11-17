import { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalInfoModal from '@/components/LegalInfoModal';
import LanguageSelect from '@/components/LanguageSelect';
import { useT } from '@/lib/LocaleContext';
import logoHorizontalUrl from '@/assets/riftdeck-logo-horizontal.png';

export default function PublicHeader() {
  const [legalOpen, setLegalOpen] = useState(false);
  const t = useT();

  return (
    <header className="border-b border-primary/10 bg-card/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-3 py-2.5 md:px-5" aria-label={t('nav.publicNav')}>
        {/* En smartphone el logo va más chico y el idioma solo con la bandera: si no, en
            360-420 px el logo se pisaba con el selector de idioma. */}
        <a href="/" className="flex shrink-0 items-center" aria-label={t('nav.home')}>
          <img src={logoHorizontalUrl} alt="Rift Deck" width="174" height="22" className="h-[16px] w-auto object-contain min-[400px]:h-[18px] sm:h-[22px]" />
        </a>
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap text-[13px] sm:gap-4 sm:text-sm">
          {/* En smartphone ya están las pestañas Campeones / Objetos / Runas de la biblioteca. */}
          <a href="/campeones" className="hidden font-medium text-primary hover:text-primary/80 md:inline">{t('common.champions')}</a>
          <a href="/objetos" className="hidden font-medium text-primary hover:text-primary/80 md:inline">{t('common.items')}</a>
          <a href="/runas" className="hidden font-medium text-primary hover:text-primary/80 md:inline">{t('common.runes')}</a>
          <LanguageSelect flagOnly className="sm:hidden" />
          <LanguageSelect compact className="hidden sm:block" />
          <button type="button" onClick={() => setLegalOpen(true)} className="text-muted-foreground hover:text-foreground">{t('common.legal')}</button>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">{t('common.login')}</Link>
        </div>
      </nav>
      {legalOpen && <LegalInfoModal type="legal" onClose={() => setLegalOpen(false)} />}
    </header>
  );
}
