import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Loader2, Sparkles, Swords, Users } from 'lucide-react';
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
  return <label className="block"><span className="rd-label mb-1.5 block">{label}</span><select className="w-full rounded-xl border border-border/70 bg-secondary/55 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50" value={value} onChange={e => onChange(e.target.value)}><option value="">Seleccionar…</option>{champions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
}

function DraftCard({ title, icon: Icon, team, setter, champions, onMemberChange, hiddenLane }) {
  return <section className="rd-card p-5"><div className="mb-4 flex items-center gap-2"><Icon size={15} className="text-primary" /><h2 className="rd-card-title">{title}</h2></div><div className="space-y-3">{LANES.filter(lane => lane !== hiddenLane).map(lane => <ChampionSelect key={lane} label={LABELS[lane]} value={team[lane]} champions={champions} onChange={value => onMemberChange(setter, lane, value)} />)}</div></section>;
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
  const [buildPreference, setBuildPreference] = useState('');
  const champions = useMemo(() => [...(snapshot?.champions || [])].sort((a, b) => a.name.localeCompare(b.name)), [snapshot]);
  const selectedChampion = champions.find(champion => String(champion.id) === championId);
  const setMember = (setter, lane, value) => setter(team => ({ ...team, [lane]: value }));
  const selectMain = id => { setChampionId(id); setAllies(team => ({ ...team, [role]: id })); };
  const changeRole = next => { setAllies(team => { const value = { ...team }; if (value[role] === championId) value[role] = ''; if (championId) value[next] = championId; return value; }); setRole(next); };

  async function generate() {
    if (!snapshot || !championId || Object.values(allies).some(x => !x) || Object.values(enemies).some(x => !x)) { setState('validation_error'); setError('Completá campeón, rol y las dos composiciones.'); return; }
    if (allies[role] !== championId) { setState('validation_error'); setError('El campeón elegido debe ocupar el rol seleccionado en aliados.'); return; }
    if (new Set(Object.values(allies)).size !== 5 || new Set(Object.values(enemies)).size !== 5) { setState('validation_error'); setError('No puede repetirse un campeón dentro del mismo equipo.'); return; }
    setState('loading'); setError(''); setResult(null);
    try {
      const prompt = buildV2Prompt({ snapshot, championId, role, allies, enemies, buildPreference });
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
  return <div className="space-y-4">
    <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 px-6 py-6 md:px-8 md:py-7">{selectedChampion?.image_url_card && <div className="pointer-events-none absolute inset-y-0 right-0 hidden h-full overflow-hidden sm:block"><div className="relative h-full w-fit overflow-hidden" style={{ WebkitMaskImage: 'linear-gradient(to left, black 0%, black 78%, transparent 100%)', maskImage: 'linear-gradient(to left, black 0%, black 78%, transparent 100%)' }}><img src={selectedChampion.image_url_card} alt="" className="h-full w-auto max-w-none object-contain object-right [filter:brightness(.72)_saturate(1.2)]" /><div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background via-background/70 to-transparent" /></div></div>}<div className="relative z-10"><div className="mb-3 flex items-center gap-2 text-primary"><BrainCircuit size={17} /><span className="text-[10px] font-semibold uppercase tracking-[0.28em]">AI Build Suggester V2</span></div><h1 className="max-w-xl font-rajdhani text-4xl font-bold uppercase leading-[0.9] tracking-[-0.06em] text-foreground md:text-6xl">Sugeridor<br />de builds</h1><p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">Objetos, runas y hechizos adaptados al campeón, rol y draft completo.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rd-status-pill">Datos del parche actual</span><span className="rd-status-pill">Build contextual con IA</span><span className="rd-status-pill">Explicaciones y sinergias</span></div></div></header>
    <div className="flex justify-end"><button onClick={generate} disabled={state === 'loading'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto">{state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{state === 'loading' ? 'Analizando draft…' : 'Generar build'}</button></div>
    <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="rd-card p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles size={15} className="text-primary" /><h2 className="rd-card-title">Tu selección</h2></div><span className="rd-status-pill">Parche {snapshot.patchVersion}</span></div><div className="space-y-3"><ChampionSelect label="Campeón" value={championId} champions={champions} onChange={selectMain} /><label className="block"><span className="rd-label mb-1.5 block">Rol</span><select className="w-full rounded-xl border border-border/70 bg-secondary/55 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50" value={role} onChange={e => changeRole(e.target.value)}>{LANES.map(lane => <option key={lane} value={lane}>{LABELS[lane]}</option>)}</select></label></div></section>
        <DraftCard title="Composición aliada" icon={Users} team={allies} setter={setAllies} champions={champions} onMemberChange={setMember} hiddenLane={role} />
        <DraftCard title="Composición enemiga" icon={Swords} team={enemies} setter={setEnemies} champions={champions} onMemberChange={setMember} />
        <section className="rd-card p-5"><div className="mb-3 flex items-center gap-2"><BrainCircuit size={15} className="text-primary" /><h2 className="rd-card-title">Temática opcional</h2></div><textarea value={buildPreference} onChange={event => setBuildPreference(event.target.value)} maxLength={240} rows={3} placeholder="Ej: velocidad de ataque y poder de habilidad" className="w-full resize-none rounded-xl border border-border/70 bg-secondary/55 px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50" /><div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-muted-foreground"><span>La IA la priorizará si es viable para el campeón y el draft.</span><span className="shrink-0 tabular-nums">{buildPreference.length}/240</span></div></section>

      </aside>
      <V2BuildResult state={state} result={result} error={error} />
    </div>
  </div>;
}
