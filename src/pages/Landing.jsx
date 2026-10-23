import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import LegalInfoModal, { LEGAL_VERSION, MIN_AGE } from '@/components/LegalInfoModal';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Mail, Lock, Eye, EyeOff, ChevronLeft, ChevronRight, X, ArrowLeft, KeyRound } from 'lucide-react';
import logoUrl from '@/assets/riftdeck-logo.png';
import shotBiblioteca from '@/assets/landing/biblioteca.webp';
import shotBuilds from '@/assets/landing/builds.webp';
import shotDashboard from '@/assets/landing/dashboard.webp';
import shotStatsCoach from '@/assets/landing/estadisticas-coach.webp';
import shotStatsMatchups from '@/assets/landing/estadisticas-matchups.webp';
import shotStatsRendimiento from '@/assets/landing/estadisticas-rendimiento.webp';
import shotObjetivos from '@/assets/landing/objetivos.webp';
import shotSugeridorBuilds from '@/assets/landing/sugeridor-builds.webp';
import shotSugeridorCampeones from '@/assets/landing/sugeridor-campeones.webp';
import shotTierlist from '@/assets/landing/tierlist.webp';

// En el orden del menú lateral.
const SCREENSHOTS = [
  { url: shotDashboard, label: 'Dashboard' },
  { url: shotBiblioteca, label: 'Biblioteca' },
  { url: shotTierlist, label: 'Tierlist' },
  { url: shotBuilds, label: 'Builds' },
  { url: shotObjetivos, label: 'Objetivos' },
  { url: shotStatsRendimiento, label: 'Estadísticas · Rendimiento' },
  { url: shotStatsMatchups, label: 'Estadísticas · Matchups generales' },
  { url: shotStatsCoach, label: 'Estadísticas · Coach' },
  { url: shotSugeridorCampeones, label: 'Sugeridor de campeones' },
  { url: shotSugeridorBuilds, label: 'Sugeridor de builds' },
];

const BG_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/9309d557d_Targon.webp';
const AUTH_REDIRECT_PATH = '/';

