import { Link } from 'react-router-dom';
import { BookOpen, Sword, Gem, Library as LibraryIcon } from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import { useT } from '@/lib/LocaleContext';

// Mismas pestañas que la biblioteca privada (pages/Library.jsx), como enlaces a cada catálogo.
const TABS = [
  { id: 'champions', to: '/campeones', label: 'common.champions', icon: Sword, desc: 'library.tabs.championsDesc' },
  { id: 'items', to: '/objetos', label: 'common.items', icon: BookOpen, desc: 'library.tabs.itemsDesc' },
  { id: 'runes', to: '/runas', label: 'common.runes', icon: Gem, desc: 'library.tabs.runesDesc' },
];

// Estructura y clases de la biblioteca privada (.rd-main-content > .rd-library-layout), para que
// la pública reciba las mismas adaptaciones al viewport en escritorio y smartphone.
export default function PublicLibraryLayout({ activeTab, isDetail = false, srTitle, children }) {
  const t = useT();
  return (
    <div className="relative z-10 flex h-dvh min-h-0 flex-col text-foreground">
      <PublicHeader />

      <main className="rd-main-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="rd-page rd-dashboard rd-library-layout">
          <div className="rd-library-header flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-px bg-primary/50" />
                <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
                 {t('library.bibliotecaPublica')}
                </span>
              </div>

              <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
               {t('nav.library')}
                {srTitle && <span className="sr-only">: {srTitle}</span>}
              </h1>

              <p className="text-muted-foreground text-sm mt-1">
               {t('library.archivoTacticoDeCampeones')}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-3 rd-status-pill">
              <LibraryIcon size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground">
               {t('library.baseDeConocimiento')}
              </span>
            </div>
          </div>

          <nav className="rd-card rd-library-tabs p-2 w-fit" aria-label={t('library.seccionesDeLaBiblioteca')}>
            <div className="flex flex-wrap gap-1">
              {TABS.map(({ id, to, label, icon: Icon, desc }) => {
                const active = activeTab === id;

                return (
                  <Link
                    key={id}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all
                      ${active
                        ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_18px_rgba(212,175,55,.07)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'}
                    `}
                  >
                    <div
                      className={`
                        w-9 h-9 rounded-lg flex items-center justify-center border
                        ${active
                          ? 'bg-primary/10 border-primary/25'
                          : 'bg-secondary/50 border-border/50'}
                      `}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="text-left">
                      <p className="font-semibold leading-tight">{t(label)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                        {t(desc)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className={`rd-library-content ${isDetail ? 'rd-library-detail' : 'rd-library-catalog'}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
