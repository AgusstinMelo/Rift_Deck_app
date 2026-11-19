import { useSearchParams } from 'react-router-dom';
import ChampionLibrary from '@/components/library/ChampionLibrary';
import ItemLibrary from '@/components/library/ItemLibrary';
import RuneLibrary from '@/components/library/RuneLibrary';
import LibraryShell, { LIBRARY_TABS } from '@/components/library/LibraryShell';
import { useT } from '@/lib/LocaleContext';

// Biblioteca privada: la misma estructura que la pública (LibraryShell); la pestaña y la
// ficha abierta viven en la URL (?tab=...&id=...).
export default function Library() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab = LIBRARY_TABS.some(tab => tab.id === urlTab) ? urlTab : 'champions';
  const selectedId = searchParams.get('id');

  const setActiveTab = tabId => setSearchParams({ tab: tabId });
  const setSelectedId = id => setSearchParams({ tab: activeTab, id: String(id) });
  const clearSelectedId = () => setSearchParams({ tab: activeTab });

  return (
    <LibraryShell
      kicker={t('library.riftDeckCodex')}
      title={t('nav.library')}
      isDetail={Boolean(selectedId)}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {activeTab === 'champions' && (
        <ChampionLibrary selectedId={selectedId} onSelectId={setSelectedId} onClearSelected={clearSelectedId} />
      )}
      {activeTab === 'items' && (
        <ItemLibrary selectedId={selectedId} onSelectId={setSelectedId} onClearSelected={clearSelectedId} />
      )}
      {activeTab === 'runes' && (
        <RuneLibrary selectedId={selectedId} onSelectId={setSelectedId} onClearSelected={clearSelectedId} />
      )}
    </LibraryShell>
  );
}
