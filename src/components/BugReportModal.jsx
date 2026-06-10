import { useState } from 'react';
import { X, Bug, Send } from 'lucide-react';
import { createBugReport } from '@/api/bugReportsSupabase';
import { useAuth } from '@/lib/AuthContext';
import { useLocation } from 'react-router-dom';

const PAGES = [
  'Dashboard', 'Biblioteca', 'Tierlist', 'Builds', 'Partidas', 'Estadísticas', 'Sugeridor', 'Config Tierlist', 'Perfil', 'Otro'
];

const SEVERITIES = [
  { value: 'baja', label: 'Baja', color: 'border-green-500/50 text-green-400 bg-green-500/10' },
  { value: 'media', label: 'Media', color: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' },
  { value: 'alta', label: 'Alta', color: 'border-orange-500/50 text-orange-400 bg-orange-500/10' },
  { value: 'crítica', label: 'Crítica', color: 'border-red-500/50 text-red-400 bg-red-500/10' },
];

export default function BugReportModal({ onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  // Detect current page label from path
  const pathToPage = {
    '/': 'Dashboard', '/library': 'Biblioteca', '/tierlist': 'Tierlist',
    '/build-calculator': 'Builds', '/matches': 'Partidas', '/stats': 'Estadísticas',
    '/suggester': 'Sugeridor', '/admin/tierlist-config': 'Config Tierlist', '/profile': 'Perfil',
  };

  const [form, setForm] = useState({
    page: pathToPage[location.pathname] || 'Otro',
    description: '',
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    severity: 'media',
    additional_notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setLoading(true);

    await createBugReport(user, {
      ...form,
      user_id: user?.id || '',
      user_email: user?.email || '',
      user_name: user?.full_name || user?.email || '',
      date: new Date().toISOString(),
      browser: navigator.userAgent,
      status: 'pendiente',
    });

    setLoading(false);
    setSent(true);
    setTimeout(onClose, 1800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="rd-card w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Bug size={16} className="text-red-400" />
            <h2 className="font-rajdhani font-bold text-lg text-foreground">Reportar Bug</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <p className="font-semibold text-foreground">¡Reporte enviado!</p>
            <p className="text-sm text-muted-foreground">Gracias por ayudarnos a mejorar Rift Deck.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
            {/* Página */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Página donde ocurrió *</label>
              <select value={form.page} onChange={e => set('page', e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all">
                {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Severidad */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Severidad</label>
              <div className="flex gap-2 flex-wrap">
                {SEVERITIES.map(s => (
                  <button key={s.value} type="button" onClick={() => set('severity', s.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${form.severity === s.value ? s.color : 'border-border text-muted-foreground hover:border-border/80'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Descripción del bug *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="¿Qué está fallando?" required rows={3}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
            </div>

            {/* Pasos para reproducir */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Pasos para reproducirlo</label>
              <textarea value={form.steps_to_reproduce} onChange={e => set('steps_to_reproduce', e.target.value)}
                placeholder="1. Ir a... 2. Hacer clic en... 3. ..." rows={3}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
            </div>

            {/* Comportamiento esperado vs actual */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Comportamiento esperado</label>
                <textarea value={form.expected_behavior} onChange={e => set('expected_behavior', e.target.value)}
                  placeholder="Debería..." rows={2}
                  className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Comportamiento actual</label>
                <textarea value={form.actual_behavior} onChange={e => set('actual_behavior', e.target.value)}
                  placeholder="En cambio..." rows={2}
                  className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
              </div>
            </div>

            {/* Notas adicionales */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Notas adicionales</label>
              <textarea value={form.additional_notes} onChange={e => set('additional_notes', e.target.value)}
                placeholder="Cualquier info extra relevante..." rows={2}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
            </div>

            {/* Info auto-capturada */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl px-3 py-2 space-y-1">
              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide">Auto-capturado</p>
              <p className="text-[11px] text-muted-foreground">Usuario: <span className="text-foreground">{user?.email}</span></p>
              <p className="text-[11px] text-muted-foreground">Fecha: <span className="text-foreground">{new Date().toLocaleString('es-AR')}</span></p>
            </div>
            </div>

            <div className="shrink-0 border-t border-border/60 p-5">
              <button type="submit" disabled={loading || !form.description.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send size={14} />
                {loading ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
