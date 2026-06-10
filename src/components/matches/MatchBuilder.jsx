import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WRItem, Rune } from '@/api/entitiesSupabase';
import { ArrowLeft, Search } from 'lucide-react';
import ItemPool from '@/components/builds/ItemPool';
import ItemBrowser from '@/components/builds/ItemBrowser';

import { useSpells } from '@/hooks/useSpells';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const TAGS = ['stomp', 'remontada', 'mala composición', 'buen early', 'mal late', 'autofill', 'duoQ', 'soloQ'];
const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];

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
    <div className="rd-card p-4">
      <div className={`flex items-center justify-between mb-4 ${mirrored ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-2"><span className="w-4 h-px bg-primary/50" /><h3 className="rd-card-title">{title}</h3></div>
        <span className="text-xs text-muted-foreground">{selected.length}/{ROLES.length}</span>
      </div>

      {/* Role slots */}
      <div className="space-y-3 mb-4 pb-4 border-b border-border">
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

      {/* Champion grid */}
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campeón..."
          className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-48 overflow-y-auto">
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
  );
}

export default function MatchBuilder({ champions, onSave, onCancel }) {
  const [step, setStep] = useState('info'); // info, lane, myChamp, allies, enemies, build, stats
  const [lane, setLane] = useState('');
  const [myChampion, setMyChampion] = useState(null);
  const [allyChampions, setAllyChampions] = useState([]);
  const [enemyChampions, setEnemyChampions] = useState([]);

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => WRItem.list('category'),
  });

  const { data: spells = [] } = useSpells();

  const { data: runes = [] } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('branch'),
  });

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
  const [notes, setNotes] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const [date, setDate] = useState(todayStr);
  const [hour, setHour] = useState('');
  const [patch, setPatch] = useState('');
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
    const directEnemy = enemyChampions.find(e => e.role === lane);
    onSave({
      lane,
      own_champion_name: myChampion.name,
      own_champion_id: myChampion.id,
      ally_champions: allyChampions.map(c => c.name),
      enemy_champions: enemyChampions.map(c => c.name),
      enemy_champion_name: directEnemy?.name || '',
      enemy_champion_id: directEnemy?.id || '',
      items_used: selectedItems.map(i => i.name),
      runes_used: selectedRunes.map(r => r.name),
      spells_used: selectedSpells,
      result,
      kills: kills ? Number(kills) : 0,
      deaths: deaths ? Number(deaths) : 0,
      assists: assists ? Number(assists) : 0,
      gold: gold ? Number(gold) : null,
      duration_minutes: duration ? Number(duration) : null,
      side,
      date,
      hour: hour || null,
      patch,
      tags,
      notes,
    });
  };

  return (
    <div className="space-y-6">
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
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Fecha y parche</h2>
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
              <input type="text" value={patch} onChange={e => setPatch(e.target.value)} placeholder="ej: 5.3"
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
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
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-72 overflow-y-auto">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
            <div className="space-y-6">
              <div>
                <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">
                  Tu build
                </h2>
                <p className="text-muted-foreground text-sm">
                  Selecciona los items, runas y hechizos que usaste
                </p>
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

              {/* Spells */}
              <div>
                <label className="text-sm font-semibold text-foreground block mb-3">
                  Hechizos ({selectedSpells.length}/2)
                </label>
                <div className="flex gap-2 w-full">
                  {spells.map(spell => {
                    const selected = selectedSpells.includes(spell.name);
                    const disabled = selectedSpells.length >= 2 && !selected;
                    return (
                      <button
                        key={spell.id}
                        type="button"
                        onClick={() => toggleSpell(spell.name)}
                        disabled={disabled}
                        title={spell.name}
                        className={`flex-1 flex items-center justify-center p-1.5 rounded-xl border-2 transition-all ${
                          selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {spell.image_url
                          ? <img src={spell.image_url} alt={spell.name} className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>
                        }
                      </button>
                    );
                  })}
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
        <div className="space-y-6">
          <div>
            <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">Detalles de la partida</h2>
            <p className="text-muted-foreground text-sm">Completa los datos de tu rendimiento</p>
          </div>

          {/* Result */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Resultado</label>
            <div className="flex gap-3">
              <button
                onClick={() => setResult('win')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                  result === 'win'
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-border text-foreground hover:border-green-500/50'
                }`}
              >
                Victoria
              </button>
              <button
                onClick={() => setResult('loss')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                  result === 'loss'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-border text-foreground hover:border-red-500/50'
                }`}
              >
                Derrota
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Asesinatos', value: kills, setValue: setKills, placeholder: '0' },
              { label: 'Muertes', value: deaths, setValue: setDeaths, placeholder: '0' },
              { label: 'Asistencias', value: assists, setValue: setAssists, placeholder: '0' },
              { label: 'Oro', value: gold, setValue: setGold, placeholder: '1000' },
              { label: 'Duración (min)', value: duration, setValue: setDuration, placeholder: '20', colSpan: 'col-span-2' },
            ].map((field, i) => (
              <div key={i} className={field.colSpan || ''}>
                <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
                <input
                  type="number"
                  value={field.value}
                  onChange={e => field.setValue(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
                />
              </div>
            ))}
          </div>

          {/* Side */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Equipo <span className="text-muted-foreground font-normal text-xs">(opcional)</span></label>
            <div className="flex gap-3">
              <button
                onClick={() => setSide(side === 'blue' ? '' : 'blue')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                  side === 'blue'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-border text-muted-foreground hover:border-blue-500/50'
                }`}
              >
                Azul
              </button>
              <button
                onClick={() => setSide(side === 'red' ? '' : 'red')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                  side === 'red'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-border text-muted-foreground hover:border-red-500/50'
                }`}
              >
                Rojo
              </button>
            </div>
            </div>

            {/* Tags and Notes */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-3">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(tag => (
                    <button key={tag} type="button"
                      onClick={() => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${tags.includes(tag) ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-secondary border-border text-muted-foreground hover:border-border/80'}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notas</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observaciones sobre la partida..."
                  className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none h-24"
                />
              </div>
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
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Guardar Partida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
