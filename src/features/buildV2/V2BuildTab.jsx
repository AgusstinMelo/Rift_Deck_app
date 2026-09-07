import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { loadV2Snapshot } from './v2DataLoader';
import { buildV2Prompt, estimatePromptTokens } from './v2PromptBuilder';
import { requestV2Build } from './v2AiClient';
import { validateV2Result } from './v2Validation';
import { resolveV2Result } from './v2ResultResolver';
import V2BuildResult from './V2BuildResult';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const LABELS = { top: 'Top', jungler: 'Jungla', mid: 'Mid', adc: 'ADC', support: 'Support' };
const emptyTeam = () => Object.fromEntries(LANES.map(lane => [lane, '']));

function ChampionSelect({ label, value, champions, onChange }) {
  return <label className="block"><span className="rd-label block mb-1.5">{label}</span><select className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm" value={value} onChange={e => onChange(e.target.value)}><option value="">Seleccionar…</option>{champions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
}

export default function V2BuildTab() {
  const { data: snapshot, isLoading, error: loadError } = useQuery({ queryKey: ['build-v2-snapshot'], queryFn: loadV2Snapshot, staleTime: 300000 });
  const [championId, setChampionId] = useState('');
  const [role, setRole] = useState('adc');
  const [allies, setAllies] = useState(emptyTeam);
  const [enemies, setEnemies] = useState(emptyTeam);
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const champions = useMemo(() => [...(snapshot?.champions || [])].sort((a, b) => a.name.localeCompare(b.name)), [snapshot]);
  const setMember = (setter, lane, value) => setter(team => ({ ...team, [lane]: value }));
  const selectMain = id => { setChampionId(id); setAllies(team => ({ ...team, [role]: id })); };
  const changeRole = next => { setAllies(team => { const value = { ...team }; if (value[role] === championId) value[role] = ''; if (championId) value[next] = championId; return value; }); setRole(next); };

  async function generate() {
    if (!snapshot || !championId || Object.values(allies).some(x => !x) || Object.values(enemies).some(x => !x)) { setState('validation_error'); setError('Completá campeón, rol y las dos composiciones.'); return; }
    if (allies[role] !== championId) { setState('validation_error'); setError('El campeón elegido debe ocupar el rol seleccionado en aliados.'); return; }
    if (new Set(Object.values(allies)).size !== 5 || new Set(Object.values(enemies)).size !== 5) { setState('validation_error'); setError('No puede repetirse un campeón dentro del mismo equipo.'); return; }
    setState('loading'); setError(''); setResult(null);
    try {
      const prompt = buildV2Prompt({ snapshot, championId, role, allies, enemies });
      if (import.meta.env.DEV) console.debug('[Build IA V2] request', { snapshot, counts: { champions: snapshot.champions.length, coreItems: snapshot.coreItems.length, movementItems: snapshot.movementItems.length, runes: snapshot.runes.length, spells: snapshot.spells.length }, prompt, promptLength: prompt.length, estimatedTokens: estimatePromptTokens(prompt) });
      const response = await requestV2Build(prompt, snapshot);
      if (import.meta.env.DEV) console.debug('[Build IA V2] response', { raw: response.raw, parsed: response.parsed });
      const validation = validateV2Result(response.parsed, snapshot, { role });
      if (!validation.ok) { if (import.meta.env.DEV) console.debug('[Build IA V2] validation', validation); setState('validation_error'); setError([...validation.schemaErrors, ...validation.validationErrors].join(' ')); return; }
      setResult({ ...resolveV2Result(validation.data, snapshot), champion: snapshot.champions.find(c => String(c.id) === championId), role }); setState('success');
    } catch (cause) { setState(cause.kind === 'malformed_response' ? 'malformed_response' : 'provider_error'); setError(cause.message); if (import.meta.env.DEV) console.debug('[Build IA V2] error', { kind: cause.kind, raw: cause.raw, message: cause.message }); }
  }

  if (isLoading) return <div className="rd-card p-8 text-center text-muted-foreground">Cargando snapshot del parche activo…</div>;
  if (loadError) return <V2BuildResult state="provider_error" error={`No se pudo cargar Supabase: ${loadError.message}`} />;
  return <div className="space-y-6">
    <div className="rd-card p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h2 className="font-rajdhani text-xl font-bold">Build IA V2</h2><p className="text-xs text-muted-foreground">Snapshot {snapshot.patchVersion} · {snapshot.loadedAt}</p></div><span className="rd-status-pill">Experimental</span></div><div className="grid md:grid-cols-2 gap-4"><ChampionSelect label="Campeón" value={championId} champions={champions} onChange={selectMain} /><label><span className="rd-label block mb-1.5">Rol</span><select className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm" value={role} onChange={e => changeRole(e.target.value)}>{LANES.map(lane => <option key={lane} value={lane}>{LABELS[lane]}</option>)}</select></label></div></div>
    <div className="grid lg:grid-cols-2 gap-4">{[['Composición aliada', allies, setAllies], ['Composición enemiga', enemies, setEnemies]].map(([title, team, setter]) => <div key={title} className="rd-card p-5"><p className="rd-label mb-4">{title}</p><div className="space-y-3">{LANES.map(lane => <ChampionSelect key={lane} label={LABELS[lane]} value={team[lane]} champions={champions} onChange={value => setMember(setter, lane, value)} />)}</div></div>)}</div>
    <button onClick={generate} disabled={state === 'loading'} className="w-full rd-button-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50">{state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} Generar build contextual</button>
    <V2BuildResult state={state} result={result} error={error} />
  </div>;
}
