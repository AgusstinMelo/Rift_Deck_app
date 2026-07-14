import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Mail, Lock, Eye, EyeOff, ChevronLeft, ChevronRight, X, ArrowLeft, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import wordmarkUrl from '@/assets/riftdeck-final.png';

const SCREENSHOTS = [
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/16a92a6fb_1_RiftDeck_Dashboard.jpg', label: 'Dashboard' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/e5ad7acc2_2_RiftDeck_ChampDashboard.jpg', label: 'Biblioteca' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/81c02ebae_3_RiftDeck_Build.jpg', label: 'Builds' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/1f65b3a47_4_RiftDeck_Tierlist.jpg', label: 'Tierlist' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/ffa13a6b0_5_RiftDeck_Partidas.jpg', label: 'Partidas' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/834f7ae1f_6_RiftDeck_Stats.jpg', label: 'Estadísticas' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/07aaef9cf_7_RiftDeck_Stats2.jpg', label: 'Estadísticas' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/059cf5ce0_8_RiftDeck_Stats3.jpg', label: 'Estadísticas' },
  { url: 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/b8a4c5f58_9_RiftDeck_Sugeridor.jpg', label: 'Sugeridor' },
];

const LOGO_URL = 'https://media.base44.com/images/public/69f960ee6e584cfa5a577a24/aedbcc40d_FullColor.png';
const WORDMARK_URL = wordmarkUrl;
const BG_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/9309d557d_Targon.webp';
const AUTH_REDIRECT_PATH = '/';

export default function Landing() {
  const { checkUserAuth, refreshUser } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(() => (
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('password_updated') === '1'
      ? 'Contraseña creada correctamente. Ya podés ingresar con tu email y la nueva contraseña.'
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
      setError(oauthError.message || 'No se pudo iniciar sesiÃ³n con Google.');
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
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
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

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <img src={LOGO_URL} alt="" width="56" height="56" className="w-14 h-14 object-contain drop-shadow-[0_0_24px_rgba(77,166,255,.35)]" />
            <img src={WORDMARK_URL} alt="Rift Deck" height="64" className="h-16 object-contain drop-shadow-[0_0_14px_rgba(212,175,55,.40)]" />
          </div>
          <h1 className="text-center font-rajdhani text-xl font-bold text-foreground">
            Builds, estadísticas y meta de Wild Rift
          </h1>
          <p className="mt-1 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            Registra tus partidas, analiza tu rendimiento, consulta campeones, tierlists, objetos y runas en un solo lugar.
          </p>
          <div className="flex items-center gap-2 opacity-60 mt-1">
            <span className="h-px w-6 bg-primary/50" />
            <span className="text-[9px] uppercase tracking-[0.32em] text-primary">Juega con Información</span>
            <span className="h-px w-6 bg-primary/50" />
          </div>
          <Link
            to="/campeones"
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary/70 hover:bg-primary/20"
          >
            Biblioteca de Rift Deck
          </Link>
        </div>

        <div className="rd-card p-8">
          {mode === 'check-email' ? (
            /* Email confirmation step */
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                  <Mail size={22} className="text-primary" />
                </div>
                <h2 className="font-rajdhani font-bold text-xl text-foreground">Revisá tu correo</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Te enviamos un enlace de confirmación. Abrilo desde tu email para activar tu cuenta y acceder a Rift Deck.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Si no lo encontrás, revisá la carpeta de spam o correo no deseado.
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
                <h2 className="font-rajdhani font-bold text-xl text-foreground">Revisá tu correo</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Si existe una cuenta para <span className="text-foreground">{email}</span>, vas a recibir un enlace para crear una contraseña.
                </p>
                <p className="text-xs text-muted-foreground mt-3">También revisá spam o correo no deseado.</p>
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

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">{success}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
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
        <div className="mt-6 mb-2">
          <p className="text-center text-[10px] uppercase tracking-[0.26em] text-primary/70 font-semibold mb-3">Muestra</p>
          <div className="relative rounded-xl border border-border/40 bg-secondary/20 p-2">
            <div ref={scrollRef} className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {SCREENSHOTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setModalIdx(i)}
                  className={`shrink-0 rounded-lg p-1.5 border-2 transition-all ${i === carouselIdx ? 'border-primary bg-primary/10' : 'border-border/40 bg-secondary/40 hover:border-primary/50'}`}
                  onMouseEnter={() => setCarouselIdx(i)}
                >
                  <img src={s.url} alt={`Vista de ${s.label} en Rift Deck`} width="96" height="64" loading="lazy" className="w-24 h-16 object-cover object-top rounded" />
                </button>
              ))}
            </div>
            <button
              onClick={() => navigateCarousel(-1)}
              aria-label="Ver captura anterior"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-secondary transition-all z-10 shadow"
            >
              <ChevronLeft size={13} className="text-foreground" />
            </button>
            <button
              onClick={() => navigateCarousel(1)}
              aria-label="Ver captura siguiente"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-secondary transition-all z-10 shadow"
            >
              <ChevronRight size={13} className="text-foreground" />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
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
              className="fixed left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-all z-10"
            >
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            {/* Next */}
            <button
              onClick={() => setModalIdx(i => (i + 1) % SCREENSHOTS.length)}
              aria-label="Ver captura siguiente"
              className="fixed right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-all z-10"
            >
              <ChevronRight size={20} className="text-foreground" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
