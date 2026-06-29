import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Champion, WRItem, Rune } from '@/api/entitiesSupabase';
import { updateMatch } from '@/api/matchesSupabase';
import { ArrowLeft, Save, Search } from 'lucide-react';
import ItemPool from '@/components/builds/ItemPool';
import ItemBrowser from '@/components/builds/ItemBrowser';
import { PRESET_MATCH_TAGS } from '@/components/matches/matchTags';

import { useSpells } from '@/hooks/useSpells';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];
const STEPS = ['info', 'champion', 'allies', 'enemies', 'build', 'stats'];

const cleanTags = (tagList) =>
  [...new Set(tagList.map(tag => tag.trim()).filter(Boolean))];

const getChampionNamesByRole = (selected) =>
  LANES
    .map(role => selected.find(champion => champion.role === role)?.name)
    .filter(Boolean);

const ROLE_LABELS = {
  top: 'Top',
  jungler: 'Jungla',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Support',
};

function resolveChampion(champions, name) {
  return champions.find(c => c.name === name) || null;
}

function buildTeamSlots({ champions, names = [], ownName, ownLane, directEnemyName, includeOwn = false }) {
  const slots = [];
  const used = new Set();

  if (includeOwn && ownName) {
    const ownChampion = resolveChampion(champions, ownName);
    slots.push({ ...(ownChampion || { name: ownName }), role: ownLane || 'adc' });
    used.add(ownName);
  }

  if (directEnemyName && ownLane) {
    const directEnemy = resolveChampion(champions, directEnemyName);
    slots.push({ ...(directEnemy || { name: directEnemyName }), role: ownLane });
    used.add(directEnemyName);
  }

  const freeRoles = LANES.filter(role => !slots.some(champ => champ.role === role));
  names
    .filter(Boolean)
    .filter(name => !used.has(name))
    .slice(0, freeRoles.length)
    .forEach((name, index) => {
      const champ = resolveChampion(champions, name);
      slots.push({ ...(champ || { name }), role: freeRoles[index] });
      used.add(name);
    });

  return slots;
}

