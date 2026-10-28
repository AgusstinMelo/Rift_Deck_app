import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, BookOpen, ClipboardList, Cpu, Globe2, LayoutDashboard, Layers, Lock, ShieldCheck,
  Sparkles, Swords, Target, TrendingUp, UserRound,
} from 'lucide-react';
import HomeNav from '@/components/home/HomeNav';
import HomeFooter from '@/components/home/HomeFooter';
import CoachInsightCard from '@/components/home/CoachInsightCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import shotDashboard from '@/assets/landing/dashboard.webp';
import { useT } from '@/lib/LocaleContext';
import { tr } from '@/i18n/uiI18n';

// Todas las capturas de src/assets/landing miden 1910×915.
const SHOT_WIDTH = 1910;
const SHOT_HEIGHT = 915;

// Cada pantalla de la home ocupa el alto visible debajo de la nav (ver .rd-home-section en index.css).
const SECTION = 'rd-home-section';
const CONTAINER = 'mx-auto w-full max-w-6xl px-4 md:px-6';

const PRIMARY_BUTTON = 'inline-flex w-full max-w-xs items-center whitespace-nowrap justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto land:w-auto land:px-4 land:py-2.5';
const SECONDARY_BUTTON = 'inline-flex w-full max-w-xs items-center whitespace-nowrap justify-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:w-auto land:w-auto land:px-4 land:py-2.5';

const HIGHLIGHTS = [
  { get value() { return tr('home.highlights.modules'); }, get label() { return tr('home.dashboardTierlistBuildsEstadisticas'); }, icon: Layers },
  { get value() { return tr('home.highlights.patches'); }, get label() { return tr('home.tierlistAlDiaY'); }, icon: TrendingUp },
  { get value() { return tr('home.highlights.data'); }, get label() { return tr('home.analisisSobreTusPropias'); }, icon: UserRound },
  { get value() { return tr('home.highlights.spanish'); }, get label() { return tr('home.pensadoParaLaComunidad'); }, icon: Globe2 },
];

const STEPS = [
  {
    number: '01',
    get title() { return tr('home.registraTusPartidas'); },
    get text() { return tr('home.cargaCadaPartidaEn'); },
    icon: ClipboardList,
  },
  {
    number: '02',
    get title() { return tr('home.riftDeckLasLee'); },
    get text() { return tr('home.cruzamosTuHistorialCon'); },
    icon: Cpu,
  },
  {
    number: '03',
    get title() { return tr('home.decidesMejor'); },
    get text() { return tr('home.picksBuildsYObjetivos'); },
    icon: Target,
    highlighted: true,
  },
];

const COACH_INSIGHTS = [
  {
    get domain() { return tr('common.champions'); },
    get confidenceLabel() { return tr('home.confianzaAlta'); },
    tone: 'positive',
    get title() { return tr('home.xayahEsTuMejor'); },
    get thesis() { return tr('home.xayahSubioATier'); },
    get evidence() { return [tr('home.personal67'), tr('home.tierA'), tr('home.12Partidas')]; },
    get action() { return tr('home.priorizalaEnTusProximas'); },
  },
  {
    get domain() { return tr('dashboard.slides.matchups'); },
    get confidenceLabel() { return tr('home.confianzaMedia'); },
    tone: 'warning',
    get title() { return tr('home.sufresContraMagosDe'); },
    get thesis() { return tr('home.contraZiggsXerathY'); },
    get evidence() { return [tr('home.3De10Victorias'), tr('home.68Muertes'), tr('lanes.mid')]; },
    get action() { return tr('home.cuandoAparezcanEnEl'); },
  },
];

const FAQS = [
  {
    get question() { return tr('home.esGratis'); },
    // TODO: precio o plan. Confirmar qué incluye la cuenta gratuita y qué agrega la membresía.
    get answer() { return tr('home.siCrearTuCuenta'); },
  },
  {
    get question() { return tr('home.comoSeCarganMis'); },
    get answer() { return tr('home.lasRegistrasManualmenteDesde'); },
  },
  {
    get question() { return tr('home.cuantasPartidasNecesito'); },
    get answer() { return tr('home.desdeLaPrimeraPartida'); },
  },
  {
    get question() { return tr('home.cadaCuantoSeActualiza'); },
    get answer() { return tr('home.todosLosDiasCon'); },
  },
];

