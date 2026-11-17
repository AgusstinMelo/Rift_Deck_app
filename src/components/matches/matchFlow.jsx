// Piezas compartidas por la carga (MatchBuilder) y la edición (MatchForm) de partidas:
// estado y reglas de la build, etiquetas, estadísticas y los pasos que se ven igual en
// los dos flujos. El DOM es el mismo que tenía cada formulario: el CSS de smartphone
// (index.css, .rd-buildstep-*, .rd-statsstep-*, .rd-team-pool-*) depende de él.
import { Fragment, useCallback, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import EntityHoverCard from '@/components/ui/EntityHoverCard';
import ItemPool from '@/components/builds/ItemPool';
import ItemBrowser from '@/components/builds/ItemBrowser';
import SavedBuildPicker from '@/components/matches/SavedBuildPicker';
import ChampionGrid from '@/components/matches/ChampionGrid';
import PatchSelect from '@/components/patches/PatchSelect';
import { PRESET_MATCH_TAGS, matchTagLabel } from '@/components/matches/matchTags';
import { MATCH_TYPES } from '@/constants/matchTypes';
import { matchKda } from '@/domain/matchStats';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { runeBranchLabel } from '@/utils/runeBranches';

export const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
export const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];
export const MATCH_STEPS = ['info', 'champion', 'allies', 'enemies', 'build', 'stats'];
/** Pasos que ocupan el alto del viewport (sin encabezado de página). */
export const FIT_VIEWPORT_STEPS = ['allies', 'enemies', 'build', 'stats'];

export const cleanTags = (tagList) =>
  [...new Set(tagList.map(tag => tag.trim()).filter(Boolean))];

export const getChampionNamesByRole = (selected) =>
  LANES
    .map(role => selected.find(champion => champion.role === role)?.name)
    .filter(Boolean);

export const toInputValue = value => (value === null || value === undefined ? '' : String(value));

const numberOrNull = value => (value !== '' ? Number(value) : null);

const INPUT_CLASS = 'w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all';
const SELECTED_ICON = 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]';

// ── Reglas de objetos ──────────────────────────────────────────────────────────

const isMobilityBoots = (item) =>
  item && item.category === 'Nivel Medio' && Array.isArray(item.type) && item.type.includes('Movimiento');
export const isEnchantItem = (item) =>
  item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');
export const isMovementItem = (item) =>
  item && Array.isArray(item.type) && item.type.includes('Movimiento');

const UNIQUE_ITEMS = ['escudo reliquia', 'hoz espectral', 'guadaña de niebla oscura', 'baluarte de la montaña'];

/** Ramas principal y secundaria a partir de runas elegidas (la clave no cuenta). */
export function branchesOfRunes(runes, fallbackPrimary = 'Dominación') {
  const branches = [...new Set(runes.filter(rune => rune.branch !== 'Clave').map(rune => rune.branch))];
  const primary = branches[0] || fallbackPrimary;
  return { primary, secondary: branches[1] || PRIMARY_BRANCHES.find(branch => branch !== primary) };
}

const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * Estado de la build de una partida: objetos (5 + botas + encantamiento), runas por
 * rama, hechizos (2), el panel visible en smartphone y la build guardada vinculada.
 * `initialBuild`: build vinculada de una partida que se edita ({ id, championId, championName }).
 */
