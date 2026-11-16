import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/LocaleContext';
import { useQuery } from '@tanstack/react-query';
import ChampionGrid from '@/components/matches/ChampionGrid';
import { DEFAULT_MATCH_TYPE } from '@/constants/matchTypes';
import { getGamePatchCatalog } from '@/api/gameCatalogSupabase';
import { runeBranchesFor } from '@/features/matchCapture/captureFields';
import { useSpells } from '@/hooks/useSpells';
import {
  BuildStep,
  ChampionPoolByRole,
  FIT_VIEWPORT_STEPS,
  LaneButtons,
  MatchInfoFields,
  NextButton,
  PRIMARY_BRANCHES,
  StatsStep,
  StepActions,
  StepHeader,
  StepProgress,
  getChampionNamesByRole,
  useMatchBuild,
  useMatchStats,
  useMatchTags,
} from '@/components/matches/matchFlow';

// Compatibilidad: estos componentes vivían acá.
export { SegmentedChoice, StatInput } from '@/components/matches/matchFlow';

/**
 * initialMatch (opcional): precarga del formulario, por ejemplo desde la carga con
 * capturas. Nombres de catálogo, no objetos: { patch, date, hour, type, lane,
 * own_champion_name, allies: [{ name, role }], enemies: [{ name, role }], items_used,
 * runes_used, spells_used, result, kills, deaths, assists, gold, duration_minutes,
 * team_kills, enemy_team_kills,
 * review: claves de matchCapture.fields.* a revisar }.
 */
