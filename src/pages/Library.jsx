import { useSearchParams } from 'react-router-dom';
import { BookOpen, Sword, Gem, Library as LibraryIcon } from 'lucide-react';
import ChampionLibrary from '@/components/library/ChampionLibrary';
import ItemLibrary from '@/components/library/ItemLibrary';
import RuneLibrary from '@/components/library/RuneLibrary';
import { useT } from '@/lib/LocaleContext';

const tabs = [
  { id: 'champions', label: 'common.champions', icon: Sword, desc: 'library.tabs.championsDesc' },
  { id: 'items', label: 'common.items', icon: BookOpen, desc: 'library.tabs.itemsDesc' },
  { id: 'runes', label: 'common.runes', icon: Gem, desc: 'library.tabs.runesDesc' },
];

export default function Library() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab = tabs.some(tab => tab.id === urlTab) ? urlTab : 'champions';
  const selectedId = searchParams.get('id');

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const setSelectedId = (id) => {
    setSearchParams({ tab: activeTab, id: String(id) });
  };

  const clearSelectedId = () => {
    setSearchParams({ tab: activeTab });
  };

  return (
    <div className="rd-page rd-dashboard rd-library-layout">
      <div className="rd-library-header flex items-start justify-between gap-4">
        <div>
          <div className="rd-page-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              {t('library.riftDeckCodex')}
            </span>
          </div>

          <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            {t('nav.library')}
          </h1>

          <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">
            {t('library.archivoTacticoDeCampeones2')}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 rd-status-pill">
          <LibraryIcon size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            {t('library.baseDeConocimiento')}
          </span>
        </div>
      </div>

      <div className="rd-card rd-library-tabs p-2 w-fit">
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ id, label, icon: Icon, desc }) => {
            const active = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
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
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rd-library-content ${selectedId ? 'rd-library-detail' : 'rd-library-catalog'}`}>
        {activeTab === 'champions' && (
          <ChampionLibrary
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onClearSelected={clearSelectedId}
          />
        )}
        {activeTab === 'items' && (
          <ItemLibrary
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onClearSelected={clearSelectedId}
          />
        )}
        {activeTab === 'runes' && (
          <RuneLibrary
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onClearSelected={clearSelectedId}
          />
        )}
      </div>
    </div>
  );
}
