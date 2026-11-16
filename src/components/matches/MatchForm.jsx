import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/LocaleContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { updateMatch } from '@/api/matchesSupabase';
import { ArrowLeft, Save } from 'lucide-react';
import ChampionGrid from '@/components/matches/ChampionGrid';
import { DEFAULT_MATCH_TYPE } from '@/constants/matchTypes';
import { getGamePatchCatalog } from '@/api/gameCatalogSupabase';
import { useSpells } from '@/hooks/useSpells';
import {
  BuildStep,
  ChampionPoolByRole,
  FIT_VIEWPORT_STEPS,
  LANES,
  LaneButtons,
  MatchInfoFields,
  NextButton,
  StatsStep,
  StepActions,
  StepHeader,
  StepProgress,
  branchesOfRunes,
  getChampionNamesByRole,
  useMatchBuild,
  useMatchStats,
  useMatchTags,
} from '@/components/matches/matchFlow';

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

// Elegir un campeón en una línea; volver a elegirlo en la misma línea la vacía.
const toggleInRole = (prev, champ, role) => {
  const isAlreadyInRole = prev.find(c => c.role === role && c.name === champ.name);
  if (isAlreadyInRole) return prev.filter(c => c.role !== role);
  return [...prev.filter(c => c.role !== role && c.name !== champ.name), { ...champ, role }];
};

export default function MatchForm({ match, patches = [], defaultPatch = '', onClose, onSaved }) {
  const t = useT();
  const [step, setStep] = useState('info');

  // Champion & composition
  const [lane, setLane] = useState(match?.lane || '');
  const [ownChampion, setOwnChampion] = useState(null); // will init after data loads
  const [allyChampions, setAllyChampions] = useState([]);
  const [enemyChampions, setEnemyChampions] = useState([]);
  const [alliesChanged, setAlliesChanged] = useState(false);
  const [enemiesChanged, setEnemiesChanged] = useState(false);

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
  const tagsState = useMatchTags(match?.tags || []);
  const stats = useMatchStats(match || {});

  const { data: spells = [] } = useSpells();

  const { data: catalog } = useQuery({
    queryKey: ['game-patch-catalog', patch],
    queryFn: () => getGamePatchCatalog(patch),
    enabled: Boolean(patch),
  });
  const champions = catalog?.champions || [];
  const items = catalog?.items || [];
  const runes = catalog?.runes || [];

  const build = useMatchBuild({ items, runes, initialSpells: match?.spells_used || [] });

  // Initialize champion/items/runes from match data once data is loaded
  const [initialized, setInitialized] = useState(false);

  const handlePatchChange = (nextPatch) => {
    patchWasEdited.current = true;
    setPatch(nextPatch);
    setInitialized(true);
    setOwnChampion(null);
    setAllyChampions([]);
    setEnemyChampions([]);
    build.resetBuild();
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
    if (match?.items_used?.length > 0) build.setSelectedItems(match.items_used.map(n => items.find(i => i.name === n)).filter(Boolean));
    if (match?.runes_used?.length > 0) {
      const resolvedRunes = match.runes_used.map(n => runes.find(r => r.name === n)).filter(Boolean);
      build.setSelectedRunes(resolvedRunes);
      // Restaurar las ramas principal y secundaria de las runas guardadas.
      build.setBranches(branchesOfRunes(resolvedRunes));
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
    setAllyChampions(prev => toggleInRole(prev, champ, role));
  };

  const handleSelectEnemy = (champ, role) => {
    setEnemiesChanged(true);
    setEnemyChampions(prev => toggleInRole(prev, champ, role));
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
      ...build.payload(),
      ...stats.payload(),
      side: stats.side || null,
      patch,
      type: matchType,
      date,
      hour: hour || null,
      notes,
      tags: tagsState.payload(),
    });
  };

  const fitsViewport = FIT_VIEWPORT_STEPS.includes(step);

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

      <StepProgress step={step} />

      {/* ── STEP 0: INFO ── */}
      {step === 'info' && (
        <div className="space-y-4">
          <StepHeader title={t('matches.datosDeLaPartida')} description={t('matches.elegiCuandoJugasteEl')} />
          <MatchInfoFields
            date={date} setDate={setDate} hour={hour} setHour={setHour}
            patch={patch} onPatchChange={handlePatchChange} patches={patches}
            matchType={matchType} setMatchType={setMatchType}
          />
          <StepActions className="pt-2">
            <NextButton onClick={() => setStep('champion')} />
          </StepActions>
        </div>
      )}

      {/* ── STEP 1: CAMPEÓN Y LÍNEA ── */}
      {step === 'champion' && (
        <div className="space-y-4">
          <StepHeader title={t('matches.campeonYLinea')} description={t('matches.seleccionaTuLineaY')} />
          <LaneButtons lane={lane} onSelect={handleLaneSelect} />

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

          <div>
            <ChampionGrid
              champions={champions}
              size="lg"
              isSelected={champ => ownChampion?.id === champ.id}
              onPick={handleOwnChampionSelect}
              gridClassName="grid-cols-5 sm:grid-cols-7 md:grid-cols-9 max-h-[max(10rem,calc(100dvh-32rem))]"
            />
          </div>

          <StepActions onBack={() => setStep('info')}>
            <NextButton onClick={() => setStep('allies')} />
          </StepActions>
        </div>
      )}

      {/* ── STEP 2: EQUIPO ALIADO ── */}
      {step === 'allies' && (
        <div className="rd-team-step space-y-4">
          <StepHeader title={t('matches.equipoAliado')} description={t('matches.editaLosCampeonesAliados')} />
          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoAzul')}
            selected={allyChampions}
            onSelect={handleSelectAlly}
            lockedRole={lane}
          />
          <StepActions onBack={() => setStep('champion')} onCancel={onClose}>
            <NextButton onClick={() => setStep('enemies')} />
          </StepActions>
        </div>
      )}

      {/* ── STEP 3: EQUIPO ENEMIGO ── */}
      {step === 'enemies' && (
        <div className="rd-team-step space-y-4">
          <StepHeader title={t('matches.equipoEnemigo')} description={t('matches.editaLosCampeonesEnemigos')} />
          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoRojo')}
            selected={enemyChampions}
            onSelect={handleSelectEnemy}
            mirrored
          />
          <StepActions onBack={() => setStep('allies')} onCancel={onClose}>
            <NextButton onClick={() => setStep('build')} />
          </StepActions>
        </div>
      )}

      {/* ── STEP 4: BUILD ── */}
      {step === 'build' && (
        <BuildStep
          description={t('matches.itemsRunasYHechizos')}
          champion={ownChampion}
          patch={patch}
          build={build}
          items={items}
          spells={spells}
        >
          <StepActions onBack={() => setStep('enemies')} onCancel={onClose} className="pt-4 border-t border-border">
            <NextButton onClick={() => setStep('stats')} />
          </StepActions>
        </BuildStep>
      )}

      {/* ── STEP 5: STATS ── */}
      {step === 'stats' && (
        <StatsStep
          description={t('matches.completaElResultadoY')}
          stats={stats}
          tagsState={tagsState}
          notes={notes}
          setNotes={setNotes}
          notesId="match-edit-notes"
        >
          <StepActions onBack={() => setStep('build')} onCancel={onClose} cancelGrow className="pt-4 border-t border-border">
            <button type="button" onClick={handleSave} disabled={saveMutation.isPending || !stats.result}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={16} /> {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </StepActions>
        </StatsStep>
      )}
    </div>
  );
}