export function useMatchBuild({ items, runes, initialSpells = [], initialBuild = null }) {
  // Build guardada que se aplicó: la partida queda vinculada para medir cómo rinde.
  const [linkedBuild, setLinkedBuild] = useState(initialBuild);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedRunes, setSelectedRunes] = useState([]);
  const [selectedSpells, setSelectedSpells] = useState(initialSpells);
  const [primaryBranch, setPrimaryBranch] = useState('Dominación');
  const [secondaryBranch, setSecondaryBranch] = useState('Precisión');
  // Smartphone, paso "Tu build": objetos y hechizos fijos (a la izquierda en horizontal,
  // arriba en vertical) y un panel por vez (objetos / runas), como en el creador de builds.
  const [buildPanel, setBuildPanel] = useState('items');

  const setBranches = useCallback(({ primary, secondary }) => {
    setPrimaryBranch(primary);
    setSecondaryBranch(secondary);
  }, []);

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

  // ItemPool quita un objeto, o las botas junto con su encantamiento (dos índices).
  const removeItem = (index, index2) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index && i !== index2));
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
    setBranches(branchesOfRunes(resolvedRunes, primaryBranch));
    setLinkedBuild({ id: build.id, name: build.name, championId: build.champion_id, championName: build.champion_name });
  };

  /**
   * Build vinculada para guardar: solo si es del campeón elegido (si después se cambió de
   * campeón, la partida no se jugó con esa build). Sin datos del campeón, se conserva.
   */
  const linkedBuildIdFor = champion => {
    if (!linkedBuild) return null;
    const known = linkedBuild.championId != null || linkedBuild.championName;
    if (!known || !champion) return linkedBuild.id;
    const same = (linkedBuild.championId != null && String(linkedBuild.championId) === String(champion.id))
      || sameName(linkedBuild.championName, champion.name);
    return same ? linkedBuild.id : null;
  };

  const claveRunes = runes.filter(r => r.branch === 'Clave');
  const otherRunes = runes.filter(r => r.branch !== 'Clave');
  const getRunesByBranch = (branch) => otherRunes
    .filter(r => r.branch === branch)
    .sort((a, b) => (a.group || 0) - (b.group || 0));
  const isRuneSelected = (rune) => selectedRunes.some(r => r.id === rune.id);

  const handlePrimaryBranchChange = (newPrimary) => {
    setSelectedRunes(prev => prev.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary));
    if (newPrimary === secondaryBranch) setSecondaryBranch(PRIMARY_BRANCHES.find(b => b !== newPrimary));
    setPrimaryBranch(newPrimary);
  };

  const handleSecondaryBranchChange = (newSecondary) => {
    setSelectedRunes(prev => prev.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary));
    if (newSecondary === primaryBranch) setPrimaryBranch(PRIMARY_BRANCHES.find(b => b !== newSecondary));
    setSecondaryBranch(newSecondary);
  };

  const toggleKeystone = (rune) => (
    isRuneSelected(rune)
      ? setSelectedRunes(prev => prev.filter(r => r.id !== rune.id))
      : setSelectedRunes(prev => [...prev.filter(r => r.branch !== 'Clave'), rune])
  );

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

  /** Vuelve a una build vacía (al cambiar de parche cambia el catálogo) y sin vínculo. */
  const resetBuild = () => {
    setSelectedItems([]);
    setSelectedRunes([]);
    setLinkedBuild(null);
  };

  return {
    selectedItems, setSelectedItems, addItem, removeItem,
    selectedRunes, setSelectedRunes, isRuneSelected, toggleKeystone,
    selectedSpells, toggleSpell,
    primaryBranch, secondaryBranch, setBranches,
    handlePrimaryBranchChange, handleSecondaryBranchChange,
    handleTogglePrimaryRune, handleToggleSecondaryRune,
    claveRunes,
    primaryRunes: getRunesByBranch(primaryBranch),
    secondaryRunes: getRunesByBranch(secondaryBranch),
    applySavedBuild, resetBuild,
    linkedBuild, unlinkBuild: () => setLinkedBuild(null), linkedBuildIdFor,
    buildPanel, setBuildPanel,
    /** Campos de la build para guardar la partida (con la build guardada vinculada, si la hay). */
    payload: champion => ({
      items_used: selectedItems.map(i => i.name),
      runes_used: selectedRunes.map(r => r.name),
      spells_used: selectedSpells,
      build_id: linkedBuildIdFor(champion),
    }),
  };
}

const groupRunes = (list) => {
  const grouped = {};
  for (const rune of list) {
    const group = rune.group || 1;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(rune);
  }
  return grouped;
};

// ── Etiquetas y estadísticas ───────────────────────────────────────────────────

