import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import ChampionPicker from '@/components/builds/ChampionPicker';
import BuildWorkspace from '@/components/builds/BuildWorkspace';
import ChampionBuilds from '@/components/builds/ChampionBuilds';
import BuildCompare from '@/components/builds/BuildCompare';
import { getCurrentTierlistEntries } from '@/utils/tierlist';
import { patchMatchesSelection } from '@/utils/patches';
import { getGamePatchCatalog, getPublishedGamePatches } from '@/api/gameCatalogSupabase';

export default function BuildCalculator() {
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [view, setView] = useState('builds'); // 'builds' | 'workspace' | 'compare'
  const [editingBuild, setEditingBuild] = useState(null);
  const [selectedPatch, setSelectedPatch] = useState('');

  const { data: patches = [] } = useQuery({
    queryKey: ['game-patches', 'published'],
    queryFn: getPublishedGamePatches,
  });

  useEffect(() => {
    if (!selectedPatch && patches.length) {
      setSelectedPatch(patches.find(patch => patch.status === 'active')?.version || patches[0].version);
    }
  }, [patches, selectedPatch]);

  const { data: catalog, isError: catalogFailed, error: catalogError } = useQuery({
    queryKey: ['game-patch-catalog', selectedPatch],
    queryFn: () => getGamePatchCatalog(selectedPatch),
    enabled: Boolean(selectedPatch),
  });
  const champions = catalog?.champions || [];
  const items = catalog?.items || [];
  const runes = catalog?.runes || [];

  useEffect(() => {
    if (!selectedChampion || !champions.length) return;
    const patchedChampion = champions.find(champion => String(champion.id) === String(selectedChampion.id));
    if (patchedChampion && patchedChampion.patch_version !== selectedChampion.patch_version) {
      setSelectedChampion(patchedChampion);
    }
  }, [champions, selectedChampion]);

  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const currentSnapshotKey = executions.find(execution =>
    execution.status === 'success' || execution.status === 'partial'
  )?.snapshot_key;

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist-full', currentSnapshotKey],
    queryFn: () => getTierlistEntries('-updated_at', 1000, { snapshotKey: currentSnapshotKey }),
    enabled: !!currentSnapshotKey,
  });

  const handleSelectChampion = (champ) => {
    setSelectedChampion(champ);
    setView('builds');
    setEditingBuild(null);
  };

  const handleBack = () => {
    setSelectedChampion(null);
    setView('builds');
    setEditingBuild(null);
  };

  const handleNewBuild = () => {
    setEditingBuild(null);
    setView('workspace');
  };

  const handleEditBuild = (build) => {
    setEditingBuild(build);
    if (build.patch) setSelectedPatch(build.patch);
    setView('workspace');
  };

  const currentTierlist = getCurrentTierlistEntries(tierlist, executions)
    .filter(entry => !selectedPatch || patchMatchesSelection(entry.patch, selectedPatch));

  if (catalogFailed) {
    return (
      <div className="p-6">
        <div className="rd-card border-red-500/30 p-5 text-sm text-red-300">
          {catalogError?.message || 'No se pudo cargar el catálogo del parche seleccionado.'}
        </div>
      </div>
    );
  }

  if (view === 'compare') {
    return (
      <BuildCompare
        champions={champions}
        items={items}
        patchVersion={selectedPatch}
        onBack={() => setView('builds')}
      />
    );
  }

  if (selectedChampion && view === 'workspace') {
    if (catalog?.patchVersion !== selectedPatch) {
      return <div className="p-6 text-sm text-muted-foreground">Cargando catálogo del parche {selectedPatch}...</div>;
    }
    return (
      <BuildWorkspace
        key={`${selectedPatch}-${editingBuild?.id || 'new'}`}
        champion={selectedChampion}
        tierEntries={currentTierlist}
        items={items}
        runes={runes}
        patches={patches}
        patchVersion={selectedPatch}
        onPatchChange={setSelectedPatch}
        existingBuild={editingBuild}
        onBack={() => { setEditingBuild(null); setView('builds'); }}
      />
    );
  }

  if (selectedChampion && view === 'builds') {
    return (
      <ChampionBuilds
        champion={selectedChampion}
        onNewBuild={handleNewBuild}
        onEditBuild={handleEditBuild}
        onBack={handleBack}
        onCompare={() => setView('compare')}
      />
    );
  }

  return <ChampionPicker champions={champions} tierlist={currentTierlist} onSelect={handleSelectChampion} />;
}
