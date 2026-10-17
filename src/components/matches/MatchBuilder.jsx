import { useEffect, useRef, useState } from 'react';
import EntityHoverCard from '@/components/ui/EntityHoverCard';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import ItemPool from '@/components/builds/ItemPool';
import ItemBrowser from '@/components/builds/ItemBrowser';
import SavedBuildPicker from '@/components/matches/SavedBuildPicker';
import { PRESET_MATCH_TAGS } from '@/components/matches/matchTags';
import { matchKda } from '@/domain/matchStats';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import { getGamePatchCatalog } from '@/api/gameCatalogSupabase';
import PatchSelect from '@/components/patches/PatchSelect';

import { useSpells } from '@/hooks/useSpells';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];

const cleanTags = (tagList) =>
  [...new Set(tagList.map(tag => tag.trim()).filter(Boolean))];

const getChampionNamesByRole = (selected) =>
  LANES
    .map(role => selected.find(champion => champion.role === role)?.name)
    .filter(Boolean);

function ChampionPoolByRole({ champions, title, selected, onSelect, myChampion, myLane, mirrored = false }) {
  const [search, setSearch] = useState('');
  const ROLES = ['top', 'jungler', 'mid', 'adc', 'support'];
  const ROLE_LABELS = {
    top: 'Top',
    jungler: 'Jungla',
    mid: 'Mid',
    adc: 'ADC',
    support: 'Support'
  };

  const filteredChampions = champions.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  const selectedByRole = {};
  ROLES.forEach(role => {
    selectedByRole[role] = selected.find(s => s.role === role);
  });

  return (
    <div className="rd-card rd-team-pool p-4">
      <div className={`flex items-center justify-between mb-4 ${mirrored ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-2"><span className="w-4 h-px bg-primary/50" /><h3 className="rd-card-title">{title}</h3></div>
        <span className="text-xs text-muted-foreground">{selected.length}/{ROLES.length}</span>
      </div>

      <div className="rd-team-pool-body grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Role slots */}
      <div className="space-y-3 pb-4 border-b border-border lg:border-b-0 lg:pb-0">
        {ROLES.map(role => {
          const champ = selectedByRole[role];
          return (
            <div key={role} className={`flex items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
              <div className={`w-16 text-xs font-semibold text-muted-foreground ${mirrored ? 'text-right' : ''}`}>{ROLE_LABELS[role]}</div>
              <div className="relative w-12 h-12 rounded-lg border-2 border-border bg-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                {champ ? (
                  <>
                    {champ.image_url
                      ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-primary">{champ.name[0]}</span>}
                    <button
                      onClick={() => onSelect(champ, role)}
                      className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 flex items-center justify-center transition-opacity text-sm text-foreground cursor-pointer"
                    >
                      ×
                    </button>
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
      {/* Champion grid */}
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campeón..."
          className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
      </div>
      <div className="rd-team-pool-grid grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-60 md:max-h-[max(15rem,calc(100dvh-26rem))] overflow-y-auto pr-1">
        {filteredChampions.map(champ => {
          const isSelected = Object.values(selectedByRole).some(c => c && c.id === champ.id);
          return (
            <button
              key={champ.id}
              onClick={() => {
                if (isSelected) {
                  const role = Object.keys(selectedByRole).find(r => selectedByRole[r]?.id === champ.id);
                  onSelect(selectedByRole[role], role);
                } else {
                  const firstEmptyRole = ROLES.find(r => !selectedByRole[r]);
                  if (firstEmptyRole) onSelect(champ, firstEmptyRole);
                }
              }}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all overflow-hidden
                ${isSelected
                  ? 'border-primary ring-2 ring-primary/50'
                  : 'border-border/40 hover:border-primary/50'
                }`}
            >
              {champ.image_url
                ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-primary">{champ.name[0]}</span>}
            </button>
          );
        })}
      </div>
      </div>
      </div>
    </div>
  );
}

/** Selector segmentado de dos o más opciones (resultado, lado del mapa). */
function SegmentedChoice({ value, onChange, options }) {
  return (
    <div className="flex gap-2">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
            value === option.value ? option.activeClass : `border-border text-muted-foreground ${option.hoverClass}`
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Campo numérico de estadística: vacío significa "sin dato", no cero. */
function StatInput({ label, value, onChange, placeholder = '—', autoFocus = false }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-center text-base font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 transition-all"
      />
    </label>
  );
}

export default function MatchBuilder({ champions: fallbackChampions = [], patches = [], defaultPatch = '', onSave, onCancel, isSaving = false }) {
  const clientRequestIdRef = useRef(null);
  if (!clientRequestIdRef.current) {
    clientRequestIdRef.current = globalThis.crypto?.randomUUID?.()
      || `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const [patch, setPatch] = useState(defaultPatch);
  const patchWasEdited = useRef(false);

  const [step, setStep] = useState('info'); // info, lane, myChamp, allies, enemies, build, stats
  const [lane, setLane] = useState('');
  const [myChampion, setMyChampion] = useState(null);
  const [allyChampions, setAllyChampions] = useState([]);
  const [enemyChampions, setEnemyChampions] = useState([]);

  const { data: catalog } = useQuery({
    queryKey: ['game-patch-catalog', patch],
    queryFn: () => getGamePatchCatalog(patch),
    enabled: Boolean(patch),
  });
  const champions = catalog?.champions || fallbackChampions;
  const items = catalog?.items || [];
  const runes = catalog?.runes || [];

  const { data: spells = [] } = useSpells();

  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedRunes, setSelectedRunes] = useState([]);
  const [selectedSpells, setSelectedSpells] = useState([]);
  const [champSearch, setChampSearch] = useState('');

  const handleSelectAlly = (champ, role) => {
    if (champ && champ.id) {
      const isSelected = allyChampions.some(a => a.id === champ.id);
      if (isSelected) {
        setAllyChampions(prev => prev.filter(a => a.id !== champ.id));
      } else {
        setAllyChampions(prev => [...prev.filter(a => a.role !== role), { ...champ, role }]);
      }
    }
  };

  const handleSelectEnemy = (champ, role) => {
    if (champ && champ.id) {
      const isSelected = enemyChampions.some(e => e.id === champ.id);
      if (isSelected) {
        setEnemyChampions(prev => prev.filter(e => e.id !== champ.id));
      } else {
        setEnemyChampions(prev => [...prev.filter(e => e.role !== role), { ...champ, role }]);
      }
    }
  };
  const [result, setResult] = useState('win');
  const [kills, setKills] = useState('');
  const [deaths, setDeaths] = useState('');
  const [assists, setAssists] = useState('');
  const [gold, setGold] = useState('');
  const [duration, setDuration] = useState('');
  const [side, setSide] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const [date, setDate] = useState(todayStr);
  const [hour, setHour] = useState('');
  const [matchType, setMatchType] = useState(DEFAULT_MATCH_TYPE);

  useEffect(() => {
    if (defaultPatch && !patch && !patchWasEdited.current) {
      setPatch(defaultPatch);
    }
  }, [defaultPatch, patch]);

  const handlePatchChange = (nextPatch) => {
    patchWasEdited.current = true;
    setPatch(nextPatch);
    setMyChampion(null);
    setAllyChampions([]);
    setEnemyChampions([]);
    setSelectedItems([]);
    setSelectedRunes([]);
  };
  const [primaryBranch, setPrimaryBranch] = useState('Dominación');
  const [secondaryBranch, setSecondaryBranch] = useState('Precisión');

  const handleSelectMyChampion = (champ) => {
    setMyChampion(myChampion?.id === champ.id ? null : champ);
    if (myChampion?.id !== champ.id) {
      setAllyChampions(prev => [...prev.filter(a => a.role !== lane), { ...champ, role: lane }]);
    }
  };

  const toggleSpell = (spell) => {
    if (selectedSpells.includes(spell)) {
      setSelectedSpells(prev => prev.filter(s => s !== spell));
    } else if (selectedSpells.length < 2) {
      setSelectedSpells(prev => [...prev, spell]);
    }
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
    if (index2 !== undefined) {
      setSelectedItems(prev => prev.filter((_, i) => i !== index && i !== index2));
    } else {
      setSelectedItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const claveRunes = runes.filter(r => r.branch === 'Clave');
  const otherRunes = runes.filter(r => r.branch !== 'Clave');

  const getRunesByBranch = (branch) => {
    return otherRunes
      .filter(r => r.branch === branch)
      .sort((a, b) => (a.group || 0) - (b.group || 0));
  };

  const groupRunes = (list) => {
    const grouped = {};

    for (const rune of list) {
      const group = rune.group || 1;

      if (!grouped[group]) grouped[group] = [];

      grouped[group].push(rune);
    }

    return grouped;
  };

  const isRuneSelected = (rune) => {
    return selectedRunes.some(r => r.id === rune.id);
  };

  const primaryRunes = getRunesByBranch(primaryBranch);
  const secondaryRunes = getRunesByBranch(secondaryBranch);

  const handlePrimaryBranchChange = (newPrimary) => {
    if (newPrimary === secondaryBranch) {
      setSelectedRunes(prev =>
        prev.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary)
      );

      setSecondaryBranch(PRIMARY_BRANCHES.find(b => b !== newPrimary));
    } else {
      setSelectedRunes(prev =>
        prev.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary)
      );
    }

    setPrimaryBranch(newPrimary);
  };

  const handleSecondaryBranchChange = (newSecondary) => {
    if (newSecondary === primaryBranch) {
      setSelectedRunes(prev =>
        prev.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary)
      );

      setPrimaryBranch(PRIMARY_BRANCHES.find(b => b !== newSecondary));
    } else {
      setSelectedRunes(prev =>
        prev.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary)
      );
    }

    setSecondaryBranch(newSecondary);
  };

  const handleTogglePrimaryRune = (rune) => {
    if (isRuneSelected(rune)) {
      setSelectedRunes(prev => prev.filter(r => r.id !== rune.id));
      return;
    }

    const selectedPrimaryRunes = selectedRunes.filter(r => r.branch === primaryBranch);
    const sameGroupRune = selectedPrimaryRunes.find(r => r.group === rune.group);

    if (sameGroupRune) {
      setSelectedRunes(prev => prev.filter(r => r.id !== sameGroupRune.id));
    } else if (selectedPrimaryRunes.length >= 3) {
      setSelectedRunes(prev => prev.filter(r => r.id !== selectedPrimaryRunes[0].id));
    }

    setSelectedRunes(prev => [...prev, rune]);
  };

  const handleToggleSecondaryRune = (rune) => {
    if (isRuneSelected(rune)) {
      setSelectedRunes(prev => prev.filter(r => r.id !== rune.id));
      return;
    }

    const selectedSecondaryRunes = selectedRunes.filter(r => r.branch === secondaryBranch);

    if (selectedSecondaryRunes.length > 0) {
      setSelectedRunes(prev => prev.filter(r => r.id !== selectedSecondaryRunes[0].id));
    }

    setSelectedRunes(prev => [...prev, rune]);
  };

  const handleSave = () => {
    if (isSaving) return;

    const directEnemy = enemyChampions.find(e => e.role === lane);
    onSave({
      client_request_id: clientRequestIdRef.current,
      lane,
      own_champion_name: myChampion.name,
      own_champion_id: myChampion.id,
      ally_champions: getChampionNamesByRole(allyChampions),
      enemy_champions: getChampionNamesByRole(enemyChampions),
      enemy_champion_name: directEnemy?.name || '',
      enemy_champion_id: directEnemy?.id || '',
      items_used: selectedItems.map(i => i.name),
      runes_used: selectedRunes.map(r => r.name),
      spells_used: selectedSpells,
      result,
      kills: kills !== '' ? Number(kills) : null,
      deaths: deaths !== '' ? Number(deaths) : null,
      assists: assists !== '' ? Number(assists) : null,
      gold: gold ? Number(gold) : null,
      duration_minutes: duration ? Number(duration) : null,
      side,
      date,
      hour: hour || null,
      patch,
      type: matchType,
      tags: cleanTags([...tags, tagInput]),
      notes,
    });
  };

  const kdaPreview = kills !== '' && deaths !== '' && assists !== ''
    ? matchKda(Number(kills), Number(deaths), Number(assists)).toFixed(2)
    : '—';
  const customTags = tags.filter(tag => !PRESET_MATCH_TAGS.some(preset => preset.toLowerCase() === tag.toLowerCase()));

  const fitsViewport = ['allies', 'enemies', 'build', 'stats'].includes(step);

  return (
    <div className={`space-y-6 ${fitsViewport ? 'rd-match-builder-fit' : ''}`}>
      {/* Progress */}
      <div className="flex gap-2">
        {['info', 'lane', 'myChamp', 'allies', 'enemies', 'build', 'stats'].map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              step === s ? 'bg-primary' : ['info', 'lane', 'myChamp', 'allies', 'enemies', 'build', 'stats'].indexOf(step) >= i ? 'bg-primary/50' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step: Lane */}
      {step === 'lane' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Selecciona tu rol</h2>
            <p className="text-muted-foreground text-sm">¿En qué línea jugaste?</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {LANES.map(l => (
              <button
                key={l}
                onClick={() => { setLane(l); setStep('myChamp'); }}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all capitalize ${
                  lane === l
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground hover:border-primary/50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setStep('info')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft size={16} /> Atrás
          </button>
        </div>
      )}

      {/* Step: Info (fecha y parche) */}
      {step === 'info' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Datos de la partida</h2>
            <p className="text-muted-foreground text-sm">Elegí cuándo jugaste, el parche y el tipo de partida.</p>
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
              <PatchSelect value={patch} onChange={handlePatchChange} patches={patches} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo de partida</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all">
                {MATCH_TYPES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep('lane')}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Step: My Champion */}
      {step === 'myChamp' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Selecciona tu campeón</h2>
            <p className="text-muted-foreground text-sm">¿A quién jugaste en {lane}?</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={champSearch} onChange={e => setChampSearch(e.target.value)} placeholder="Buscar campeón..."
              className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-[max(15rem,calc(100dvh-15rem))] overflow-y-auto pr-1">
            {champions.filter(c => !champSearch || c.name?.toLowerCase().includes(champSearch.toLowerCase())).map(champ => (
              <button
                key={champ.id}
                onClick={() => {
                  setMyChampion(champ);
                  setAllyChampions(prev => [...prev.filter(a => a.role !== lane), { ...champ, role: lane }]);
                  setStep('allies');
                }}
                className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all overflow-hidden
                  ${myChampion?.id === champ.id
                    ? 'border-primary ring-2 ring-primary/50'
                    : 'border-border/40 hover:border-primary/50'
                  }`}
              >
                {champ.image_url
                  ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-primary text-center px-1">{champ.name}</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep('lane')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
          >
            <ArrowLeft size={16} /> Atrás
          </button>
        </div>
      )}

      {/* Step: Allies */}
      {step === 'allies' && (
        <div className="rd-team-step space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Equipo aliado</h2>
            <p className="text-muted-foreground text-sm">Tu campeón ya está asignado, completa el resto del equipo</p>
          </div>
          <ChampionPoolByRole
            champions={champions}
            title="Equipo Azul"
            selected={allyChampions}
            onSelect={handleSelectAlly}
            myChampion={myChampion}
            myLane={lane}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep('myChamp')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2"
            >
              <ArrowLeft size={16} /> Atrás
            </button>
            <button
              onClick={() => setStep('enemies')}
              disabled={allyChampions.length < 5}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Step: Enemies */}
      {step === 'enemies' && (
        <div className="rd-team-step space-y-4">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Equipo enemigo</h2>
            <p className="text-muted-foreground text-sm">Selecciona los 5 campeones enemigos</p>
          </div>
          <ChampionPoolByRole
            champions={champions}
            title="Equipo Rojo"
            selected={enemyChampions}
            onSelect={handleSelectEnemy}
            mirrored={true}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep('allies')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2"
            >
              <ArrowLeft size={16} /> Atrás
            </button>
            <button
              onClick={() => setStep('build')}
              disabled={enemyChampions.length < 5}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

          {/* Step: Build */}
          {step === 'build' && (
            <div className="rd-buildstep space-y-6">
              {/* Encabezado: título y build guardada en una sola franja. */}
              <div className="rd-buildstep-header flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">
                    Tu build
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Selecciona los items, runas y hechizos que usaste
                  </p>
                </div>
                <div className="w-full xl:w-[min(36rem,55%)]">
                  <SavedBuildPicker champion={myChampion} patch={patch} onApply={applySavedBuild} compact />
                </div>
              </div>

              {/* Espacio de trabajo: objetos a la izquierda; runas y hechizos a la derecha. */}
              <div className="rd-buildstep-body grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="rd-buildstep-items flex min-w-0 flex-col gap-4">
                  {/* Item Pool */}
                  <div className="rd-card p-5">
                    <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-px bg-primary/50" />
                      <h3 className="rd-card-title">
                        Objetos ({selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length}/5 + botas)
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
                      <h3 className="rd-card-title">Runas</h3>
                    </div>

                    <div className="rd-runes-content flex flex-1 flex-col gap-3">
                      {/* Clave */}
                      {claveRunes.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Clave
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
                                className={`relative aspect-square w-full max-w-8 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                  isRuneSelected(rune)
                                    ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                    : 'opacity-45 hover:opacity-85'
                                }`}
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
                          </EntityHoverCard>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-border/50" />

                      <div className="rd-runes-branches grid flex-1 grid-cols-2 gap-4">
                        {/* Rama Principal */}
                        <div className="flex min-w-0 flex-col">
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">
                            Rama Principal
                          </label>

                          <select
                            value={primaryBranch}
                            onChange={e => handlePrimaryBranchChange(e.target.value)}
                            className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-2 outline-none focus:border-primary/40 transition-all"
                          >
                            {PRIMARY_BRANCHES.map(b => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>

                          <div className="flex flex-1 flex-col justify-evenly gap-2">
                            {Object.entries(groupRunes(primaryRunes)).map(([group, runesInGroup]) => (
                              <div key={group} className="flex items-center gap-3">
                                <p className="w-6 shrink-0 text-xs font-semibold text-muted-foreground" title={`Grupo ${group}`}>
                                  G{group}
                                </p>

                                <div className="flex flex-1 flex-wrap justify-around gap-2">
                                  {runesInGroup.map(rune => (
                                    <EntityHoverCard key={rune.id} entity={rune} kind={rune.branch}>
    <button
                                      type="button"
                                      onClick={() => handleTogglePrimaryRune(rune)}
                                      className={`w-8 h-8 xl:w-10 xl:h-10 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                        isRuneSelected(rune)
                                          ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                          : 'opacity-45 hover:opacity-85'
                                      }`}
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
                          </EntityHoverCard>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Rama Secundaria */}
                        <div className="flex min-w-0 flex-col">
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">
                            Rama Secundaria
                          </label>

                          <select
                            value={secondaryBranch}
                            onChange={e => handleSecondaryBranchChange(e.target.value)}
                            className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-2 outline-none focus:border-primary/40 transition-all"
                          >
                            {PRIMARY_BRANCHES.map(b => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>

                          <div className="flex flex-1 flex-col justify-evenly gap-2">
                            {Object.entries(groupRunes(secondaryRunes)).map(([group, runesInGroup]) => (
                              <div key={group} className="flex items-center gap-3">
                                <p className="w-6 shrink-0 text-xs font-semibold text-muted-foreground" title={`Grupo ${group}`}>
                                  G{group}
                                </p>

                                <div className="flex flex-1 flex-wrap justify-around gap-2">
                                  {runesInGroup.map(rune => (
                                    <EntityHoverCard key={rune.id} entity={rune} kind={rune.branch}>
    <button
                                      type="button"
                                      onClick={() => handleToggleSecondaryRune(rune)}
                                      className={`w-8 h-8 xl:w-10 xl:h-10 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                        isRuneSelected(rune)
                                          ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]'
                                          : 'opacity-45 hover:opacity-85'
                                      }`}
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
                          </EntityHoverCard>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Spells */}
                  <div className="rd-card rd-buildstep-spells p-4">
                    <label className="text-sm font-semibold text-foreground block mb-3">
                      Hechizos ({selectedSpells.length}/2)
                    </label>
                    <div className="grid w-full grid-cols-5 justify-items-center gap-2 sm:[grid-template-columns:repeat(var(--spell-count),minmax(0,1fr))]" style={/** @type {any} */ ({ '--spell-count': spells.length })}>
                      {spells.map(spell => {
                        const selected = selectedSpells.includes(spell.name);
                        const disabled = selectedSpells.length >= 2 && !selected;
                        return (
                          <EntityHoverCard key={spell.id} entity={spell} kind="Hechizo">
    <button
                            type="button"
                            onClick={() => toggleSpell(spell.name)}
                            aria-disabled={disabled}
                            className={`aspect-square w-full max-w-12 min-w-0 flex items-center justify-center p-0.5 rounded-full border-2 transition-all overflow-hidden ${
                              selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                            } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
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

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep('enemies')}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2"
                >
                  <ArrowLeft size={16} /> Atrás
                </button>

                <button
                  type="button"
                  onClick={() => setStep('stats')}
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* Step: Stats */}
      {step === 'stats' && (
        <div className="rd-statsstep space-y-6">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Detalles de la partida</h2>
            <p className="text-muted-foreground text-sm">Completa los datos de tu rendimiento</p>
          </div>

          <div className="rd-statsstep-body grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {/* Resultado y rendimiento: lo que se carga en todas las partidas. */}
            <section className="rd-card flex flex-col gap-5 p-4 md:p-5" aria-label="Resultado y rendimiento">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Resultado</p>
                  <SegmentedChoice
                    value={result}
                    onChange={setResult}
                    options={[
                      { value: 'win', label: 'Victoria', activeClass: 'border-green-500 bg-green-500/10 text-green-400', hoverClass: 'hover:border-green-500/50' },
                      { value: 'loss', label: 'Derrota', activeClass: 'border-red-500 bg-red-500/10 text-red-400', hoverClass: 'hover:border-red-500/50' },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Equipo <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </p>
                  <SegmentedChoice
                    value={side}
                    onChange={value => setSide(side === value ? '' : value)}
                    options={[
                      { value: 'blue', label: 'Azul', activeClass: 'border-blue-500 bg-blue-500/10 text-blue-400', hoverClass: 'hover:border-blue-500/50' },
                      { value: 'red', label: 'Rojo', activeClass: 'border-red-500 bg-red-500/10 text-red-400', hoverClass: 'hover:border-red-500/50' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">K / D / A</p>
                  <p className="text-xs text-muted-foreground">
                    KDA <span className="font-semibold text-primary">{kdaPreview}</span>
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
                  <StatInput label="Asesinatos" value={kills} onChange={setKills} autoFocus />
                  <span className="pb-2 text-lg text-muted-foreground">/</span>
                  <StatInput label="Muertes" value={deaths} onChange={setDeaths} />
                  <span className="pb-2 text-lg text-muted-foreground">/</span>
                  <StatInput label="Asistencias" value={assists} onChange={setAssists} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatInput label="Oro" value={gold} onChange={setGold} placeholder="ej. 9500" />
                <StatInput label="Duración (min)" value={duration} onChange={setDuration} placeholder="ej. 18" />
              </div>
              <p className="mt-auto text-[11px] text-muted-foreground">
                Los datos vacíos se guardan como “sin dato”: no cuentan como cero en tus estadísticas ni en tus objetivos.
              </p>
            </section>

            {/* Contexto opcional: etiquetas y notas. */}
            <section className="rd-card rd-statsstep-context flex flex-col gap-4 p-4 md:p-5" aria-label="Contexto">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  Etiquetas <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
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
                        {tag}
                      </button>
                    );
                  })}
                  {customTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      title="Quitar etiqueta"
                      className="px-3 py-1.5 rounded-lg text-sm border bg-primary/20 border-primary/50 text-primary transition-all hover:bg-primary/30"
                    >
                      {tag} ×
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
                    placeholder="Etiqueta propia (Enter para agregar)"
                    className="min-w-0 flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="rd-statsstep-notes flex min-h-0 flex-1 flex-col">
                <label htmlFor="match-notes" className="text-sm font-semibold text-foreground mb-2">
                  Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                </label>
                <textarea
                  id="match-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observaciones sobre la partida..."
                  className="min-h-24 w-full flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none"
                />
              </div>
            </section>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={() => setStep('build')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2"
            >
              <ArrowLeft size={16} /> Atrás
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : 'Guardar Partida'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
