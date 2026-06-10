import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import ChampionPicker from '@/components/builds/ChampionPicker';
import BuildWorkspace from '@/components/builds/BuildWorkspace';
import ChampionBuilds from '@/components/builds/ChampionBuilds';
import BuildCompare from '@/components/builds/BuildCompare';
import { getCurrentTierlistEntries } from '@/utils/tierlist';

export default function BuildCalculator() {
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [view, setView] = useState('builds'); // 'builds' | 'workspace' | 'compare'
  const [editingBuild, setEditingBuild] = useState(null);

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist-full'],
    queryFn: () => getTierlistEntries('-updated_at', 1000),
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['writems'],
    queryFn: () => WRItem.list('name'),
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
    setView('workspace');
  };

  const currentTierlist = getCurrentTierlistEntries(tierlist, executions);

  if (view === 'compare') {
    return (
      <BuildCompare
        champions={champions}
        items={items}
        onBack={() => setView('builds')}
      />
    );
  }

  if (selectedChampion && view === 'workspace') {
    return (
      <BuildWorkspace
        champion={selectedChampion}
        tierEntries={currentTierlist}
        items={items}
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

  return (
    <ChampionPicker
      champions={champions}
      tierlist={currentTierlist}
      onSelect={handleSelectChampion}
    />
  );
}