/** captureAction (opcional): acción extra en "Datos de la partida" (p. ej. cargar con capturas). */
export default function MatchBuilder({ champions: fallbackChampions = [], patches = [], defaultPatch = '', onSave, onCancel, isSaving = false, initialMatch = null, captureAction = null }) {
  const t = useT();
  const clientRequestIdRef = useRef(null);
  if (!clientRequestIdRef.current) {
    clientRequestIdRef.current = globalThis.crypto?.randomUUID?.()
      || `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const [patch, setPatch] = useState(initialMatch?.patch || defaultPatch);
  const patchWasEdited = useRef(false);

  const [step, setStep] = useState('info'); // info, champion, allies, enemies, build, stats
  const [lane, setLane] = useState(initialMatch?.lane || '');
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

  const build = useMatchBuild({ items, runes, initialSpells: (initialMatch?.spells_used || []).slice(0, 2) });
  const stats = useMatchStats(initialMatch || {});
  const tagsState = useMatchTags();
  const [notes, setNotes] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const [date, setDate] = useState(initialMatch?.date || todayStr);
  const [hour, setHour] = useState(initialMatch?.hour || '');
  const [matchType, setMatchType] = useState(initialMatch?.type || DEFAULT_MATCH_TYPE);

  const toggleTeamSlot = setTeam => (champ, role) => {
    if (!champ?.id) return;
    setTeam(prev => (prev.some(c => c.id === champ.id)
      ? prev.filter(c => c.id !== champ.id)
      : [...prev.filter(c => c.role !== role), { ...champ, role }]));
  };
  const handleSelectAlly = toggleTeamSlot(setAllyChampions);
  const handleSelectEnemy = toggleTeamSlot(setEnemyChampions);

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
    build.resetBuild();
  };

  // Precarga (carga con capturas): campeones, objetos y runas necesitan el catálogo del
  // parche, así que se resuelven una sola vez cuando llega.
  const prefillPendingRef = useRef(Boolean(initialMatch));
  const { setSelectedItems, setSelectedRunes, setBranches } = build;
  useEffect(() => {
    if (!prefillPendingRef.current || !catalog) return;
    prefillPendingRef.current = false;
    const catalogChampions = catalog.champions || [];
    const championByName = name => catalogChampions.find(champion => champion.name === name);
    const toSlots = slots => (slots || [])
      .map(slot => {
        const champion = championByName(slot.name);
        return champion ? { ...champion, role: slot.role } : null;
      })
      .filter(Boolean);

    const own = championByName(initialMatch.own_champion_name);
    const allies = toSlots(initialMatch.allies);
    if (own) {
      setMyChampion(own);
      setAllyChampions(initialMatch.lane
        ? [...allies.filter(ally => ally.role !== initialMatch.lane), { ...own, role: initialMatch.lane }]
        : allies);
    } else {
      setAllyChampions(allies);
    }
    setEnemyChampions(toSlots(initialMatch.enemies));

    const resolvedItems = (initialMatch.items_used || []).map(name => (catalog.items || []).find(item => item.name === name)).filter(Boolean);
    const resolvedRunes = (initialMatch.runes_used || []).map(name => (catalog.runes || []).find(rune => rune.name === name)).filter(Boolean);
    setSelectedItems(resolvedItems);
    setSelectedRunes(resolvedRunes);
    setBranches(runeBranchesFor(resolvedRunes, PRIMARY_BRANCHES));
  }, [catalog, initialMatch, setSelectedItems, setSelectedRunes, setBranches]);

  // Paso "Rol y campeón": la línea y el campeón propio se eligen juntos. Tu campeón
  // ocupa el slot de tu línea en el equipo aliado; si cambia la línea, se mueve.
  const selectLane = (nextLane) => {
    if (myChampion) {
      setAllyChampions(prev => [
        ...prev.filter(a => a.id !== myChampion.id && a.role !== nextLane),
        { ...myChampion, role: nextLane },
      ]);
    }
    setLane(nextLane);
  };

  // Con la línea ya elegida, elegir el campeón avanza al equipo aliado (como antes).
  const selectMyChampion = (champ) => {
    setMyChampion(champ);
    if (!lane) return;
    setAllyChampions(prev => [
      ...prev.filter(a => a.role !== lane && a.id !== myChampion?.id),
      { ...champ, role: lane },
    ]);
    setStep('allies');
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
      ...build.payload(),
      ...stats.payload(),
      side: stats.side,
      date,
      hour: hour || null,
      patch,
      type: matchType,
      tags: tagsState.payload(),
      notes,
    });
  };

  const fitsViewport = FIT_VIEWPORT_STEPS.includes(step);

  return (
    <div className={`rd-match-flow space-y-6 ${fitsViewport ? 'rd-match-builder-fit' : ''}`}>
      <StepProgress step={step} />

      {/* Step: Info (fecha y parche) */}
      {step === 'info' && (
        <div className="space-y-4">
          <StepHeader title={t('matches.datosDeLaPartida')} description={t('matches.elegiCuandoJugasteEl')} />
          {captureAction && !initialMatch && (
            <div className="rd-match-capture-action space-y-1">
              {captureAction}
              <p className="text-center text-xs text-muted-foreground">{t('matchCapture.actions.orManual')}</p>
            </div>
          )}
          <MatchInfoFields
            date={date} setDate={setDate} hour={hour} setHour={setHour}
            patch={patch} onPatchChange={handlePatchChange} patches={patches}
            matchType={matchType} setMatchType={setMatchType}
          />
          <StepActions onCancel={onCancel} cancelGrow className="pt-2">
            <NextButton onClick={() => setStep('champion')} />
          </StepActions>
        </div>
      )}

      {/* Step: Rol y campeón */}
      {step === 'champion' && (
        <div className="space-y-4">
          <StepHeader title={t('matches.rolYCampeon')} description={t('matches.elegiLaLineaY')} />
          <LaneButtons lane={lane} onSelect={selectLane} />
          <div>
            <ChampionGrid
              champions={champions}
              size="lg"
              isSelected={champ => myChampion?.id === champ.id}
              onPick={selectMyChampion}
              gridClassName="grid-cols-5 sm:grid-cols-7 md:grid-cols-9 max-h-[max(10rem,calc(100dvh-22rem))]"
            />
          </div>
          <StepActions onBack={() => setStep('info')}>
            <NextButton
              onClick={() => setStep('allies')}
              disabled={!lane || !myChampion}
              title={lane && myChampion ? undefined : t('matches.elegiTuLineaY')}
            />
          </StepActions>
        </div>
      )}

      {/* Step: Allies */}
      {step === 'allies' && (
        <div className="rd-team-step space-y-4">
          <StepHeader title={t('matches.equipoAliado')} description={t('matches.tuCampeonYaEsta')} />
          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoAzul')}
            selected={allyChampions}
            onSelect={handleSelectAlly}
          />
          <StepActions onBack={() => setStep('champion')}>
            <NextButton onClick={() => setStep('enemies')} disabled={allyChampions.length < 5} />
          </StepActions>
        </div>
      )}

      {/* Step: Enemies */}
      {step === 'enemies' && (
        <div className="rd-team-step space-y-4">
          <StepHeader title={t('matches.equipoEnemigo')} description={t('matches.seleccionaLos5Campeones')} />
          <ChampionPoolByRole
            champions={champions}
            title={t('matches.equipoRojo')}
            selected={enemyChampions}
            onSelect={handleSelectEnemy}
            mirrored
          />
          <StepActions onBack={() => setStep('allies')}>
            <NextButton onClick={() => setStep('build')} disabled={enemyChampions.length < 5} />
          </StepActions>
        </div>
      )}

      {/* Step: Build */}
      {step === 'build' && (
        <BuildStep
          description={t('matches.seleccionaLosItemsRunas')}
          champion={myChampion}
          patch={patch}
          build={build}
          items={items}
          spells={spells}
        >
          <StepActions onBack={() => setStep('enemies')} className="pt-4 border-t border-border">
            <NextButton onClick={() => setStep('stats')} />
          </StepActions>
        </BuildStep>
      )}

      {/* Step: Stats */}
      {step === 'stats' && (
        <StatsStep
          description={t('matches.completaLosDatosDe')}
          stats={stats}
          tagsState={tagsState}
          notes={notes}
          setNotes={setNotes}
          notesId="match-notes"
          autoFocusKills
        >
          <StepActions onBack={() => setStep('build')} onCancel={onCancel} cancelGrow className="pt-4 border-t border-border">
            <NextButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('common.saving') : t('matches.guardarPartida')}
            </NextButton>
          </StepActions>
        </StatsStep>
      )}
    </div>
  );
}
