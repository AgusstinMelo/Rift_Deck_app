import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import wordmarkUrl from '@/assets/riftdeck-final.png';

const LOGO_URL = 'https://media.base44.com/images/public/69f960ee6e584cfa5a577a24/aedbcc40d_FullColor.png';
const BG_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/9309d557d_Targon.webp';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'No se pudo guardar la contraseña. Solicitá un enlace nuevo.');
      return;
    }

    // The recovery link creates a temporary authenticated session. Close it so
    // the user can verify the new email/password credential from the login.
    await supabase.auth.signOut({ scope: 'local' });
    window.location.replace('/login?password_updated=1');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BG_URL})` }} />
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/10" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-7">
          <img src={LOGO_URL} alt="Rift Deck" className="w-14 h-14 object-contain" />
          <img src={wordmarkUrl} alt="Rift Deck" className="h-16 object-contain" />
        </div>

        <div className="rd-card p-8">
          {checkingSession ? (
            <Status icon={<Loader2 size={26} className="animate-spin text-primary" />} title="Validando el enlace…" />
          ) : !hasSession ? (
            <Status
              icon={<Lock size={22} className="text-red-400" />}
              title="El enlace no es válido"
              text="Puede haber vencido o ya haber sido utilizado."
              action="Solicitar otro enlace"
              onAction={() => { window.location.href = '/login'; }}
              negative
            />
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={22} className="text-primary" />
                </div>
                <h1 className="font-rajdhani text-2xl font-bold text-foreground">Nueva contraseña</h1>
                <p className="text-sm text-muted-foreground mt-2">Elegí una contraseña de al menos 8 caracteres.</p>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <PasswordField label="Contraseña" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(value => !value)} autoFocus />
                <PasswordField label="Repetir contraseña" value={confirmation} onChange={setConfirmation} visible={showPassword} />

                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Guardar contraseña
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, autoFocus = false }) {
  return (
    <div>
      <label className="rd-label mb-1.5 block">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={event => onChange(event.target.value)}
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="w-full bg-secondary/70 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
        />
        {onToggle && (
          <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Status({ icon, title, text, action, onAction, negative = false }) {
  const tone = negative ? 'bg-red-500/10 border-red-500/25' : 'bg-primary/10 border-primary/25';
  return (
    <div className="text-center py-2">
      <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto mb-4 ${tone}`}>{icon}</div>
      <h1 className="font-rajdhani text-2xl font-bold text-foreground">{title}</h1>
      {text && <p className="text-sm text-muted-foreground mt-2">{text}</p>}
      {action && (
        <button type="button" onClick={onAction} className="w-full mt-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all">
          {action}
        </button>
      )}
    </div>
  );
}