function ChampionPoolByRole({ champions, title, selected, onSelect, lockedRole }) {
  const [search, setSearch] = useState('');
  const filteredChampions = champions.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  const selectedByRole = {};
  LANES.forEach(role => {
    selectedByRole[role] = selected.find(s => s.role === role);
  });

  return (
    <div className="rd-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-px bg-primary/50" />
          <h3 className="rd-card-title">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{selected.length}/{LANES.length}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-2 pb-4 border-b border-border lg:border-b-0 lg:pb-0">
          {LANES.map(role => {
            const champ = selectedByRole[role];
            const locked = lockedRole === role;
            return (
              <div key={role} className="flex items-center gap-3">
                <div className="w-16 text-xs font-semibold text-muted-foreground">{ROLE_LABELS[role]}</div>
                <div className="relative w-11 h-11 rounded-lg border-2 border-border bg-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                  {champ ? (
                    <>
                      {champ.image_url
                        ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                        : <span className="text-xs font-bold text-primary">{champ.name?.[0]}</span>}
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => onSelect(champ, role)}
                          className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 flex items-center justify-center transition-opacity text-sm text-foreground cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xl text-muted-foreground opacity-30">+</span>
                  )}
                </div>
                <div className="flex-1 text-xs text-foreground">
                  {champ ? champ.name : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="min-w-0">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campeón..."
              className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
            />
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-60 md:max-h-[calc(100vh-26rem)] overflow-y-auto pr-1">
            {filteredChampions.map(champ => {
              const selectedRole = Object.keys(selectedByRole).find(role => selectedByRole[role]?.name === champ.name);
              const isSelected = Boolean(selectedRole);
              return (
                <button
                  key={champ.id || champ.name}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      if (selectedRole !== lockedRole) onSelect(selectedByRole[selectedRole], selectedRole);
                      return;
                    }
                    const firstEmptyRole = LANES.find(role => role !== lockedRole && !selectedByRole[role]);
                    if (firstEmptyRole) onSelect(champ, firstEmptyRole);
                  }}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all overflow-hidden
                    ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-border/40 hover:border-primary/50'}`}
                >
                  {champ.image_url
                    ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-primary">{champ.name?.[0]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MatchForm({ match, defaultPatch = '', onClose, onSaved }) {
  const [step, setStep] = useState('info');

  // Champion & composition
  const [lane, setLane] = useState(match?.lane || '');
  const [ownChampion, setOwnChampion] = useState(null); // will init after data loads
  const [champSearch, setChampSearch] = useState('');
  const [allyChampions, setAllyChampions] = useState([]);
  const [enemyChampions, setEnemyChampions] = useState([]);
  const [alliesChanged, setAlliesChanged] = useState(false);
  const [enemiesChanged, setEnemiesChanged] = useState(false);

  // Build
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedRunes, setSelectedRunes] = useState([]);
  const [selectedSpells, setSelectedSpells] = useState(match?.spells_used || []);
  const [primaryBranch, setPrimaryBranch] = useState('Dominación');
  const [secondaryBranch, setSecondaryBranch] = useState('Precisión');
  const [runesInitialized, setRunesInitialized] = useState(false);

  // Stats
  const [result, setResult] = useState(match?.result || 'win');
  const [kills, setKills] = useState(match?.kills ?? '');
  const [deaths, setDeaths] = useState(match?.deaths ?? '');
  const [assists, setAssists] = useState(match?.assists ?? '');
  const [gold, setGold] = useState(match?.gold ?? '');
  const [duration, setDuration] = useState(match?.duration_minutes ?? '');
  const [side, setSide] = useState(match?.side || '');
  const [patch, setPatch] = useState(match?.patch || defaultPatch);
  const patchWasEdited = useRef(false);

  useEffect(() => {
    if (!match?.patch && defaultPatch && !patch && !patchWasEdited.current) {
      setPatch(defaultPatch);
    }
  }, [defaultPatch, match?.patch, patch]);
  const [date, setDate] = useState(match?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [hour, setHour] = useState(match?.hour || '');
  const [notes, setNotes] = useState(match?.notes || '');
  const [tags, setTags] = useState(match?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const { data: spells = [] } = useSpells();

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => WRItem.list('category'),
  });

  const { data: runes = [] } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('branch'),
  });

  // Initialize champion/items/runes from match data once data is loaded
  const [initialized, setInitialized] = useState(false);
  if (!initialized && champions.length > 0 && items.length > 0 && runes.length > 0) {
    const initialOwnChampion = match?.own_champion_name
      ? champions.find(c => c.name === match.own_champion_name) || null
      : null;

    if (initialOwnChampion) setOwnChampion(initialOwnChampion);
    setAllyChampions(buildTeamSlots({
      champions,
      names: match?.ally_champions || [],
      ownName: match?.own_champion_name,
      ownLane: match?.lane,
      includeOwn: true,
    }));
    setEnemyChampions(buildTeamSlots({
      champions,
      names: match?.enemy_champions || [],
      ownLane: match?.lane,
      directEnemyName: match?.enemy_champion_name,
    }));
    if (match?.items_used?.length > 0) setSelectedItems(match.items_used.map(n => items.find(i => i.name === n)).filter(Boolean));
    if (match?.runes_used?.length > 0) {
      const resolvedRunes = match.runes_used.map(n => runes.find(r => r.name === n)).filter(Boolean);
      setSelectedRunes(resolvedRunes);

      // Detect and restore primary/secondary branches from saved runes
      if (!runesInitialized) {
        const nonClaveRunes = resolvedRunes.filter(r => r.branch !== 'Clave');
        const branches = [...new Set(nonClaveRunes.map(r => r.branch))];
        const detectedPrimary = branches[0] || 'Dominación';
        const detectedSecondary = branches[1] || PRIMARY_BRANCHES.find(b => b !== detectedPrimary);
        setPrimaryBranch(detectedPrimary);
        setSecondaryBranch(detectedSecondary);
        setRunesInitialized(true);
      }
    }
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data) => updateMatch(match.id, data),
    onSuccess: onSaved,
  });

  const handleOwnChampionSelect = (champ) => {
    setOwnChampion(champ);
    setAlliesChanged(true);
    setAllyChampions(prev => [
      ...prev.filter(ally => ally.role !== lane && ally.name !== champ.name),
      { ...champ, role: lane || 'adc' },
    ]);
    setChampSearch('');
  };

  const handleLaneSelect = (nextLane) => {
    const resolvedLane = nextLane === lane ? '' : nextLane;
    setLane(resolvedLane);

    if (ownChampion && resolvedLane) {
      setAlliesChanged(true);
      setAllyChampions(prev => [
        ...prev.filter(ally => ally.name !== ownChampion.name && ally.role !== resolvedLane),
        { ...ownChampion, role: resolvedLane },
      ]);
    }
  };

  const handleSelectAlly = (champ, role) => {
    if (role === lane) return;

    setAlliesChanged(true);
    setAllyChampions(prev => {
      const isAlreadyInRole = prev.find(c => c.role === role && c.name === champ.name);
      if (isAlreadyInRole) return prev.filter(c => c.role !== role);

      return [
        ...prev.filter(c => c.role !== role && c.name !== champ.name),
        { ...champ, role },
      ];
    });
  };

  const handleSelectEnemy = (champ, role) => {
    setEnemiesChanged(true);
    setEnemyChampions(prev => {
      const isAlreadyInRole = prev.find(c => c.role === role && c.name === champ.name);
      if (isAlreadyInRole) return prev.filter(c => c.role !== role);

      return [
        ...prev.filter(c => c.role !== role && c.name !== champ.name),
        { ...champ, role },
      ];
    });
  };

  const handleSave = () => {
    const directEnemy = enemyChampions.find(enemy => enemy.role === lane);

    saveMutation.mutate({
      lane,
      own_champion_name: ownChampion?.name || match?.own_champion_name || '',
      own_champion_id: ownChampion?.id || match?.own_champion_id || '',
      ally_champions: alliesChanged
        ? getChampionNamesByRole(allyChampions)
        : (match?.ally_champions || []),
      enemy_champions: enemiesChanged
        ? getChampionNamesByRole(enemyChampions)
        : (match?.enemy_champions || []),
      enemy_champion_name: directEnemy?.name || '',
      enemy_champion_id: directEnemy?.id || '',
      items_used: selectedItems.map(i => i.name),
      runes_used: selectedRunes.map(r => r.name),
      spells_used: selectedSpells,
      result,
      kills: kills !== '' ? Number(kills) : 0,
      deaths: deaths !== '' ? Number(deaths) : 0,
      assists: assists !== '' ? Number(assists) : 0,
      gold: gold !== '' ? Number(gold) : null,
      duration_minutes: duration !== '' ? Number(duration) : null,
      side: side || null,
      patch,
      date,
      hour: hour || null,
      notes,
      tags: cleanTags([...tags, tagInput]),
    });
  };

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;

    setTags(prev => {
      const exists = prev.some(tag => tag.toLowerCase() === nextTag.toLowerCase());
      return exists ? prev : [...prev, nextTag];
    });
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const togglePresetTag = (presetTag) => {
    setTags(prev => {
      const selectedTag = prev.find(tag => tag.toLowerCase() === presetTag.toLowerCase());
      return selectedTag
        ? prev.filter(tag => tag !== selectedTag)
        : [...prev, presetTag];
    });
  };

  const toggleSpell = (spell) => {
    if (selectedSpells.includes(spell)) setSelectedSpells(prev => prev.filter(s => s !== spell));
    else if (selectedSpells.length < 2) setSelectedSpells(prev => [...prev, spell]);
  };

  const addItem = (item) => {
    if (selectedItems.length >= 6) return;

    const alreadySelected = selectedItems.some(i => i.id === item.id);
    if (alreadySelected) return;

    setSelectedItems(prev => [...prev, item]);
  };

  const removeItem = (index) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Rune helpers
  const claveRunes = runes.filter(r => r.branch === 'Clave');
  const otherRunes = runes.filter(r => r.branch !== 'Clave');
  const getRunesByBranch = (branch) => otherRunes.filter(r => r.branch === branch).sort((a, b) => (a.group || 0) - (b.group || 0));
  const groupRunes = (list) => {
    const grouped = {};
    for (const rune of list) {
      const g = rune.group || 1;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(rune);
    }
    return grouped;
  };
  const isRuneSelected = (rune) => selectedRunes.some(r => r.id === rune.id);
  const primaryRunes = getRunesByBranch(primaryBranch);
  const secondaryRunes = getRunesByBranch(secondaryBranch);

  const handlePrimaryBranchChange = (newPrimary) => {
    if (newPrimary === secondaryBranch) {
      setSelectedRunes(prev => prev.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary));
      setSecondaryBranch(PRIMARY_BRANCHES.find(b => b !== newPrimary));
    } else {
      setSelectedRunes(prev => prev.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary));
    }
    setPrimaryBranch(newPrimary);
  };

  const handleSecondaryBranchChange = (newSecondary) => {
    if (newSecondary === primaryBranch) {
      setSelectedRunes(prev => prev.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary));
      setPrimaryBranch(PRIMARY_BRANCHES.find(b => b !== newSecondary));
    } else {
      setSelectedRunes(prev => prev.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary));
    }
    setSecondaryBranch(newSecondary);
  };

  const handleTogglePrimaryRune = (rune) => {
    if (isRuneSelected(rune)) { setSelectedRunes(prev => prev.filter(r => r.id !== rune.id)); return; }
    const selectedPrimary = selectedRunes.filter(r => r.branch === primaryBranch);
    const sameGroup = selectedPrimary.find(r => r.group === rune.group);
    if (sameGroup) setSelectedRunes(prev => prev.filter(r => r.id !== sameGroup.id));
    else if (selectedPrimary.length >= 3) setSelectedRunes(prev => prev.filter(r => r.id !== selectedPrimary[0].id));
    setSelectedRunes(prev => [...prev, rune]);
  };

  const handleToggleSecondaryRune = (rune) => {
    if (isRuneSelected(rune)) { setSelectedRunes(prev => prev.filter(r => r.id !== rune.id)); return; }
    const selectedSecondary = selectedRunes.filter(r => r.branch === secondaryBranch);
    if (selectedSecondary.length > 0) setSelectedRunes(prev => prev.filter(r => r.id !== selectedSecondary[0].id));
    setSelectedRunes(prev => [...prev, rune]);
  };

  const filteredChamps = champions.filter(c => !champSearch || c.name?.toLowerCase().includes(champSearch.toLowerCase()));

  const stepIndex = STEPS.indexOf(step);

  return (
    <div>
      <button onClick={onClose} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="font-rajdhani font-bold text-3xl text-foreground mb-4">Editar Partida</h1>

      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${stepIndex >= i ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>

      {/* ── STEP 0: INFO ── */}
      {step === 'info' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Fecha y parche</h2>
            <p className="text-muted-foreground text-sm">¿Cuándo jugaste y en qué parche?</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Hora (opcional)</label>
              <input type="time" value={hour} onChange={e => setHour(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Parche</label>
              <input value={patch} onChange={e => {
                patchWasEdited.current = true;
                setPatch(e.target.value);
              }} placeholder="ej: 5.3"
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
          </div>
          <button onClick={() => setStep('champion')}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Siguiente
          </button>
        </div>
      )}

      {/* ── STEP 1: CAMPEONES ── */}
      {step === 'champion' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Campeón y línea</h2>
            <p className="text-muted-foreground text-sm">Seleccioná tu campeón, línea y el enemigo directo</p>
          </div>

          {/* Lane */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium block mb-2">Línea</label>
            <div className="grid grid-cols-5 gap-2">
              {LANES.map(l => (
                <button key={l} type="button" onClick={() => handleLaneSelect(l)}
                  className={`py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${lane === l ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* My Champion */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium block mb-2">Mi Campeón</label>
            {ownChampion && (
              <div className="flex items-center gap-3 mb-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {ownChampion.image_url ? <img src={ownChampion.image_url} alt={ownChampion.name} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center font-bold text-primary">{ownChampion.name[0]}</span>}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{ownChampion.name}</p>
                  <p className="text-xs text-muted-foreground">{ownChampion.roles}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAllyChampions(prev => prev.filter(ally => ally.name !== ownChampion.name));
                    setOwnChampion(null);
                  }}
                  className="text-muted-foreground hover:text-red-400 text-lg"
                >
                  ×
                </button>
              </div>
            )}
            <input value={champSearch} onChange={e => setChampSearch(e.target.value)} placeholder="Buscar campeón..."
              className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all mb-2" />
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 max-h-[calc(100vh-34rem)] overflow-y-auto p-1">
              {filteredChamps.map(champ => (
                <button key={champ.id} type="button" onClick={() => handleOwnChampionSelect(champ)}
                  className={`w-12 h-12 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all
                    ${ownChampion?.id === champ.id ? 'border-primary ring-2 ring-primary/40' : 'border-border/40 hover:border-primary/50'}`}>
                  {champ.image_url ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{champ.name[0]}</span>}
                </button>
              ))}
            </div>
          </div>



          <div className="flex gap-3">
            <button onClick={() => setStep('info')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> Atrás
            </button>
            <button onClick={() => setStep('allies')}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: EQUIPO ALIADO ── */}
      {step === 'allies' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Equipo aliado</h2>
            <p className="text-muted-foreground text-sm">Editá los campeones aliados. Tu campeón queda fijo en tu línea.</p>
          </div>

          <ChampionPoolByRole
            champions={champions}
            title="Equipo aliado"
            selected={allyChampions}
            onSelect={handleSelectAlly}
            lockedRole={lane}
          />

          <div className="flex gap-3">
            <button onClick={() => setStep('champion')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> Atrás
            </button>
            <button onClick={() => setStep('enemies')}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: EQUIPO ENEMIGO ── */}
      {step === 'enemies' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Equipo enemigo</h2>
            <p className="text-muted-foreground text-sm">Editá los campeones enemigos. El rival de tu línea se usa como matchup directo.</p>
          </div>

          <ChampionPoolByRole
            champions={champions}
            title="Equipo enemigo"
            selected={enemyChampions}
            onSelect={handleSelectEnemy}
          />

          <div className="flex gap-3">
            <button onClick={() => setStep('allies')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> Atrás
            </button>
            <button onClick={() => setStep('build')}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: BUILD ── */}
      {step === 'build' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Tu build</h2>
            <p className="text-muted-foreground text-sm">Items, runas y hechizos que usaste</p>
          </div>

          {/* Runas */}
          <div className="rd-card p-4">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-5 h-px bg-primary/50" />
              <h3 className="rd-card-title">Runas</h3>
            </div>

            <div className="space-y-5">
              {/* Clave */}
              {claveRunes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    Clave
                  </p>

                  <div className="grid grid-cols-7 gap-x-3 gap-y-3">
                    {claveRunes.map(rune => (
                      <button
                        key={rune.id}
                        type="button"
                        onClick={() =>
                          isRuneSelected(rune)
                            ? setSelectedRunes(prev => prev.filter(r => r.id !== rune.id))
                            : setSelectedRunes(prev => [
                                ...prev.filter(r => r.branch !== 'Clave'),
                                rune,
                              ])
                        }
                        className={`relative w-7 h-7 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                          isRuneSelected(rune)
                            ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                            : 'opacity-45 hover:opacity-85'
                        }`}
                        title={rune.name}
                      >
                        {rune.image_url ? (
                          <img
                            src={rune.image_url}
                            alt={rune.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {rune.name?.[0]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-border/50" />

              <div className="grid grid-cols-2 gap-4">
                {/* Rama Principal */}
                <div className="min-w-0">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Rama Principal
                  </label>

                  <select
                    value={primaryBranch}
                    onChange={e => handlePrimaryBranchChange(e.target.value)}
                    className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-3 outline-none focus:border-primary/40 transition-all"
                  >
                    {PRIMARY_BRANCHES.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-3">
                    {Object.entries(groupRunes(primaryRunes)).map(([group, runesInGroup]) => (
                      <div key={group}>
                        <p className="text-sm text-muted-foreground mb-2">
                          Grupo {group}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {runesInGroup.map(rune => (
                            <button
                              key={rune.id}
                              type="button"
                              onClick={() => handleTogglePrimaryRune(rune)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                isRuneSelected(rune)
                                  ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                  : 'opacity-45 hover:opacity-85'
                              }`}
                              title={rune.name}
                            >
                              {rune.image_url ? (
                                <img
                                  src={rune.image_url}
                                  alt={rune.name}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                <span className="text-xs font-bold text-primary">
                                  {rune.name?.[0]}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rama Secundaria */}
                <div className="min-w-0">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Rama Secundaria
                  </label>

                  <select
                    value={secondaryBranch}
                    onChange={e => handleSecondaryBranchChange(e.target.value)}
                    className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-3 outline-none focus:border-primary/40 transition-all"
                  >
                    {PRIMARY_BRANCHES.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-3">
                    {Object.entries(groupRunes(secondaryRunes)).map(([group, runesInGroup]) => (
                      <div key={group}>
                        <p className="text-sm text-muted-foreground mb-2">
                          Grupo {group}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {runesInGroup.map(rune => (
                            <button
                              key={rune.id}
                              type="button"
                              onClick={() => handleToggleSecondaryRune(rune)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                isRuneSelected(rune)
                                  ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                  : 'opacity-45 hover:opacity-85'
                              }`}
                              title={rune.name}
                            >
                              {rune.image_url ? (
                                <img
                                  src={rune.image_url}
                                  alt={rune.name}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                <span className="text-xs font-bold text-primary">
                                  {rune.name?.[0]}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Item Pool */}
          <div className="rd-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-px bg-primary/50" />
                <h3 className="rd-card-title">
                  Objetos ({selectedItems.length}/6)
                </h3>
              </div>
            </div>

            <ItemPool
              selectedItems={selectedItems}
              onRemove={removeItem}
            />
          </div>

          {/* Item Browser */}
          <ItemBrowser
            items={items}
            selectedItems={selectedItems}
            onSelect={addItem}
          />
    
          {/* Hechizos */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-3">Hechizos ({selectedSpells.length}/2)</label>
            <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:flex-nowrap">
              {spells.map(spell => {
                const selected = selectedSpells.includes(spell.name);
                const disabled = selectedSpells.length >= 2 && !selected;
                return (
                  <button key={spell.id} type="button" onClick={() => toggleSpell(spell.name)}
                    disabled={disabled} title={spell.name}
                    className={`aspect-square w-14 max-w-full justify-self-center min-w-0 sm:aspect-auto sm:w-auto sm:h-auto sm:max-w-none sm:flex-1 flex items-center justify-center p-1 rounded-full sm:rounded-xl border-2 transition-all overflow-hidden ${
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
                    {spell.image_url
                      ? <img src={spell.image_url} alt={spell.name} className="w-[76%] h-[76%] sm:w-8 sm:h-8 rounded-full object-cover" />
                      : <div className="w-[76%] h-[76%] sm:w-8 sm:h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>
                    }
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setStep('enemies')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> Atrás
            </button>
            <button type="button" onClick={() => setStep('stats')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: STATS ── */}
      {step === 'stats' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-1">Detalles de la partida</h2>
            <p className="text-muted-foreground text-sm">Completá el resultado y las estadísticas</p>
          </div>

          {/* Resultado */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Resultado</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setResult('win')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${result === 'win' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-border text-foreground hover:border-green-500/50'}`}>
                Victoria
              </button>
              <button type="button" onClick={() => setResult('loss')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${result === 'loss' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-foreground hover:border-red-500/50'}`}>
                Derrota
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Asesinatos', value: kills, set: setKills },
              { label: 'Muertes', value: deaths, set: setDeaths },
              { label: 'Asistencias', value: assists, set: setAssists },
              { label: 'Oro', value: gold, set: setGold },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                <input type="number" value={f.value} onChange={e => f.set(e.target.value)} placeholder="0"
                  className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Duración (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="20"
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
          </div>

          {/* Lado */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Equipo <span className="text-muted-foreground font-normal text-xs">(opcional)</span></label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSide(side === 'blue' ? '' : 'blue')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${side === 'blue' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-border text-muted-foreground hover:border-blue-500/50'}`}>
                Azul
              </button>
              <button type="button" onClick={() => setSide(side === 'red' ? '' : 'red')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${side === 'red' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground hover:border-red-500/50'}`}>
                Rojo
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-3">Etiquetas</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_MATCH_TAGS.map(tag => {
                const isSelected = tags.some(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase());

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePresetTag(tag)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      isSelected
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Agregar etiqueta..."
                className="min-w-0 flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Agregar
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  title="Quitar etiqueta"
                  className="px-3 py-1.5 rounded-lg text-sm border bg-primary/20 border-primary/50 text-primary transition-all hover:bg-primary/30"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Observaciones sobre la partida..."
              className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border pb-6">
            <button type="button" onClick={() => setStep('build')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> Atrás
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-secondary border border-border text-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saveMutation.isPending || !result}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Save size={16} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
