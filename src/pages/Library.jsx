import { useSearchParams } from 'react-router-dom';
import { BookOpen, Sword, Gem, Library as LibraryIcon } from 'lucide-react';
import ChampionLibrary from '@/components/library/ChampionLibrary';
import ItemLibrary from '@/components/library/ItemLibrary';
import RuneLibrary from '@/components/library/RuneLibrary';

const tabs = [
  { id: 'champions', label: 'Campeones', icon: Sword, desc: 'Pool completo' },
  { id: 'items', label: 'Objetos', icon: BookOpen, desc: 'Build assets' },
  { id: 'runes', label: 'Runas', icon: Gem, desc: 'Setup táctico' },
];

export default function Library() {
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
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Rift Deck Codex
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Biblioteca
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Archivo táctico de campeones, objetos y runas.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 rd-status-pill">
          <LibraryIcon size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            Base de conocimiento
          </span>
        </div>
      </div>

      <div className="rd-card p-2 w-fit">
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
                  <p className="font-semibold leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                    {desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
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
