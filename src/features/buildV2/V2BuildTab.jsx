import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Check, ChevronDown, Loader2, Search, Sparkles, Swords, Users } from 'lucide-react';
import { loadV2Snapshot } from './v2DataLoader';
import { buildV2Prompt, estimatePromptTokens } from './v2PromptBuilder';
import { requestV2Build } from './v2AiClient';
import { validateV2Result } from './v2Validation';
import { stabilizeV2Result } from './v2ResultStabilizer';
import { createEligibleV2Snapshot } from './v2Eligibility';
import { resolveV2Result } from './v2ResultResolver';
import V2BuildResult from './V2BuildResult';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const LABELS = { top: 'Top', jungler: 'Jungla', mid: 'Mid', adc: 'ADC', support: 'Support' };
const emptyTeam = () => Object.fromEntries(LANES.map(lane => [lane, '']));

function ChampionSelect({ label, value, champions, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const selected = champions.find(champion => String(champion.id) === String(value));
  const filtered = champions.filter(champion => champion.name.toLowerCase().includes(query.trim().toLowerCase()));
  const roleText = champion => {
    const roles = Array.isArray(champion.roles) ? champion.roles : String(champion.roles || champion.primary_role || '').split(',');
    return roles.map(role => String(role).trim()).filter(Boolean).join(' · ');
  };

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = id => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return <div ref={rootRef} className="relative" style={{ zIndex: open ? 80 : 1 }}>
    <span className="rd-label mb-1.5 block">{label}</span>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50">
      {selected?.image_url ? <img src={selected.image_url} alt="" className="h-7 w-7 shrink-0 rounded-full border border-primary/20 object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background/40 text-xs font-semibold text-primary">{selected?.name?.[0] || '?'}</span>}
      <span className="min-w-0 flex-1">
        <span className={selected ? 'block truncate font-medium' : 'block truncate text-muted-foreground'}>{selected?.name || 'Seleccionar…'}</span>
      </span>
      <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-primary/20 bg-[#0f1420] shadow-2xl shadow-black/60">
      <div className="sticky top-0 z-10 border-b border-border/70 bg-[#0f1420] p-2">
        <div className="flex items-center gap-2 rounded-lg bg-secondary/70 px-2.5">
          <Search size={14} className="text-muted-foreground" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar campeón…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto p-1.5">
        <button type="button" onClick={() => choose('')} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/70">—</span>
          <span className="flex-1">Sin seleccionar</span>
          {!value && <Check size={15} className="text-primary" />}
        </button>
        {filtered.map(champion => {
          const active = String(champion.id) === String(value);
          return <button key={champion.id} type="button" role="option" aria-selected={active} onClick={() => choose(String(champion.id))} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary ${active ? 'bg-primary/8' : ''}`}>
            {champion.image_url ? <img src={champion.image_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full border border-primary/20 object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-primary">{champion.name?.[0]}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{champion.name}</span>
              {roleText(champion) && <span className="block truncate text-[11px] text-muted-foreground">{roleText(champion)}</span>}
            </span>
            {active && <Check size={15} className="shrink-0 text-primary" />}
          </button>;
        })}
        {!filtered.length && <p className="px-3 py-5 text-center text-sm text-muted-foreground">No se encontraron campeones.</p>}
      </div>
    </div>}
  </div>;
}

function RoleSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = next => {
    onChange(next);
    setOpen(false);
  };

  return <div ref={rootRef} className="relative" style={{ zIndex: open ? 80 : 1 }}>
    <span className="rd-label mb-1.5 block">Rol</span>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-[10px] font-bold uppercase text-primary">{value ? LABELS[value].slice(0, 2) : '?'}</span>
      <span className={value ? 'min-w-0 flex-1 truncate font-medium' : 'min-w-0 flex-1 truncate text-muted-foreground'}>{value ? LABELS[value] : 'Seleccionar rol…'}</span>
      <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-primary/20 bg-[#0f1420] p-1.5 shadow-2xl shadow-black/60">
      {LANES.map(lane => {
        const active = lane === value;
        return <button key={lane} type="button" role="option" aria-selected={active} onClick={() => choose(lane)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary ${active ? 'bg-primary/8' : ''}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-secondary text-[11px] font-bold uppercase text-primary">{LABELS[lane].slice(0, 2)}</span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{LABELS[lane]}</span>
          {active && <Check size={15} className="shrink-0 text-primary" />}
        </button>;
      })}
    </div>}
  </div>;
}

function DraftCard({ title, icon: Icon, team, setter, champions, onMemberChange, hiddenLane }) {
  return <section className="rd-card rd-card-overflow-visible p-5 focus-within:z-30"><div className="mb-4 flex items-center gap-2"><Icon size={15} className="text-primary" /><h2 className="rd-card-title">{title}</h2></div><div className="space-y-3">{LANES.filter(lane => lane !== hiddenLane).map(lane => <ChampionSelect key={lane} label={LABELS[lane]} value={team[lane]} champions={champions} onChange={value => onMemberChange(setter, lane, value)} />)}</div></section>;
}

export default function V2BuildTab() {
  const { data: snapshot, isLoading, error: loadError } = useQuery({ queryKey: ['build-v2-snapshot'], queryFn: loadV2Snapshot, staleTime: 300000 });
  const [championId, setChampionId] = useState('');
  const [role, setRole] = useState('');
  const [allies, setAllies] = useState(emptyTeam);
  const [enemies, setEnemies] = useState(emptyTeam);
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [buildPreference, setBuildPreference] = useState('');
  const champions = useMemo(() => [...(snapshot?.champions || [])].sort((a, b) => a.name.localeCompare(b.name)), [snapshot]);
  const setMember = (setter, lane, value) => setter(team => ({ ...team, [lane]: value }));
  const selectMain = id => {
    setChampionId(id);
    if (role) setAllies(team => ({ ...team, [role]: id }));
  };
  const changeRole = next => {
    setAllies(team => {
      const value = { ...team };
      if (role && value[role] === championId) value[role] = '';
      if (championId && next) value[next] = championId;
      return value;
    });
    setRole(next);
  };

  async function generate() {
    if (!snapshot || !championId || !role) { setState('validation_error'); setError('Seleccioná un campeón y su rol.'); return; }
    if (allies[role] !== championId) { setState('validation_error'); setError('El campeón elegido debe ocupar el rol seleccionado en aliados.'); return; }
    const selectedAllies = Object.values(allies).filter(Boolean);
    const selectedEnemies = Object.values(enemies).filter(Boolean);
    if (new Set(selectedAllies).size !== selectedAllies.length || new Set(selectedEnemies).size !== selectedEnemies.length) { setState('validation_error'); setError('No puede repetirse un campeón dentro del mismo equipo.'); return; }
    setState('loading'); setError(''); setResult(null);
    try {
      const generationSnapshot = createEligibleV2Snapshot(snapshot, championId);
      const requestContext = { snapshot: generationSnapshot, championId, role, allies, enemies, buildPreference };
      let prompt = buildV2Prompt(requestContext);
      let lastValidation = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (import.meta.env.DEV) console.debug('[Build IA V2] request', { attempt, counts: { champions: generationSnapshot.champions.length, coreItems: generationSnapshot.coreItems.length, movementItems: generationSnapshot.movementItems.length, runes: generationSnapshot.runes.length, spells: generationSnapshot.spells.length }, promptLength: prompt.length, estimatedTokens: estimatePromptTokens(prompt) });
        let response;
        try {
          response = await requestV2Build(prompt, generationSnapshot, { role, attempt });
        } catch (cause) {
          if (attempt === 1 && cause.retryable) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            continue;
          }
          throw cause;
        }

        if (import.meta.env.DEV) console.debug('[Build IA V2] response', { attempt, raw: response.raw, parsed: response.parsed });
        const stabilized = stabilizeV2Result(response.parsed, generationSnapshot, { role });
        const validation = validateV2Result(stabilized, generationSnapshot, { role });
        if (validation.ok) {
          setResult({ ...resolveV2Result(validation.data, generationSnapshot), champion: snapshot.champions.find(c => String(c.id) === championId), role });
          setState('success');
          return;
        }

        lastValidation = validation;
        if (import.meta.env.DEV) console.debug('[Build IA V2] validation', { attempt, validation });
        if (attempt === 1) {
          prompt = buildV2Prompt({
            ...requestContext,
            correction: {
              errors: [...validation.schemaErrors, ...validation.validationErrors],
              previousResult: response.parsed,
            },
          });
        }
      }

      setState('validation_error');
      setError([...lastValidation.schemaErrors, ...lastValidation.validationErrors].join(' '));
    } catch (cause) { setState(cause.kind === 'malformed_response' ? 'malformed_response' : 'provider_error'); setError(cause.message); if (import.meta.env.DEV) console.debug('[Build IA V2] error', { kind: cause.kind, raw: cause.raw, message: cause.message }); }
  }

  if (isLoading) return <div className="rd-card p-8 text-center text-muted-foreground">Cargando snapshot del parche activo…</div>;
  if (loadError) return <V2BuildResult state="provider_error" error={`No se pudo cargar Supabase: ${loadError.message}`} />;
  return <div className="space-y-4">
    <header className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Rift Deck Build Intelligence</span>
          </div>
          <h1 className="font-rajdhani text-4xl font-bold uppercase tracking-[-0.08em] text-foreground md:text-5xl">Sugeridor de builds</h1>
          <p className="mt-1 text-sm text-muted-foreground">Objetos, runas y hechizos adaptados al campeón, rol y draft disponible.</p>
        </div>
        <div className="rd-status-pill hidden items-center gap-3 sm:flex">
          <BrainCircuit size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">Build Intelligence</span>
        </div>
    </header>
    <div className="flex justify-end"><button onClick={generate} disabled={state === 'loading'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto">{state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{state === 'loading' ? 'Analizando draft…' : 'Generar build'}</button></div>
    <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="rd-card rd-card-overflow-visible p-5 focus-within:z-30"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles size={15} className="text-primary" /><h2 className="rd-card-title">Tu selección</h2></div><span className="rd-status-pill">Parche {snapshot.patchVersion}</span></div><div className="space-y-3"><ChampionSelect label="Campeón" value={championId} champions={champions} onChange={selectMain} /><RoleSelect value={role} onChange={changeRole} /></div></section>
        <DraftCard title="Composición aliada" icon={Users} team={allies} setter={setAllies} champions={champions} onMemberChange={setMember} hiddenLane={role} />
        <DraftCard title="Composición enemiga" icon={Swords} team={enemies} setter={setEnemies} champions={champions} onMemberChange={setMember} />
        <section className="rd-card p-5"><div className="mb-3 flex items-center gap-2"><BrainCircuit size={15} className="text-primary" /><h2 className="rd-card-title">Temática opcional</h2></div><textarea value={buildPreference} onChange={event => setBuildPreference(event.target.value)} maxLength={240} rows={3} placeholder="Ej: velocidad de ataque y poder de habilidad" className="w-full resize-none rounded-xl border border-border/70 bg-secondary/55 px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50" /><div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-muted-foreground"><span>La IA la priorizará si es viable para el campeón y el draft.</span><span className="shrink-0 tabular-nums">{buildPreference.length}/240</span></div></section>

      </aside>
      <V2BuildResult state={state} result={result} error={error} />
    </div>
  </div>;
}
