import { Fragment, useEffect, useRef, useState } from 'react';
import EntityHoverCard from '@/components/ui/EntityHoverCard';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { updateMatch } from '@/api/matchesSupabase';
import { ArrowLeft, Save, Search } from 'lucide-react';
import ItemPool from '@/components/builds/ItemPool';
import ItemBrowser from '@/components/builds/ItemBrowser';
import SavedBuildPicker from '@/components/matches/SavedBuildPicker';
import { PRESET_MATCH_TAGS, matchTagLabel } from '@/components/matches/matchTags';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import { getGamePatchCatalog } from '@/api/gameCatalogSupabase';
import PatchSelect from '@/components/patches/PatchSelect';
import { SegmentedChoice, StatInput } from '@/components/matches/MatchBuilder';
import { matchKda } from '@/domain/matchStats';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';

import { useSpells } from '@/hooks/useSpells';
import { runeBranchLabel } from '@/utils/runeBranches';
import { labels } from '@/i18n/uiI18n';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];
const STEPS = ['info', 'champion', 'allies', 'enemies', 'build', 'stats'];

const cleanTags = (tagList) =>
  [...new Set(tagList.map(tag => tag.trim()).filter(Boolean))];

const getChampionNamesByRole = (selected) =>
  LANES
    .map(role => selected.find(champion => champion.role === role)?.name)
    .filter(Boolean);

const ROLE_LABELS = labels({
  top: 'lanes.top',
  jungler: 'lanes.jungler',
  mid: 'lanes.mid',
  adc: 'lanes.adc',
  support: 'lanes.support',
});

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