function Eyebrow({ children, centered = false }) {
  return (
    <p className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/85 ${centered ? 'justify-center' : ''}`}>
      <span className="h-px w-6 bg-primary/50" aria-hidden="true" />
      {children}
      {centered && <span className="h-px w-6 bg-primary/50" aria-hidden="true" />}
    </p>
  );
}

function SectionHeading({ id, eyebrow, title, lead, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <Eyebrow centered={centered}>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-rajdhani text-[clamp(1.5rem,min(7vw,5.5svh),2.5rem)] font-bold uppercase leading-[1.05] tracking-[-0.04em] text-foreground land:mt-2">
        {title}
      </h2>
      {lead && <p className="mt-4 hidden text-base leading-relaxed text-muted-foreground md:block land:hidden">{lead}</p>}
    </div>
  );
}

// Captura dentro de un marco tipo ventana.
function ScreenshotFrame({ src, alt, eager = false, className = '' }) {
  return (
    <figure className={`overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-border/60 bg-secondary/40 px-4" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </div>
      <img
        src={src}
        alt={alt}
        width={SHOT_WIDTH}
        height={SHOT_HEIGHT}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full"
      />
    </figure>
  );
}

// Lo que el análisis va sumando a medida que se registran partidas. Los umbrales siguen a
// la app: la ficha de campeón deja de ser "muestra pequeña" con 5 partidas y el Coach
// empieza a comparar tendencias desde 12 (hooks/useInsights.js).
const MILESTONES = [
  { games: 1, get title() { return tr('home.tuDashboard'); }, get text() { return tr('home.winrateKdaRachaY'); }, icon: LayoutDashboard },
  { games: 1, get title() { return tr('home.estadisticasPorCampeon'); }, get text() { return tr('home.dondeRindesMejorPor'); }, icon: BarChart3 },
  { games: 5, get title() { return tr('home.fichasConTuRendimiento'); }, get text() { return tr('home.tuWinrateYKda'); }, icon: UserRound },
  { games: 10, get title() { return tr('home.matchupsYSinergias'); }, get text() { return tr('home.losRivalesQueTe'); }, icon: Swords },
  { games: 12, get title() { return tr('home.elCoachDetectaTendencias'); }, get text() { return tr('home.comparaTusPartidasRecientes'); }, icon: Sparkles },
  { games: 30, get title() { return tr('home.consejosConMasConfianza'); }, get text() { return tr('home.conMasPartidasCada'); }, icon: ShieldCheck },
];
const MAX_GAMES = 30;

