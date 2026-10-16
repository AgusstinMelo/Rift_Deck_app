import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, Sparkles, Swords, Users } from 'lucide-react';
import { loadV2Snapshot } from './v2DataLoader';
import { buildV2Prompt, estimatePromptTokens } from './v2PromptBuilder';
import { requestV2Build } from './v2AiClient';
import { validateV2Result } from './v2Validation';
import { stabilizeV2Result } from './v2ResultStabilizer';
import { createEligibleV2Snapshot } from './v2Eligibility';
import { resolveV2Result } from './v2ResultResolver';
import V2BuildResult from './V2BuildResult';
import StepNav from '@/components/suggester/StepNav';
import { useCloseOnOutside, useFloatingPanel } from '@/hooks/useFloatingPanel';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const LABELS = { top: 'Top', jungler: 'Jungla', mid: 'Mid', adc: 'ADC', support: 'Support' };
const emptyTeam = () => Object.fromEntries(LANES.map(lane => [lane, '']));

// Campo con la etiqueta al costado del selector, para ahorrar alto en los pasos.
const INLINE_FIELD = 'relative grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2';

function ChampionSelect({ label, value, champions, onChange, inline = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelStyle = useFloatingPanel(open, buttonRef, 340);
  const selected = champions.find(champion => String(champion.id) === String(value));
  const filtered = champions.filter(champion => champion.name.toLowerCase().includes(query.trim().toLowerCase()));
  const roleText = champion => {
    const roles = Array.isArray(champion.roles) ? champion.roles : String(champion.roles || champion.primary_role || '').split(',');
    return roles.map(role => String(role).trim()).filter(Boolean).join(' · ');
  };

  useCloseOnOutside(open, [buttonRef, panelRef], () => setOpen(false));

  const choose = id => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return <div className={inline ? INLINE_FIELD : 'relative'}>
    <span className={inline ? 'rd-label' : 'rd-label mb-1.5 block'}>{label}</span>
    <button ref={buttonRef} type="button" aria-label={inline ? label : undefined} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className={`flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50 ${inline ? 'min-h-10 py-1.5' : 'min-h-11 py-2'}`}>
      {selected?.image_url ? <img src={selected.image_url} alt="" className="h-7 w-7 shrink-0 rounded-full border border-primary/20 object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background/40 text-xs font-semibold text-primary">{selected?.name?.[0] || '?'}</span>}
      <span className="min-w-0 flex-1">
        <span className={selected ? 'block truncate font-medium' : 'block truncate text-muted-foreground'}>{selected?.name || 'Seleccionar…'}</span>
      </span>
      <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && panelStyle && createPortal(<div ref={panelRef} role="listbox" style={panelStyle} className="flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-[#0f1420] shadow-2xl shadow-black/60">
      <div className="shrink-0 border-b border-border/70 bg-[#0f1420] p-2">
        <div className="flex items-center gap-2 rounded-lg bg-secondary/70 px-2.5">
          <Search size={14} className="text-muted-foreground" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar campeón…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
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
    </div>, document.body)}
  </div>;
}

function RoleSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelStyle = useFloatingPanel(open, buttonRef, 300);

  useCloseOnOutside(open, [buttonRef, panelRef], () => setOpen(false));

  const choose = next => {
    onChange(next);
    setOpen(false);
  };

  return <div className={INLINE_FIELD}>
    <span className="rd-label">Rol</span>
    <button ref={buttonRef} type="button" aria-label="Rol" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-[10px] font-bold uppercase text-primary">{value ? LABELS[value].slice(0, 2) : '?'}</span>
      <span className={value ? 'min-w-0 flex-1 truncate font-medium' : 'min-w-0 flex-1 truncate text-muted-foreground'}>{value ? LABELS[value] : 'Seleccionar rol…'}</span>
      <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && panelStyle && createPortal(<div ref={panelRef} role="listbox" style={panelStyle} className="overflow-y-auto overscroll-contain rounded-xl border border-primary/20 bg-[#0f1420] p-1.5 shadow-2xl shadow-black/60">
      {LANES.map(lane => {
        const active = lane === value;
        return <button key={lane} type="button" role="option" aria-selected={active} onClick={() => choose(lane)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary ${active ? 'bg-primary/8' : ''}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-secondary text-[11px] font-bold uppercase text-primary">{LABELS[lane].slice(0, 2)}</span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{LABELS[lane]}</span>
          {active && <Check size={15} className="shrink-0 text-primary" />}
        </button>;
      })}
    </div>, document.body)}
  </div>;
}

