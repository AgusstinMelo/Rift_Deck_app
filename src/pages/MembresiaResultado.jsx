import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getMyMembership } from '@/api/membershipSupabase';
import { CheckCircle2, Clock, XCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MembresiaResultado() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(null);

  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 8;
    const INTERVAL_MS = 3000;

    const check = async () => {
      try {
        const data = await getMyMembership(user?.id);
        setMembership(data);

        // Si ya tiene acceso o superamos los intentos, paramos el polling
        if (data.hasAccess || attempts >= MAX_ATTEMPTS) {
          setLoading(false);
          return;
        }

        // Si está pending, seguir esperando
        if (data.status === 'pending' && attempts < MAX_ATTEMPTS) {
          attempts++;
          setTimeout(check, INTERVAL_MS);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };

    check();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rd-card p-10 max-w-md w-full mx-4 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto">
            <Clock size={32} className="text-yellow-400 animate-pulse" />
          </div>
          <h1 className="font-rajdhani font-bold text-2xl text-foreground">
            Confirmando tu pago
          </h1>
          <p className="text-muted-foreground text-sm">
            Estamos confirmando tu pago. Esto puede tardar unos segundos.
          </p>
          <div className="flex justify-center gap-1 pt-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (membership?.hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rd-card p-10 max-w-md w-full mx-4 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h1 className="font-rajdhani font-bold text-2xl text-foreground">
            ¡Membresía activada!
          </h1>
          <p className="text-muted-foreground text-sm">
            Tu acceso Premium está activo. Ya podés ver tus estadísticas avanzadas.
          </p>
          <Link to="/stats">
            <Button className="w-full gap-2">
              <BarChart3 size={16} />
              Ir a Estadísticas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (membership?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rd-card p-10 max-w-md w-full mx-4 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto">
            <Clock size={32} className="text-yellow-400" />
          </div>
          <h1 className="font-rajdhani font-bold text-2xl text-foreground">
            Pago en proceso
          </h1>
          <p className="text-muted-foreground text-sm">
            Estamos confirmando tu pago. Esto puede tardar unos minutos. Te notificaremos cuando esté listo.
          </p>
          <Link to="/">
            <Button variant="outline" className="w-full">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rd-card p-10 max-w-md w-full mx-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto">
          <XCircle size={32} className="text-red-400" />
        </div>
        <h1 className="font-rajdhani font-bold text-2xl text-foreground">
          No pudimos confirmar la membresía
        </h1>
        <p className="text-muted-foreground text-sm">
          Todavía no pudimos confirmar la membresía. Si completaste el pago, puede tardar unos minutos en procesarse.
        </p>
        <Link to="/stats">
          <Button variant="outline" className="w-full">Volver a intentar</Button>
        </Link>
      </div>
    </div>
  );
}