export function useMatchTags(initialTags = []) {
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    setTags(prev => {
      const exists = prev.some(tag => tag.toLowerCase() === nextTag.toLowerCase());
      return exists ? prev : [...prev, nextTag];
    });
    setTagInput('');
  };

  const removeTag = (tagToRemove) => setTags(prev => prev.filter(tag => tag !== tagToRemove));

  const togglePresetTag = (presetTag) => {
    setTags(prev => {
      const selectedTag = prev.find(tag => tag.toLowerCase() === presetTag.toLowerCase());
      return selectedTag ? prev.filter(tag => tag !== selectedTag) : [...prev, presetTag];
    });
  };

  return {
    tags, tagInput, setTagInput, addTag, removeTag, togglePresetTag,
    customTags: tags.filter(tag => !PRESET_MATCH_TAGS.some(preset => preset.toLowerCase() === tag.toLowerCase())),
    /** Etiquetas a guardar: incluye lo escrito sin confirmar con Enter. */
    payload: () => cleanTags([...tags, tagInput]),
  };
}

/** Resultado, lado, K / D / A, oro, kills de equipo y duración. Vacío es "sin dato". */
export function useMatchStats(initial = {}) {
  const [result, setResult] = useState(initial.result || 'win');
  const [side, setSide] = useState(initial.side || '');
  const [kills, setKills] = useState(toInputValue(initial.kills));
  const [deaths, setDeaths] = useState(toInputValue(initial.deaths));
  const [assists, setAssists] = useState(toInputValue(initial.assists));
  const [gold, setGold] = useState(toInputValue(initial.gold));
  const [duration, setDuration] = useState(toInputValue(initial.duration_minutes));
  const [teamKills, setTeamKills] = useState(toInputValue(initial.team_kills));
  const [enemyTeamKills, setEnemyTeamKills] = useState(toInputValue(initial.enemy_team_kills));

  const kdaPreview = kills !== '' && deaths !== '' && assists !== ''
    ? matchKda(Number(kills), Number(deaths), Number(assists)).toFixed(2)
    : '—';

  return {
    result, setResult, side, setSide,
    kills, setKills, deaths, setDeaths, assists, setAssists,
    gold, setGold, duration, setDuration,
    teamKills, setTeamKills, enemyTeamKills, setEnemyTeamKills,
    kdaPreview,
    /** Campos numéricos para guardar (el lado lo decide cada flujo). */
    payload: () => ({
      result,
      kills: numberOrNull(kills),
      deaths: numberOrNull(deaths),
      assists: numberOrNull(assists),
      gold: numberOrNull(gold),
      duration_minutes: numberOrNull(duration),
      team_kills: numberOrNull(teamKills),
      enemy_team_kills: numberOrNull(enemyTeamKills),
    }),
  };
}

// ── Componentes ────────────────────────────────────────────────────────────────

