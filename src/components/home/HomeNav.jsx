import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Menu, X } from 'lucide-react';
import logoHorizontalUrl from '@/assets/riftdeck-logo-horizontal.png';
import { tr } from '@/i18n/uiI18n';
import { useT } from '@/lib/LocaleContext';
import LanguageSelect from '@/components/LanguageSelect';

// En el orden de las secciones de la home.
export const HOME_ANCHORS = [
  { href: '#inicio', get label() { return tr('home.anchors.inicio'); } },
  { href: '#asi-se-ve', get label() { return tr('home.anchors.asiSeVe'); } },
  { href: '#como-funciona', get label() { return tr('home.anchors.comoFunciona'); } },
  { href: '#progreso', get label() { return tr('home.anchors.progreso'); } },
  { href: '#coach', get label() { return tr('home.anchors.coach'); } },
  { href: '#preguntas', get label() { return tr('home.anchors.preguntas'); } },
  { href: '#empieza', get label() { return tr('home.anchors.empieza'); } },
];

export default function HomeNav() {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/75 backdrop-blur-md">
      <nav className="rd-home-nav mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6" aria-label={t('home.navegacionPrincipal')}>
        <a href="#inicio" className="flex shrink-0 items-center" aria-label={t('nav.home')}>
          <img src={logoHorizontalUrl} alt="Rift Deck" width="174" height="22" className="h-[22px] w-auto object-contain" />
        </a>

        <ul className="hidden items-center gap-5 text-sm lg:flex xl:gap-7">
          {HOME_ANCHORS.map(({ href, label }) => (
            <li key={href}>
              <a href={href} className="text-muted-foreground transition-colors hover:text-primary">{label}</a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <LanguageSelect flagOnly />
            <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/login"
              className="whitespace-nowrap rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
             {t('home.iniciarSesion')}
            </Link>
            <Link
              to="/registro"
              className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
             {t('home.crearCuenta')}
            </Link>
            </div>

          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="home-mobile-menu"
            aria-label={menuOpen ? t('home.cerrarMenu') : t('nav.openMenu')}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="home-mobile-menu"
          className="absolute inset-x-0 top-full max-h-[calc(100svh-var(--home-nav-h))] overflow-y-auto border-y border-primary/10 bg-background px-4 pb-5 pt-2 shadow-2xl backdrop-blur-md lg:hidden"
        >
          <ul className="flex flex-col">
            {HOME_ANCHORS.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-border/50 py-3 text-sm text-foreground land:py-2.5"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <a href="/campeones" className="mt-3 flex items-center gap-2 py-2 text-sm text-primary land:mt-1">
            <BookOpen size={16} aria-hidden="true" />
           {t('home.bibliotecaPublica')}
          </a>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/login" className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground">
             {t('home.iniciarSesion')}
            </Link>
            <Link to="/registro" className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">
             {t('home.crearCuenta')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