function ChampionPoolByRole({ champions, title, selected, onSelect, lockedRole, mirrored = false }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const filteredChampions = champions.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  const selectedByRole = {};
  LANES.forEach(role => {
    selectedByRole[role] = selected.find(s => s.role === role);
  });

  return (
    <div className="rd-card rd-team-pool p-4">
      <div className={`flex items-center justify-between mb-4 ${mirrored ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="w-4 h-px bg-primary/50" />
          <h3 className="rd-card-title">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{selected.length}/{LANES.length}</span>
      </div>

      <div className="rd-team-pool-body grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3 pb-4 border-b border-border lg:border-b-0 lg:pb-0">
          {LANES.map(role => {
            const champ = selectedByRole[role];
            const locked = lockedRole === role;
            return (
              <div key={role} className={`flex items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
                <div className={`w-16 text-xs font-semibold text-muted-foreground ${mirrored ? 'text-right' : ''}`}>{ROLE_LABELS[role]}</div>
                <div className="relative w-12 h-12 rounded-lg border-2 border-border bg-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
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
                <div className={`flex-1 text-xs text-foreground ${mirrored ? 'text-right' : ''}`}>
                  {champ ? champ.name : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rd-team-pool-champions min-w-0">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('common.searchChampionPlaceholder')}
              className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
            />
          </div>
          <div className="rd-team-pool-grid grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-60 md:max-h-[max(15rem,calc(100dvh-26rem))] overflow-y-auto pr-1">
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

export default function MatchForm({ match, patches = [], defaultPatch = '', onClose, onSaved }) {
  const t = useT();
  const { entityName } = useCatalogText();
  const [step, setStep] = useState('info');
  // Smartphone, paso "Tu build": objetos y hechizos fijos (a la izquierda en horizontal,
  // arriba en vertical) y un panel por vez (objetos / runas), como en el creador de builds.
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const [buildPanel, setBuildPanel] = useState('items');

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
  const [matchType, setMatchType] = useState(match?.type || DEFAULT_MATCH_TYPE);
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

  const { data: catalog } = useQuery({
    queryKey: ['game-patch-catalog', patch],
    queryFn: () => getGamePatchCatalog(patch),
    enabled: Boolean(patch),
  });
  const champions = catalog?.champions || [];
  const items = catalog?.items || [];
  const runes = catalog?.runes || [];

  // Initialize champion/items/runes from match data once data is loaded
  const [initialized, setInitialized] = useState(false);

  const handlePatchChange = (nextPatch) => {
    patchWasEdited.current = true;
    setPatch(nextPatch);
    setInitialized(true);
    setOwnChampion(null);
    setAllyChampions([]);
    setEnemyChampions([]);
    setSelectedItems([]);
    setSelectedRunes([]);
  };
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
      kills: kills !== '' ? Number(kills) : null,
      deaths: deaths !== '' ? Number(deaths) : null,
      assists: assists !== '' ? Number(assists) : null,
      gold: gold !== '' ? Number(gold) : null,
      duration_minutes: duration !== '' ? Number(duration) : null,
      side: side || null,
      patch,
      type: matchType,
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

  const applySavedBuild = (build) => {
    const resolvedItems = (build.items || [])
      .map(name => items.find(item => item.name === name))
      .filter(Boolean);
    const resolvedRunes = (build.additional_runes || [])
      .map(name => runes.find(rune => rune.name === name))
      .filter(Boolean);

    setSelectedItems(resolvedItems);
    setSelectedRunes(resolvedRunes);
    setSelectedSpells((build.spells || []).slice(0, 2));

    const branches = [...new Set(
      resolvedRunes.filter(rune => rune.branch !== 'Clave').map(rune => rune.branch),
    )];
    const nextPrimary = branches[0] || primaryBranch;
    setPrimaryBranch(nextPrimary);
    setSecondaryBranch(branches[1] || PRIMARY_BRANCHES.find(branch => branch !== nextPrimary));
    setRunesInitialized(true);
  };

  const isMobilityBoots = (item) =>
    item && item.category === 'Nivel Medio' && Array.isArray(item.type) && item.type.includes('Movimiento');
  const isEnchantItem = (item) =>
    item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');
  const isMovementItem = (item) =>
    item && Array.isArray(item.type) && item.type.includes('Movimiento');

  const UNIQUE_ITEMS = ['escudo reliquia', 'hoz espectral', 'guadaña de niebla oscura', 'baluarte de la montaña'];

  const addItem = (item) => {
    const enchantment = isEnchantItem(item);
    const movement = isMovementItem(item);
    const normalCount = selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length;
    const hasMovement = selectedItems.some(isMovementItem);

    if (enchantment) {
      if (!selectedItems.some(isMobilityBoots) || selectedItems.some(isEnchantItem)) return;
      setSelectedItems(prev => [...prev, item]);
      return;
    }

    if (movement) {
      if (hasMovement) return;
      setSelectedItems(prev => [...prev, item]);
      return;
    }

    if (normalCount >= 5) return;
    if (UNIQUE_ITEMS.includes(item?.name?.toLowerCase()) &&
        selectedItems.some(i => UNIQUE_ITEMS.includes(i?.name?.toLowerCase()))) return;
    if (item.category === 'Mejorado' && selectedItems.some(i => i?.id === item.id)) return;

    setSelectedItems(prev => [...prev, item]);
  };

  const removeItem = (index, index2) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index && i !== index2));
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
  const kdaPreview = kills !== '' && deaths !== '' && assists !== ''
    ? matchKda(Number(kills), Number(deaths), Number(assists)).toFixed(2)
    : '—';
  const customTags = tags.filter(tag => !PRESET_MATCH_TAGS.some(preset => preset.toLowerCase() === tag.toLowerCase()));

  const fitsViewport = ['allies', 'enemies', 'build', 'stats'].includes(step);

  return (
    <div className={`rd-match-flow space-y-6 ${fitsViewport ? 'rd-match-builder-fit' : ''}`}>
      {/* En los pasos que llenan el viewport no hay encabezado: se sale con "Cancelar" abajo. */}
      {!fitsViewport && (
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <h1 className="font-rajdhani font-bold text-xl text-foreground">{t('matches.editarPartida')}</h1>
      </div>
      )}

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              step === s ? 'bg-primary' : stepIndex >= i ? 'bg-primary/50' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* ── STEP 0: INFO ── */}
      {step === 'info' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.datosDeLaPartida')}</h2>
            <p className="text-muted-foreground text-sm">{t('matches.elegiCuandoJugasteEl')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('common.date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('matches.horaOpcional')}</label>
              <input type="time" value={hour} onChange={e => setHour(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('goals.filterLabels.patches')}</label>
              <PatchSelect value={patch} onChange={handlePatchChange} patches={patches} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('goals.filterLabels.types')}</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all">
                {MATCH_TYPES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep('champion')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: CAMPEÓN Y LÍNEA ── */}
      {step === 'champion' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.campeonYLinea')}</h2>
            <p className="text-muted-foreground text-sm">{t('matches.seleccionaTuLineaY')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {LANES.map(l => (
              <button key={l} type="button" onClick={() => handleLaneSelect(l)}
                className={`px-4 py-3 rounded-lg border-2 font-medium capitalize transition-all ${lane === l ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/50'}`}>
                {l}
              </button>
            ))}
          </div>

          {ownChampion && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
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

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={champSearch} onChange={e => setChampSearch(e.target.value)} placeholder={t('common.searchChampionPlaceholder')}
              className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-[max(15rem,calc(100dvh-30rem))] overflow-y-auto pr-1">
            {filteredChamps.map(champ => (
              <button key={champ.id} type="button" onClick={() => handleOwnChampionSelect(champ)}
                className={`w-16 h-16 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all
                  ${ownChampion?.id === champ.id ? 'border-primary ring-2 ring-primary/50' : 'border-border/40 hover:border-primary/50'}`}>
                {champ.image_url ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-primary text-center px-1">{champ.name}</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('info')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> {t('buildV2.atras')}
            </button>
            <button onClick={() => setStep('allies')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: EQUIPO ALIADO ── */}
      {step === 'allies' && (
        <div className="rd-team-step space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.equipoAliado')}</h2>
            <p className="text-muted-foreground text-sm">{t('matches.editaLosCampeonesAliados')}</p>
          </div>

          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoAzul')}
            selected={allyChampions}
            onSelect={handleSelectAlly}
            lockedRole={lane}
          />

          <div className="flex gap-3">
            <button onClick={() => setStep('champion')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> {t('buildV2.atras')}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={() => setStep('enemies')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: EQUIPO ENEMIGO ── */}
      {step === 'enemies' && (
        <div className="rd-team-step space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.equipoEnemigo')}</h2>
            <p className="text-muted-foreground text-sm">{t('matches.editaLosCampeonesEnemigos')}</p>
          </div>

          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoRojo')}
            selected={enemyChampions}
            onSelect={handleSelectEnemy}
            mirrored
          />

          <div className="flex gap-3">
            <button onClick={() => setStep('allies')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> {t('buildV2.atras')}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={() => setStep('build')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: BUILD ── */}
      {step === 'build' && (
        <div className="rd-buildstep space-y-6">
          {/* Encabezado: título y build guardada en una sola franja. */}
          <div className="rd-buildstep-header flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.tuBuild')}</h2>
              <p className="text-muted-foreground text-sm">{t('matches.itemsRunasYHechizos')}</p>
            </div>
            <div className="w-full xl:w-[min(36rem,55%)]">
              <SavedBuildPicker champion={ownChampion} patch={patch} onApply={applySavedBuild} compact />
            </div>
          </div>

          {/* Espacio de trabajo: objetos a la izquierda; runas y hechizos a la derecha. */}
          <div data-panel={buildPanel} className="rd-buildstep-body grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {(isPhoneLandscape || isPhonePortrait) && (
              <div className="rd-panel-tabs rd-buildstep-tabs" role="tablist" aria-label={t('builds.panelesDeLaBuild')}>
                {[['items', t('common.items')], ['runes', t('common.runes')]].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={buildPanel === id}
                    onClick={() => setBuildPanel(id)}
                    className={`rd-panel-tab ${buildPanel === id ? 'rd-panel-tab-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="rd-buildstep-items flex min-w-0 flex-col gap-4">
              {/* Item Pool */}
              <div className="rd-buildstep-pool rd-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-px bg-primary/50" />
                    <h3 className="rd-card-title">
                      {t('builds.objetos')}{selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length}/5 + botas)
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
            </div>

            <div className="rd-buildstep-side flex min-w-0 flex-col gap-4">
              {/* Runas */}
              <div className="rd-card rd-buildstep-runes flex flex-col p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-px bg-primary/50" />
                  <h3 className="rd-card-title">{t('common.runes')}</h3>
                </div>

                <div className="rd-runes-content flex flex-1 flex-col gap-3">
                  {/* Clave */}
                  {claveRunes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {t('builds.clave')}
                      </p>

                      <div className="grid justify-items-center gap-1" style={{ gridTemplateColumns: `repeat(${claveRunes.length}, minmax(0, 1fr))` }}>
                        {claveRunes.map(rune => (
                          <EntityHoverCard key={rune.id} entity={rune} kind={rune.branch}>
                            <button
                              type="button"
                              onClick={() =>
                                isRuneSelected(rune)
                                  ? setSelectedRunes(prev => prev.filter(r => r.id !== rune.id))
                                  : setSelectedRunes(prev => [
                                      ...prev.filter(r => r.branch !== 'Clave'),
                                      rune,
                                    ])
                              }
                              className={`relative aspect-square w-full max-w-11 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                isRuneSelected(rune)
                                  ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                  : 'opacity-45 hover:opacity-85'
                              }`}
                            >
                              {rune.image_url ? (
                                <img
                                  src={rune.image_url}
                                  alt={entityName(rune)}
                                  className="w-full h-full object-cover rounded-full scale-[1.35]"
                                />
                              ) : (
                                <span className="text-xs font-bold text-primary">
                                  {entityName(rune)[0]}
                                </span>
                              )}
                            </button>
                          </EntityHoverCard>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-border/50" />

                  <div className="rd-runes-branches grid flex-1 grid-cols-2 gap-4">
                    {[
                      { label: t('builds.ramaPrincipal'), branch: primaryBranch, onBranchChange: handlePrimaryBranchChange, branchRunes: primaryRunes, onToggle: handleTogglePrimaryRune },
                      { label: t('builds.ramaSecundaria'), branch: secondaryBranch, onBranchChange: handleSecondaryBranchChange, branchRunes: secondaryRunes, onToggle: handleToggleSecondaryRune },
                    ].map(column => (
                      <div key={column.label} className="flex min-w-0 flex-col">
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">
                          {column.label}
                        </label>

                        <select
                          value={column.branch}
                          onChange={e => column.onBranchChange(e.target.value)}
                          className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-2 outline-none focus:border-primary/40 transition-all"
                        >
                          {PRIMARY_BRANCHES.map(b => (
                            <option key={b} value={b}>
                              {runeBranchLabel(b)}
                            </option>
                          ))}
                        </select>

                        <div className="flex flex-1 flex-col justify-evenly gap-2">
                          {Object.entries(groupRunes(column.branchRunes)).map(([group, runesInGroup], index) => (
                            <Fragment key={group}>
                              {index > 0 && <div className="h-px origin-center scale-y-50 bg-primary/20" aria-hidden="true" />}
                              <div className="flex items-center">
                                <div className="flex flex-1 flex-wrap justify-around gap-2">
                                  {runesInGroup.map(rune => (
                                    <EntityHoverCard key={rune.id} entity={rune} kind={rune.branch}>
                                      <button
                                        type="button"
                                        onClick={() => column.onToggle(rune)}
                                        className={`w-8 h-8 xl:w-10 xl:h-10 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                          isRuneSelected(rune)
                                            ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                            : 'opacity-45 hover:opacity-85'
                                        }`}
                                      >
                                        {rune.image_url ? (
                                          <img
                                            src={rune.image_url}
                                            alt={entityName(rune)}
                                            className="w-full h-full object-cover rounded-full"
                                          />
                                        ) : (
                                          <span className="text-xs font-bold text-primary">
                                            {entityName(rune)[0]}
                                          </span>
                                        )}
                                      </button>
                                    </EntityHoverCard>
                                  ))}
                                </div>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hechizos */}
              <div className="rd-card rd-buildstep-spells p-4">
                <label className="text-sm font-semibold text-foreground block mb-3">
                  {t('builds.hechizos')}{selectedSpells.length}/2)
                </label>
                <div className="grid w-full grid-cols-5 justify-items-center gap-2 sm:[grid-template-columns:repeat(var(--spell-count),minmax(0,1fr))]" style={/** @type {any} */ ({ '--spell-count': spells.length })}>
                  {spells.map(spell => {
                    const selected = selectedSpells.includes(spell.name);
                    const disabled = selectedSpells.length >= 2 && !selected;
                    return (
                      <EntityHoverCard key={spell.id} entity={spell} kind={t('builds.hechizo')}>
                        <button
                          type="button"
                          onClick={() => toggleSpell(spell.name)}
                          aria-disabled={disabled}
                          className={`aspect-square w-full max-w-12 min-w-0 flex items-center justify-center rounded-full transition-all overflow-hidden ${
                            selected ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]' : 'opacity-50 hover:opacity-90'
                          } ${disabled ? '!opacity-25 cursor-not-allowed' : ''}`}
                        >
                          {spell.image_url
                            ? <img src={spell.image_url} alt={spell.name} className="w-full h-full rounded-full object-cover" />
                            : <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>
                          }
                        </button>
                      </EntityHoverCard>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setStep('enemies')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> {t('buildV2.atras')}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={() => setStep('stats')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: STATS ── */}
      {step === 'stats' && (
        <div className="rd-statsstep space-y-6">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{t('matches.detallesDeLaPartida')}</h2>
            <p className="text-muted-foreground text-sm">{t('matches.completaElResultadoY')}</p>
          </div>

          <div className="rd-statsstep-body grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {/* Resultado y rendimiento. */}
            <section className="rd-card flex flex-col gap-5 p-4 md:p-5" aria-label={t('matches.resultadoYRendimiento')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">{t('matches.resultado')}</p>
                  <SegmentedChoice
                    value={result}
                    onChange={setResult}
                    options={[
                      { value: 'win', label: t('matches.victoria'), activeClass: 'border-green-500 bg-green-500/10 text-green-400', hoverClass: 'hover:border-green-500/50' },
                      { value: 'loss', label: t('matches.derrota'), activeClass: 'border-red-500 bg-red-500/10 text-red-400', hoverClass: 'hover:border-red-500/50' },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">
                    {t('matches.equipo')} <span className="text-muted-foreground font-normal text-xs">{t('matches.opcional')}</span>
                  </p>
                  <SegmentedChoice
                    value={side}
                    onChange={value => setSide(side === value ? '' : value)}
                    options={[
                      { value: 'blue', label: t('matches.azul'), activeClass: 'border-blue-500 bg-blue-500/10 text-blue-400', hoverClass: 'hover:border-blue-500/50' },
                      { value: 'red', label: t('matches.rojo'), activeClass: 'border-red-500 bg-red-500/10 text-red-400', hoverClass: 'hover:border-red-500/50' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">K / D / A</p>
                  <p className="text-xs text-muted-foreground">
                    {t('goals.stat.kda')} <span className="font-semibold text-primary">{kdaPreview}</span>
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
                  <StatInput label={t('goals.stat.asesinatos')} value={kills} onChange={setKills} />
                  <span className="pb-2 text-lg text-muted-foreground">/</span>
                  <StatInput label={t('goals.stat.muertes')} value={deaths} onChange={setDeaths} />
                  <span className="pb-2 text-lg text-muted-foreground">/</span>
                  <StatInput label={t('goals.stat.asistencias')} value={assists} onChange={setAssists} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatInput label={t('goals.stat.oro')} value={gold} onChange={setGold} placeholder={t('matches.ej9500')} />
                <StatInput label={t('matches.duracionMin')} value={duration} onChange={setDuration} placeholder={t('matches.ej18')} />
              </div>
              <p className="mt-auto text-[11px] text-muted-foreground">
                {t('matches.losDatosVaciosSe')}
              </p>
            </section>

            {/* Contexto opcional: etiquetas y notas. */}
            <section className="rd-card rd-statsstep-context flex flex-col gap-4 p-4 md:p-5" aria-label={t('matches.contexto')}>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  {t('matches.etiquetas')} <span className="text-muted-foreground font-normal text-xs">{t('matches.opcional')}</span>
                </p>
                <div className="flex flex-wrap gap-2">
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
                        {matchTagLabel(tag)}
                      </button>
                    );
                  })}
                  {customTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      title={t('matches.quitarEtiqueta')}
                      className="px-3 py-1.5 rounded-lg text-sm border bg-primary/20 border-primary/50 text-primary transition-all hover:bg-primary/30"
                    >
                      {matchTagLabel(tag)} ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
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
                    placeholder={t('matches.etiquetaPropiaEnterPara')}
                    className="min-w-0 flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
                  >
                    {t('matches.agregar')}
                  </button>
                </div>
              </div>

              <div className="rd-statsstep-notes flex min-h-0 flex-1 flex-col">
                <label htmlFor="match-edit-notes" className="text-sm font-semibold text-foreground mb-2">
                  {t('matches.notas')} <span className="text-muted-foreground font-normal text-xs">{t('matches.opcional')}</span>
                </label>
                <textarea
                  id="match-edit-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('matches.observacionesSobreLaPartida')}
                  className="min-h-24 w-full flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none"
                />
              </div>
            </section>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setStep('build')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
              <ArrowLeft size={16} /> {t('buildV2.atras')}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={handleSave} disabled={saveMutation.isPending || !result}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={16} /> {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