// initialMode: 'login' (/login) o 'register' (/registro).
export default function Landing({ initialMode = 'login' }) {
  const { checkUserAuth, refreshUser } = useAuth();
  const [mode, setMode] = useState(initialMode);
  // Registro: aceptación expresa de términos y privacidad, y declaración de edad mínima.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(() => (
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('password_updated') === '1'
      ? 'Contraseña creada correctamente. Ya puedes ingresar con tu email y la nueva contraseña.'
      : ''
  ));
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [modalIdx, setModalIdx] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('password_updated') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const navigateCarousel = (dir) => {
    const newIdx = (carouselIdx + dir + SCREENSHOTS.length) % SCREENSHOTS.length;
    setCarouselIdx(newIdx);
    if (scrollRef.current) {
      const buttons = scrollRef.current.querySelectorAll('button');
      if (buttons[newIdx]) {
        buttons[newIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        await (refreshUser || checkUserAuth)?.();
        window.location.href = AUTH_REDIRECT_PATH;
      } else if (mode === 'register') {
        const fullName = name.trim();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + AUTH_REDIRECT_PATH,
            data: {
              full_name: fullName || '',
              visible_name: fullName || '',
              // Constancia de la aceptación (versión de los textos y fecha).
              terms_version: LEGAL_VERSION,
              terms_accepted_at: new Date().toISOString(),
              min_age_confirmed: MIN_AGE,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          await (refreshUser || checkUserAuth)?.();
          window.location.href = AUTH_REDIRECT_PATH;
          return;
        }
        setMode('check-email');
        setPassword('');
      }
    } catch (err) {
      setError(err?.message || (mode === 'login' ? 'Credenciales incorrectas.' : 'Error al registrarse.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + AUTH_REDIRECT_PATH,
      },
    });

    if (oauthError) {
      setError(oauthError.message || 'No se pudo iniciar sesión con Google.');
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message || 'No se pudo reenviar el correo de confirmación.');
      return;
    }

    setSuccess('Correo de confirmación reenviado.');
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message || 'No se pudo enviar el enlace de recuperación.');
      return;
    }

    setMode('reset-sent');
  };

  return (
    <main className="relative min-h-dvh flex items-center justify-center overflow-x-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/10 pointer-events-none" />

      {/* Decorative glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <Link
        to="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft size={15} />
        Volver al inicio
      </Link>

      {/* Card */}
      <div className="rd-landing-shell relative z-10 w-full max-w-md mx-4 py-10 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:content-center lg:items-center lg:gap-x-16">
        {/* Brand */}
        <div className="rd-landing-brand flex flex-col items-center mb-8 lg:col-start-1 lg:row-start-1 lg:mb-0">
          <img src={logoUrl} alt="Rift Deck" height="96" className="rd-landing-logo mb-4 h-24 object-contain" />
          <h1 className="rd-landing-title text-center font-rajdhani text-xl font-bold text-foreground">
            Builds, estadísticas y meta de Wild Rift
          </h1>
          <p className="rd-landing-desc mt-1 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            Registra tus partidas, analiza tu rendimiento, consulta campeones, tierlists, objetos y runas en un solo lugar.
          </p>
          <div className="flex items-center gap-2 opacity-60 mt-1">
            <span className="h-px w-6 bg-primary/50" />
            <span className="text-[9px] uppercase tracking-[0.32em] text-primary">Juega con Información</span>
            <span className="h-px w-6 bg-primary/50" />
          </div>
          <a
            href="/campeones"
            className="rd-landing-library mt-4 inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary/70 hover:bg-primary/20"
          >
            Biblioteca de Rift Deck
          </a>
        </div>

        <div className="rd-landing-card rd-card p-8 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          {mode === 'check-email' ? (
            /* Email confirmation step */
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                  <Mail size={22} className="text-primary" />
                </div>
                <h2 className="font-rajdhani font-bold text-xl text-foreground">Revisa tu correo</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Te enviamos un enlace de confirmación. Ábrelo desde tu email para activar tu cuenta y acceder a Rift Deck.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Si no lo encuentras, revisa la carpeta de spam o correo no deseado.
                </p>
              </div>

              <div className="space-y-4">
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">{success}</p>
                )}

                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); setPassword(''); }}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  Volver al inicio de sesión
                </button>

                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading || !email}
                  className="w-full text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Reenviar correo de confirmación
                </button>
              </div>
            </div>
          ) : mode === 'reset-sent' ? (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                  <Mail size={22} className="text-primary" />
                </div>
                <h2 className="font-rajdhani font-bold text-xl text-foreground">Revisa tu correo</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Si existe una cuenta para <span className="text-foreground">{email}</span>, vas a recibir un enlace para crear una contraseña.
                </p>
                <p className="text-xs text-muted-foreground mt-3">También revisa spam o correo no deseado.</p>
              </div>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : mode === 'forgot-password' ? (
            <div>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
              >
                <ArrowLeft size={14} /> Volver
              </button>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={22} className="text-primary" />
                </div>
                <h2 className="font-rajdhani font-bold text-xl text-foreground">Crear o recuperar contraseña</h2>
                <p className="text-sm text-muted-foreground mt-2">Funciona también si originalmente te registraste con Google.</p>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="rd-label mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      autoFocus
                      className="w-full bg-secondary/70 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Enviar enlace
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex rounded-xl overflow-hidden border border-border mb-6">
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'register' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Registrarse
                </button>
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-border bg-secondary/50 hover:bg-secondary hover:border-primary/30 text-sm font-medium text-foreground transition-all mb-5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>
              <p className="-mt-3 mb-5 text-center text-[11px] leading-relaxed text-muted-foreground">
                Al continuar con Google aceptas los{' '}
                <button type="button" onClick={() => setLegalModal('terms')} className="text-primary hover:underline">Términos</button>
                {' '}y la{' '}
                <button type="button" onClick={() => setLegalModal('privacy')} className="text-primary hover:underline">Política de privacidad</button>
                {' '}y declaras tener al menos {MIN_AGE} años.
              </p>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="rd-label mb-1.5 block">Nombre</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full bg-secondary/70 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                )}

                <div>
                  <label className="rd-label mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      className="w-full bg-secondary/70 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <label className="rd-label">Contraseña</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot-password'); setError(''); setSuccess(''); setPassword(''); }}
                        className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-secondary/70 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={e => setAcceptedTerms(e.target.checked)}
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      He leído y acepto los{' '}
                      <button type="button" onClick={() => setLegalModal('terms')} className="text-primary hover:underline">Términos y condiciones</button>
                      {' '}y la{' '}
                      <button type="button" onClick={() => setLegalModal('privacy')} className="text-primary hover:underline">Política de privacidad</button>
                      , y declaro tener al menos {MIN_AGE} años.
                    </span>
                  </label>
                )}

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">{success}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || (mode === 'register' && !acceptedTerms)}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_28px_rgba(212,175,55,.15)] flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Carousel */}
        <div className="rd-landing-showcase mt-6 mb-2 lg:col-start-1 lg:row-start-2 lg:mb-0 lg:mt-8">
          <p className="rd-landing-showcase-label text-center text-[10px] uppercase tracking-[0.26em] text-primary/70 font-semibold mb-3">Muestra</p>
          <div className="relative rounded-xl border border-border/40 bg-secondary/20 p-2">
            <div ref={scrollRef} className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {SCREENSHOTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setModalIdx(i)}
                  className={`shrink-0 rounded-lg p-1.5 border-2 transition-all ${i === carouselIdx ? 'border-primary bg-primary/10' : 'border-border/40 bg-secondary/40 hover:border-primary/50'}`}
                  onMouseEnter={() => setCarouselIdx(i)}
                >
                  <img src={s.url} alt={`Vista de ${s.label} en Rift Deck`} width="96" height="64" loading="lazy" className="rd-landing-thumb w-24 h-16 object-cover object-top rounded" />
                </button>
              ))}
            </div>
            <button
              onClick={() => navigateCarousel(-1)}
              aria-label="Ver captura anterior"
              className="rd-arrow absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 z-10"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => navigateCarousel(1)}
              aria-label="Ver captura siguiente"
              className="rd-arrow absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-7 h-7 z-10"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <p className="rd-landing-footer text-center text-xs text-muted-foreground mt-4 lg:col-start-1 lg:row-start-3">
          Rift Deck · Tu centro táctico de Wild Rift
        </p>
      </div>

      {/* Modal lightbox */}
      {modalIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-4"
          onClick={() => setModalIdx(null)}
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <img
              src={SCREENSHOTS[modalIdx].url}
              alt={`Vista ampliada de ${SCREENSHOTS[modalIdx].label} en Rift Deck`}
              loading="lazy"
              className="max-w-[96vw] max-h-[92vh] rounded-xl border border-border shadow-2xl object-contain"
              style={{ imageRendering: 'auto' }}
            />
            <p className="text-center text-xs text-muted-foreground mt-2">{SCREENSHOTS[modalIdx].label} · {modalIdx + 1} / {SCREENSHOTS.length}</p>
            {/* Close */}
            <button
              onClick={() => setModalIdx(null)}
              aria-label="Cerrar vista ampliada"
              className="fixed top-4 right-4 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center hover:bg-secondary transition-all z-10"
            >
              <X size={15} className="text-foreground" />
            </button>
            {/* Prev */}
            <button
              onClick={() => setModalIdx(i => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)}
              aria-label="Ver captura anterior"
              className="rd-arrow fixed left-4 top-1/2 -translate-y-1/2 w-10 h-10 z-10"
            >
              <ChevronLeft size={20} />
            </button>
            {/* Next */}
            <button
              onClick={() => setModalIdx(i => (i + 1) % SCREENSHOTS.length)}
              aria-label="Ver captura siguiente"
              className="rd-arrow fixed right-4 top-1/2 -translate-y-1/2 w-10 h-10 z-10"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
      {legalModal && <LegalInfoModal type={legalModal} onClose={() => setLegalModal(null)} />}
    </main>
  );
}