function DraftCard({ title, icon: Icon, team, setter, champions, onMemberChange, hiddenLane }) {
  return <section className="rd-card rd-card-overflow-visible rd-v2-step-card flex flex-col p-4"><div className="mb-3 flex items-center gap-2"><Icon size={15} className="text-primary" /><h2 className="rd-card-title">{title}</h2></div><div className="flex flex-1 flex-col justify-evenly gap-2">{LANES.filter(lane => lane !== hiddenLane).map(lane => <ChampionSelect key={lane} inline label={LABELS[lane]} value={team[lane]} champions={champions} onChange={value => onMemberChange(setter, lane, value)} />)}</div></section>;
}

const STEPS = ['Campeón', 'Aliados', 'Enemigos'];

export default function V2BuildTab({ tabSelector }) {
  const { data: snapshot, isLoading, error: loadError } = useQuery({ queryKey: ['build-v2-snapshot'], queryFn: loadV2Snapshot, staleTime: 300000 });
  const [championId, setChampionId] = useState('');
  const [role, setRole] = useState('');
  const [allies, setAllies] = useState(emptyTeam);
  const [enemies, setEnemies] = useState(emptyTeam);
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [buildPreference, setBuildPreference] = useState('');
  const [step, setStep] = useState(0);
  const champions =useMemo(() => [...(snapshot?.champions || [])].sort((a, b) => a.name.localeCompare(b.name)), [snapshot]);
  const pickReady = Boolean(championId && role);
  const stepCompleted = [
    pickReady,
    LANES.some(lane => lane !== role && allies[lane]),
    LANES.some(lane => enemies[lane]),
  ];
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
      // Build del primer intento ya reparada por el estabilizador. Se usa si la corrección falla.
      let fallbackData = null;
      const showResult = data => {
        setResult({ ...resolveV2Result(data, generationSnapshot), champion: snapshot.champions.find(c => String(c.id) === championId), role });
        setState('success');
      };

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (import.meta.env.DEV) console.debug('[Build IA V2] request', { attempt, counts: { champions: generationSnapshot.champions.length, coreItems: generationSnapshot.coreItems.length, movementItems: generationSnapshot.movementItems.length, runes: generationSnapshot.runes.length, spells: generationSnapshot.spells.length }, promptLength: prompt.length, estimatedTokens: estimatePromptTokens(prompt) });
        let response;
        try {
          response = await requestV2Build(prompt, generationSnapshot, { role, attempt });
        } catch (cause) {
          if (fallbackData) { showResult(fallbackData); return; }
          if (attempt === 1 && cause.retryable) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            continue;
          }
          throw cause;
        }

        if (import.meta.env.DEV) console.debug('[Build IA V2] response', { attempt, raw: response.raw, parsed: response.parsed });
        // Se valida la respuesta cruda: si la IA eligió piezas inválidas, el estabilizador las
        // reemplazaría con razones genéricas. Primero se le pide a la IA que las corrija.
        const rawValidation = validateV2Result(response.parsed, generationSnapshot, { role });
        const stabilized = stabilizeV2Result(response.parsed, generationSnapshot, { role });
        const validation = validateV2Result(stabilized, generationSnapshot, { role });
        const isLastAttempt = attempt === 2;
        if (validation.ok && (rawValidation.ok || isLastAttempt)) {
          showResult(validation.data);
          return;
        }
        if (validation.ok) fallbackData = validation.data;

        lastValidation = validation.ok ? rawValidation : validation;
        if (import.meta.env.DEV) console.debug('[Build IA V2] validation', { attempt, rawValidation, validation });
        if (!isLastAttempt) {
          prompt = buildV2Prompt({
            ...requestContext,
            correction: {
              errors: [...lastValidation.schemaErrors, ...lastValidation.validationErrors],
              previousResult: response.parsed,
            },
          });
        }
      }

      if (fallbackData) { showResult(fallbackData); return; }
      setState('validation_error');
      setError([...lastValidation.schemaErrors, ...lastValidation.validationErrors].join(' '));
    } catch (cause) { setState(cause.kind === 'malformed_response' ? 'malformed_response' : 'provider_error'); setError(cause.message); if (import.meta.env.DEV) console.debug('[Build IA V2] error', { kind: cause.kind, raw: cause.raw, message: cause.message, details: cause.details }); }
  }

  if (isLoading) return <div className="rd-card p-8 text-center text-muted-foreground">Cargando snapshot del parche activo…</div>;
  if (loadError) return <V2BuildResult state="provider_error" error={`No se pudo cargar Supabase: ${loadError.message}`} />;
  return <div className="rd-v2-build">
    <header className="rd-v2-build-header flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Rift Deck consigliere</span>
          </div>
          <h1 className="font-rajdhani text-4xl font-bold uppercase tracking-[-0.08em] text-foreground md:text-5xl">Sugeridor de builds</h1>
          <p className="mt-1 text-sm text-muted-foreground">Objetos, runas y hechizos adaptados al campeón, rol y draft disponible.</p>
          {tabSelector}
        </div>
        <div className="rd-status-pill hidden items-center gap-3 sm:flex">
          <BrainCircuit size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">Build Intelligence</span>
        </div>
    </header>
    <div className="rd-v2-build-body grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="rd-v2-build-aside xl:sticky xl:top-6">
        <StepNav steps={STEPS} label="Pasos del draft" step={step} completed={stepCompleted} locked={!pickReady} onStep={setStep} />
        <div className="rd-v2-build-aside-scroll">
        {step === 0 && <section className="rd-card rd-card-overflow-visible rd-v2-step-card flex flex-col p-4 focus-within:z-30">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles size={15} className="text-primary" /><h2 className="rd-card-title">Tu selección</h2></div><span className="rd-status-pill">Parche {snapshot.patchVersion}</span></div>
          <div className="space-y-2.5"><ChampionSelect inline label="Campeón" value={championId} champions={champions} onChange={selectMain} /><RoleSelect value={role} onChange={changeRole} /></div>
          <div className="mt-3 flex flex-1 flex-col border-t border-border/50 pt-3">
            <div className="mb-2 flex items-center gap-2"><BrainCircuit size={15} className="text-primary" /><h2 className="rd-card-title">Temática opcional</h2></div>
            <textarea value={buildPreference} onChange={event => setBuildPreference(event.target.value)} maxLength={240} rows={3} placeholder="Ej: velocidad de ataque y poder de habilidad" className="min-h-[4.5rem] w-full flex-1 resize-none rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50" />
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span title="La IA la priorizará si es viable para el campeón y el draft.">Se prioriza si es viable.</span><span className="shrink-0 tabular-nums">{buildPreference.length}/240</span></div>
          </div>
        </section>}
        {step === 1 && <DraftCard title="Composición aliada" icon={Users} team={allies} setter={setAllies} champions={champions} onMemberChange={setMember} hiddenLane={role} />}
        {step === 2 && <DraftCard title="Composición enemiga" icon={Swords} team={enemies} setter={setEnemies} champions={champions} onMemberChange={setMember} />}
        </div>
        <div className="flex gap-2">
          {step > 0 && <button type="button" onClick={() => setStep(current => current - 1)} className="flex items-center justify-center gap-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft size={16} />Atrás</button>}
          {step < STEPS.length - 1
            ? <button type="button" onClick={() => setStep(current => current + 1)} disabled={!pickReady} title={pickReady ? undefined : 'Elegí campeón y rol para continuar'} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40">Siguiente<ChevronRight size={16} /></button>
            : <button type="button" onClick={generate} disabled={state === 'loading'} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">{state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{state === 'loading' ? 'Analizando draft…' : 'Generar build'}</button>}
        </div>
      </aside>
      <div className="rd-v2-build-result">
        <V2BuildResult state={state} result={result} error={error} />
      </div>
    </div>
  </div>;
}
