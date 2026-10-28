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
        <a href="/" className="flex items-center" aria-label={t('nav.home')}>
          <img src={logoHorizontalUrl} alt="Rift Deck" width="174" height="22" className="h-[22px] w-auto object-contain" />
        </a>
        <div className="flex items-center gap-4 text-sm">
          {/* En smartphone ya están las pestañas Campeones / Objetos / Runas de la biblioteca. */}
          <a href="/campeones" className="hidden font-medium text-primary hover:text-primary/80 sm:inline">{t('common.champions')}</a>
          <a href="/objetos" className="hidden font-medium text-primary hover:text-primary/80 sm:inline">{t('common.items')}</a>
          <a href="/runas" className="hidden font-medium text-primary hover:text-primary/80 sm:inline">{t('common.runes')}</a>
          <LanguageSelect compact />
          <button type="button" onClick={() => setLegalOpen(true)} className="text-muted-foreground hover:text-foreground">{t('common.legal')}</button>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">{t('common.login')}</Link>
        </div>
      </nav>
      {legalOpen && <LegalInfoModal type="legal" onClose={() => setLegalOpen(false)} />}
    </header>
  );
}