/** Selector segmentado de dos o más opciones (resultado, lado del mapa). */
export function SegmentedChoice({ value, onChange, options }) {
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
export function StatInput({ label, value, onChange, placeholder = '—', autoFocus = false }) {
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

export function StepProgress({ step }) {
  const stepIndex = MATCH_STEPS.indexOf(step);
  return (
    <div className="flex gap-2">
      {MATCH_STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-all ${
            step === s ? 'bg-primary' : stepIndex >= i ? 'bg-primary/50' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export function StepHeader({ title, description }) {
  return (
    <div>
      <h2 className="font-rajdhani font-bold text-2xl text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

/** Botonera de un paso: Atrás, Cancelar (opcional) y la acción principal (children). */
export function StepActions({ onBack, onCancel, cancelGrow = false, className = '', children }) {
  const t = useT();
  return (
    <div className={`flex gap-3 ${className}`.trim()}>
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm px-4 py-2">
          <ArrowLeft size={16} /> {t('buildV2.atras')}
        </button>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel}
          className={`${cancelGrow ? 'flex-1 ' : ''}px-4 py-2 rounded-lg font-medium text-foreground border border-border hover:border-border/80 transition-colors`}>
          {t('common.cancel')}
        </button>
      )}
      {children}
    </div>
  );
}

export function NextButton({ onClick, disabled = false, title, children }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
      {children ?? t('common.next')}
    </button>
  );
}

/** Paso "Datos de la partida": fecha, hora, parche y tipo. */
export function MatchInfoFields({ date, setDate, hour, setHour, patch, onPatchChange, patches, matchType, setMatchType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('common.date')}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_CLASS} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('matches.horaOpcional')}</label>
        <input type="time" value={hour} onChange={e => setHour(e.target.value)} className={INPUT_CLASS} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('goals.filterLabels.patches')}</label>
        <PatchSelect value={patch} onChange={onPatchChange} patches={patches} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('goals.filterLabels.types')}</label>
        <select value={matchType} onChange={e => setMatchType(e.target.value)} className={INPUT_CLASS}>
          {MATCH_TYPES.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function LaneButtons({ lane, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {LANES.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => onSelect(l)}
          className={`px-4 py-3 rounded-lg border-2 font-medium transition-all capitalize ${
            lane === l ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/50'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * Equipo por línea: slots a la izquierda y grilla de campeones. `lockedRole` es la línea
 * propia en la edición: ese slot no se puede quitar desde acá.
 */
export function ChampionPoolByRole({ champions, title, selected, onSelect, lockedRole, mirrored = false }) {
  const t = useT();
  const selectedByRole = {};
  LANES.forEach(role => {
    selectedByRole[role] = selected.find(s => s.role === role);
  });
  const selectedRoleOf = (champ) => LANES.find(role => selectedByRole[role]?.name === champ.name);

  return (
    <div className="rd-card rd-team-pool p-4">
      <div className={`flex items-center justify-between mb-4 ${mirrored ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-2"><span className="w-4 h-px bg-primary/50" /><h3 className="rd-card-title">{title}</h3></div>
        <span className="text-xs text-muted-foreground">{selected.length}/{LANES.length}</span>
      </div>

      <div className="rd-team-pool-body grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3 pb-4 border-b border-border lg:border-b-0 lg:pb-0">
          {LANES.map(role => {
            const champ = selectedByRole[role];
            const locked = lockedRole === role;
            return (
              <div key={role} className={`flex items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
                <div className={`w-16 text-xs font-semibold text-muted-foreground ${mirrored ? 'text-right' : ''}`}>{t(`lanes.${role}`)}</div>
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
          <ChampionGrid
            champions={champions}
            isSelected={champ => Boolean(selectedRoleOf(champ))}
            onPick={champ => {
              const selectedRole = selectedRoleOf(champ);
              if (selectedRole) {
                if (selectedRole !== lockedRole) onSelect(selectedByRole[selectedRole], selectedRole);
                return;
              }
              const firstEmptyRole = LANES.find(role => role !== lockedRole && !selectedByRole[role]);
              if (firstEmptyRole) onSelect(champ, firstEmptyRole);
            }}
            gridClassName="rd-team-pool-grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 max-h-60 md:max-h-[max(15rem,calc(100dvh-26rem))]"
          />
        </div>
      </div>
    </div>
  );
}

function RuneIcon({ rune, selected, onClick, className, imageClassName = '' }) {
  const { entityName } = useCatalogText();
  return (
    <EntityHoverCard entity={rune} kind={rune.branch}>
      <button
        type="button"
        onClick={onClick}
        className={`${className} rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
          selected ? SELECTED_ICON : 'opacity-45 hover:opacity-85'
        }`}
      >
        {rune.image_url ? (
          <img src={rune.image_url} alt={entityName(rune)} className={`w-full h-full object-cover rounded-full ${imageClassName}`.trim()} />
        ) : (
          <span className="text-xs font-bold text-primary">{entityName(rune)[0]}</span>
        )}
      </button>
    </EntityHoverCard>
  );
}

/** Paso "Tu build": objetos a la izquierda; runas y hechizos a la derecha. `children`: botonera. */
export function BuildStep({ description, champion, patch, build, items, spells, children }) {
  const t = useT();
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const { selectedItems, selectedSpells, buildPanel, setBuildPanel } = build;
  const branchColumns = [
    { label: t('builds.ramaPrincipal'), branch: build.primaryBranch, onBranchChange: build.handlePrimaryBranchChange, branchRunes: build.primaryRunes, onToggle: build.handleTogglePrimaryRune },
    { label: t('builds.ramaSecundaria'), branch: build.secondaryBranch, onBranchChange: build.handleSecondaryBranchChange, branchRunes: build.secondaryRunes, onToggle: build.handleToggleSecondaryRune },
  ];

  return (
    <div className="rd-buildstep space-y-6">
      {/* Encabezado: título y build guardada en una sola franja. */}
      <div className="rd-buildstep-header flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <StepHeader title={t('matches.tuBuild')} description={description} />
        <div className="w-full xl:w-[min(36rem,55%)]">
          <SavedBuildPicker
            champion={champion}
            patch={patch}
            onApply={build.applySavedBuild}
            linkedBuildId={build.linkedBuildIdFor(champion)}
            onUnlink={build.unlinkBuild}
            compact
          />
        </div>
      </div>

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
          <div className="rd-buildstep-pool rd-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-px bg-primary/50" />
                <h3 className="rd-card-title">
                  {t('builds.objetos')}{selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length}/5 + botas)
                </h3>
              </div>
            </div>
            <ItemPool selectedItems={selectedItems} onRemove={build.removeItem} />
          </div>
          <ItemBrowser items={items} selectedItems={selectedItems} onSelect={build.addItem} />
        </div>

        <div className="rd-buildstep-side flex min-w-0 flex-col gap-4">
          <div className="rd-card rd-buildstep-runes flex flex-col p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-px bg-primary/50" />
              <h3 className="rd-card-title">{t('common.runes')}</h3>
            </div>

            <div className="rd-runes-content flex flex-1 flex-col gap-3">
              {build.claveRunes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t('builds.clave')}</p>
                  <div className="grid justify-items-center gap-1" style={{ gridTemplateColumns: `repeat(${build.claveRunes.length}, minmax(0, 1fr))` }}>
                    {build.claveRunes.map(rune => (
                      <RuneIcon
                        key={rune.id}
                        rune={rune}
                        selected={build.isRuneSelected(rune)}
                        onClick={() => build.toggleKeystone(rune)}
                        className="relative aspect-square w-full max-w-11"
                        imageClassName="scale-[1.35]"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-border/50" />

              <div className="rd-runes-branches grid flex-1 grid-cols-2 gap-4">
                {branchColumns.map(column => (
                  <div key={column.label} className="flex min-w-0 flex-col">
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">{column.label}</label>
                    <select
                      value={column.branch}
                      onChange={e => column.onBranchChange(e.target.value)}
                      className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground mb-2 outline-none focus:border-primary/40 transition-all"
                    >
                      {PRIMARY_BRANCHES.map(b => (
                        <option key={b} value={b}>{runeBranchLabel(b)}</option>
                      ))}
                    </select>

                    <div className="flex flex-1 flex-col justify-evenly gap-2">
                      {Object.entries(groupRunes(column.branchRunes)).map(([group, runesInGroup], index) => (
                        <Fragment key={group}>
                          {index > 0 && <div className="h-px origin-center scale-y-50 bg-primary/20" aria-hidden="true" />}
                          <div className="flex items-center">
                            <div className="flex flex-1 flex-wrap justify-around gap-2">
                              {runesInGroup.map(rune => (
                                <RuneIcon
                                  key={rune.id}
                                  rune={rune}
                                  selected={build.isRuneSelected(rune)}
                                  onClick={() => column.onToggle(rune)}
                                  className="w-8 h-8 xl:w-10 xl:h-10"
                                />
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
                      onClick={() => build.toggleSpell(spell.name)}
                      aria-disabled={disabled}
                      className={`aspect-square w-full max-w-12 min-w-0 flex items-center justify-center rounded-full transition-all overflow-hidden ${
                        selected ? SELECTED_ICON : 'opacity-50 hover:opacity-90'
                      } ${disabled ? '!opacity-25 cursor-not-allowed' : ''}`}
                    >
                      {spell.image_url
                        ? <img src={spell.image_url} alt={spell.name} className="w-full h-full rounded-full object-cover" />
                        : <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>}
                    </button>
                  </EntityHoverCard>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

/** Paso "Detalles de la partida": resultado, rendimiento, etiquetas y notas. `children`: botonera. */
export function StatsStep({ description, stats, tagsState, notes, setNotes, notesId, autoFocusKills = false, children }) {
  const t = useT();
  const { side, setSide } = stats;

  return (
    <div className="rd-statsstep space-y-6">
      <StepHeader title={t('matches.detallesDeLaPartida')} description={description} />

      <div className="rd-statsstep-body grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Resultado y rendimiento: lo que se carga en todas las partidas. */}
        <section className="rd-card flex flex-col gap-5 p-4 md:p-5" aria-label={t('matches.resultadoYRendimiento')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">{t('matches.resultado')}</p>
              <SegmentedChoice
                value={stats.result}
                onChange={stats.setResult}
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

          {/* Fila 1: tu rendimiento (K / D / A y oro). */}
          <div className="rd-statsstep-kda-row grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-end gap-3">
            <div className="rd-statsstep-kda">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">K / D / A</p>
                <p className="text-xs text-muted-foreground">
                  {t('goals.stat.kda')} <span className="font-semibold text-primary">{stats.kdaPreview}</span>
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
                <StatInput label={t('goals.stat.asesinatos')} value={stats.kills} onChange={stats.setKills} autoFocus={autoFocusKills} />
                <span className="pb-2 text-lg text-muted-foreground">/</span>
                <StatInput label={t('goals.stat.muertes')} value={stats.deaths} onChange={stats.setDeaths} />
                <span className="pb-2 text-lg text-muted-foreground">/</span>
                <StatInput label={t('goals.stat.asistencias')} value={stats.assists} onChange={stats.setAssists} />
              </div>
            </div>
            <StatInput label={t('goals.stat.oro')} value={stats.gold} onChange={stats.setGold} placeholder={t('matches.ej9500')} />
          </div>

          {/* Fila 2: la partida (kills de cada equipo, para la participación en kills del Coach, y duración). */}
          <div className="rd-statsstep-totals grid grid-cols-3 gap-3">
            <StatInput label={t('matches.teamKills')} value={stats.teamKills} onChange={stats.setTeamKills} />
            <StatInput label={t('matches.enemyTeamKills')} value={stats.enemyTeamKills} onChange={stats.setEnemyTeamKills} />
            <StatInput label={t('matches.duracionMin')} value={stats.duration} onChange={stats.setDuration} placeholder={t('matches.ej18')} />
          </div>
          <p className="mt-auto text-[11px] text-muted-foreground">{t('matches.losDatosVaciosSe')}</p>
        </section>

        {/* Contexto opcional: etiquetas y notas. */}
        <section className="rd-card rd-statsstep-context flex flex-col gap-4 p-4 md:p-5" aria-label={t('matches.contexto')}>
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              {t('matches.etiquetas')} <span className="text-muted-foreground font-normal text-xs">{t('matches.opcional')}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_MATCH_TAGS.map(tag => {
                const isSelected = tagsState.tags.some(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => tagsState.togglePresetTag(tag)}
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
              {tagsState.customTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => tagsState.removeTag(tag)}
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
                value={tagsState.tagInput}
                onChange={e => tagsState.setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    tagsState.addTag();
                  }
                }}
                placeholder={t('matches.etiquetaPropiaEnterPara')}
                className="min-w-0 flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
              />
              <button
                type="button"
                onClick={tagsState.addTag}
                className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
              >
                {t('matches.agregar')}
              </button>
            </div>
          </div>

          <div className="rd-statsstep-notes flex min-h-0 flex-1 flex-col">
            <label htmlFor={notesId} className="text-sm font-semibold text-foreground mb-2">
              {t('matches.notas')} <span className="text-muted-foreground font-normal text-xs">{t('matches.opcional')}</span>
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('matches.observacionesSobreLaPartida')}
              className="min-h-24 w-full flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none"
            />
          </div>
        </section>
      </div>

      {children}
    </div>
  );
}