function ProgressSection() {
  const t = useT();
  const [games, setGames] = useState(5);
  const next = MILESTONES.find(milestone => games < milestone.games);
  const missing = next ? next.games - games : 0;

  const cta = (className) => (
    <Link to="/registro" className={`${PRIMARY_BUTTON} ${className}`}>
     {t('home.empezarARegistrarPartidas')}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );

  return (
    <section id="progreso" aria-labelledby="progreso-title" className={`${SECTION} border-t border-primary/10`}>
      <div className={CONTAINER}>
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 land:grid-cols-2 land:gap-6">
          <div>
            <SectionHeading
              id="progreso-title"
              eyebrow={t('home.tuProgreso')}
              title={t('home.cadaPartidaQueRegistras')}
              lead={t('home.riftDeckSeVuelve')}
            />

            <div className="mt-4 rounded-2xl border border-primary/20 bg-card/70 p-4 shadow-[0_0_60px_-30px_hsl(var(--primary)/0.5)] md:mt-7 md:p-5 land:mt-2 land:p-2.5 short:p-3">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor="home-progress-games" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                 {t('goals.metric.partidas_registradas')}
                </label>
                <output htmlFor="home-progress-games" className="font-rajdhani text-4xl font-bold leading-none text-primary md:text-5xl land:text-3xl">
                  {games >= MAX_GAMES ? `${MAX_GAMES}+` : games}
                </output>
              </div>
              <input
                id="home-progress-games"
                type="range"
                min="0"
                max={MAX_GAMES}
                step="1"
                value={games}
                onChange={event => setGames(Number(event.target.value))}
                aria-valuetext={t('home.partidas', { games })}
                className="mt-3 w-full cursor-pointer accent-primary md:mt-4 land:mt-2"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground land:hidden short:hidden" aria-hidden="true">
                <span>0</span><span>10</span><span>20</span><span>30+</span>
              </div>
              <p className="mt-2 text-sm text-foreground/85 md:mt-3 land:mt-2 land:text-xs" aria-live="polite">
                {next
                  ? <>{t('home.con')} <span className="font-semibold text-primary">{missing} {missing === 1 ? 'partida' : 'partidas'} {t('home.mas')}</span>: {next.title.toLowerCase()}.</>
                  : t('home.todoTuAnalisisEsta')}
              </p>
            </div>

            {cta('mt-6 hidden lg:inline-flex land:mt-2 land:inline-flex')}
          </div>

          <div>
            <ol className="space-y-1.5 md:space-y-2 land:space-y-1 short:space-y-1" aria-label={t('home.loQueDesbloqueasAl')}>
              {MILESTONES.map(({ games: needed, title, text, icon: Icon }) => {
                const unlocked = games >= needed;
                return (
                  <li
                    key={title}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 transition-all duration-300 md:px-4 md:py-3 land:px-3 land:py-1 short:py-1 ${
                      unlocked
                        ? 'border-primary/35 bg-primary/[0.07]'
                        : 'border-border/60 bg-card/40 opacity-60'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors md:h-9 md:w-9 land:h-6 land:w-6 short:h-7 short:w-7 ${
                        unlocked ? 'border-primary/30 bg-primary/15 text-primary' : 'border-border bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      {unlocked ? <Icon size={17} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground land:text-xs">
                        {title}
                        <span className="sr-only">{unlocked ? t('home.desbloqueado') : t('home.bloqueado')}</span>
                      </p>
                      <p className="mt-0.5 hidden text-xs text-muted-foreground md:block land:hidden">{text}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {needed >= MAX_GAMES ? `${MAX_GAMES}+` : needed} {needed === 1 ? 'partida' : 'partidas'}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex justify-center lg:hidden land:hidden">{cta('')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const t = useT();
  return (
    <div className="rd-home relative z-10 text-foreground">
      <HomeNav />

      <main>
        {/* Hero: solo el mensaje y las llamadas a la acción */}
        <section id="inicio" aria-labelledby="home-title" className={`${SECTION} relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.16),transparent_65%)]" aria-hidden="true" />

          <div className={`${CONTAINER} relative text-center`}>
            <Eyebrow centered>{t('home.juegaConInformacion')}</Eyebrow>
            <h1 id="home-title" className="mx-auto mt-5 max-w-6xl font-rajdhani text-[clamp(2.25rem,min(10vw,11svh),5.5rem)] font-bold uppercase leading-[0.95] tracking-[-0.06em] text-foreground md:mt-7 land:mt-3">
             {t('home.empiezaAJugarCon')} <span className="text-primary">{t('home.criterio')}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:mt-7 md:text-xl land:mt-3 land:text-sm">
             {t('home.riftDeckConvierteTus')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row md:mt-10 land:mt-5 land:flex-row">
              <Link to="/registro" className={PRIMARY_BUTTON}>
               {t('home.crearMiCuentaGratis')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="/campeones" className={SECONDARY_BUTTON}>
                <BookOpen size={16} className="text-primary" aria-hidden="true" />
               {t('home.bibliotecaPublica')}
              </a>
            </div>
          </div>
        </section>

        {/* Captura del Dashboard: tan grande como permita la pantalla */}
        <section id="asi-se-ve" aria-label={t('home.asiSeVeRift')} className={`${SECTION} border-t border-primary/10`}>
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 md:px-6">
            <Eyebrow centered>{t('home.asiSeVeRift')}</Eyebrow>
            <div className="rd-home-hero-shot mt-4 md:mt-6 land:mt-2">
              <div className="rd-home-hero-frame">
                <ScreenshotFrame src={shotDashboard} alt={t('home.dashboardDeRiftDeck')} eager />

                {/* Tarjetas flotantes: solo en pantallas grandes */}
                <div className="absolute -left-8 top-[30%] hidden w-56 rounded-2xl border border-green-500/25 bg-card/95 p-4 text-left shadow-2xl backdrop-blur lg:block">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{t('dashboard.formaReciente')}</p>
                  <p className="mt-1 font-rajdhani text-4xl font-bold text-green-400">90%</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                    <div className="h-full w-[90%] rounded-full bg-green-400" />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{t('home.9DeTusUltimas')}</p>
                </div>

                <div className="absolute -right-8 bottom-[10%] hidden w-72 rounded-2xl border border-primary/25 bg-card/95 p-4 text-left shadow-2xl backdrop-blur lg:block">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                    <Sparkles size={13} aria-hidden="true" />
                   {t('dashboard.riftDeckCoach')}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                   {t('home.xayahSubioATier2')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Datos + Cómo funciona */}
        <section id="como-funciona" aria-labelledby="como-funciona-title" className={`${SECTION} border-t border-primary/10`}>
          <div className={CONTAINER}>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl border border-primary/10 bg-card/40 px-5 py-3.5 md:grid-cols-4 md:gap-y-4 md:py-5 land:grid-cols-4 land:py-2" aria-label={t('home.riftDeckEnNumeros')}>
              {HIGHLIGHTS.map(({ value, label, icon: Icon }) => (
                <li key={value} className="flex items-start gap-2.5">
                  <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-rajdhani text-sm font-bold uppercase tracking-[-0.03em] text-foreground md:text-lg">{value}</p>
                    <p className="mt-0.5 hidden text-xs leading-snug text-muted-foreground md:block land:hidden">{label}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 md:mt-14 land:mt-4 short:mt-4">
              <SectionHeading
                id="como-funciona-title"
                eyebrow={t('home.anchors.comoFunciona')}
                title={t('home.pasosSimplesCargaRapida')}
                lead={t('home.registrasLoQueJugaste')}
                centered
              />
            </div>

            <ol className="mt-5 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4 land:mt-4 land:grid-cols-3 land:gap-3">
              {STEPS.map(({ number, title, text, icon: Icon, highlighted }) => (
                <li
                  key={number}
                  className={`flex gap-4 rounded-2xl border p-4 md:block md:p-6 land:block land:p-3 short:p-3 ${
                    highlighted
                      ? 'border-primary/40 bg-primary/[0.07] shadow-[0_0_60px_-20px_hsl(var(--primary)/0.45)]'
                      : 'border-border/70 bg-card/60'
                  }`}
                >
                  <div className="flex shrink-0 items-center justify-between">
                    <span className={`font-rajdhani text-3xl font-bold md:text-4xl land:text-2xl ${highlighted ? 'text-primary' : 'text-foreground/25'}`}>{number}</span>
                    <Icon size={22} className={`hidden md:block land:block ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-rajdhani text-base font-bold uppercase tracking-[-0.03em] text-foreground md:mt-5 md:text-lg land:mt-2 land:text-sm">{title}</h3>
                    <p className="mt-1 text-[13px] leading-snug text-muted-foreground md:mt-1.5 md:text-sm md:leading-relaxed land:mt-1 land:text-xs short:text-xs">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tu progreso: qué se desbloquea a medida que se registran partidas */}
        <ProgressSection />

        {/* Coach */}
        <section id="coach" aria-labelledby="coach-title" className={`${SECTION} border-t border-primary/10`}>
          <div className={CONTAINER}>
            <SectionHeading
              id="coach-title"
              eyebrow={t('dashboard.riftDeckCoach')}
              title={t('home.unCoachPersonalQue')}
              lead={t('home.hipotesisPriorizadasParaTu')}
            />
            {/* En smartphone vertical las cartas se deslizan de a una; en el resto, dos columnas. */}
            <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:mt-10 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 land:mx-0 land:mt-4 land:grid land:grid-cols-2 land:overflow-visible land:px-0 land:pb-0">
              {COACH_INSIGHTS.map((insight, index) => (
                <CoachInsightCard
                  key={insight.title}
                  index={index + 1}
                  className="w-[86%] shrink-0 snap-center md:w-auto land:w-auto"
                  {...insight}
                />
              ))}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground md:mt-4 land:hidden">
              <BarChart3 size={14} className="shrink-0 text-primary" aria-hidden="true" />
              <span>
               {t('home.ejemplosIlustrativosElCoach')}
                <span className="md:hidden land:hidden"> {t('home.deslizaParaVerEl')}</span>
              </span>
            </p>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" aria-labelledby="preguntas-title" className={`${SECTION} border-t border-primary/10`}>
          <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
            <SectionHeading id="preguntas-title" eyebrow={t('home.anchors.preguntas')} title={t('home.preguntasFrecuentes')} centered />
            <Accordion type="single" collapsible className="mt-6 rounded-2xl border border-border/70 bg-card/60 px-5 md:mt-10 land:mt-3">
              {FAQS.map(({ question, answer }) => (
                <AccordionItem key={question} value={question} className="border-border/60 last:border-b-0">
                  <AccordionTrigger className="py-4 text-base font-semibold text-foreground hover:text-primary hover:no-underline md:py-5 land:py-2.5 land:text-sm">
                    {question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground land:pb-2.5 land:text-xs">{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      {/* Cierre: CTA final y footer comparten la última pantalla */}
      <div id="empieza" className={`${SECTION} rd-home-closing border-t border-primary/10`}>
        <section aria-labelledby="cta-title" className="flex flex-1 items-center pb-6 md:pb-8 land:pb-3">
          <div className={CONTAINER}>
            <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card px-6 py-10 text-center md:px-12 md:py-20 land:py-4 short:py-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" aria-hidden="true" />
              <div className="relative">
                <Eyebrow centered>Rift Deck</Eyebrow>
                <h2 id="cta-title" className="mx-auto mt-4 max-w-3xl font-rajdhani text-[clamp(1.6rem,min(7.5vw,6svh),3rem)] font-bold uppercase leading-[1.02] tracking-[-0.05em] text-foreground land:mt-2">
                 {t('home.tuProximaPartidaEmpieza')} <span className="text-primary">{t('home.informacion')}</span>
                </h2>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row md:mt-8 land:mt-4 land:flex-row">
                  <Link to="/registro" className={PRIMARY_BUTTON}>
                   {t('home.crearMiCuentaGratis')}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link to="/login" className={SECONDARY_BUTTON}>{t('home.yaTengoCuenta')}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomeFooter />
      </div>
    </div>
  );
}
