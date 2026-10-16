import { Component } from 'react';
import { AlertCircle } from 'lucide-react';
import { BUTTON_SECONDARY } from './goalUi';

/**
 * Evita que un error de render en Objetivos deje la app en blanco y muestra qué falló.
 * Se reinicia al cambiar de ruta (`resetKey`).
 */
export default class GoalsErrorBoundary extends Component {
  /** @param {{ resetKey: string, children: any }} props */
  constructor(props) {
    super(props);
    this.state = { error: /** @type {Error|null} */ (null) };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error en Objetivos:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="rd-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="font-rajdhani text-lg font-bold text-foreground">Algo falló al mostrar esta sección</p>
            <p className="mt-1 break-words font-mono text-xs text-red-300">{error.message}</p>
          </div>
        </div>
        {error.stack && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Detalle técnico</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[11px]">{error.stack}</pre>
          </details>
        )}
        <a href="/objetivos" className={BUTTON_SECONDARY}>Volver a Objetivos</a>
      </div>
    );
  }
}
