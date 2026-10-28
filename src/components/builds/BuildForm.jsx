import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { createBuild, updateBuild } from '@/api/buildsSupabase';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';

export default function BuildForm({ build, onClose, onSaved }) {
  const t = useT();
  const isEdit = !!build;
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: build?.name || '',
    champion_name: build?.champion_name || '',
    lane: build?.lane || '',
    patch: build?.patch || '',
    items: build?.items || [],
    boots_id: build?.boots_id || '',
    enchantment_id: build?.enchantment_id || '',
    keystone_rune_id: build?.keystone_rune_id || '',
    spells: build?.spells || [],
    is_public: build?.is_public || false,
    notes: build?.notes || '',
  });
  const [itemInput, setItemInput] = useState('');
  const [spellInput, setSpellInput] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addItem = () => {
    if (itemInput.trim() && form.items.length < 6) {
      set('items', [...form.items, itemInput.trim()]);
      setItemInput('');
    }
  };

  const removeItem = (i) => set('items', form.items.filter((_, idx) => idx !== i));

  const addSpell = () => {
    if (spellInput.trim() && form.spells.length < 2) {
      set('spells', [...form.spells, spellInput.trim()]);
      setSpellInput('');
    }
  };

  const removeSpell = (i) => set('spells', form.spells.filter((_, idx) => idx !== i));

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? updateBuild(build.id, data) : createBuild(user, data),
    onSuccess: onSaved,
  });

  return (
    <div>
      <button onClick={onClose} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> {t('common.back')}
      </button>
      <h1 className="font-rajdhani font-bold text-3xl text-foreground mb-6">{isEdit ? t('builds.editarBuild') : t('builds.nuevaBuild')}</h1>

      <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5">
        {/* Basic Info */}
        <div className="rd-card p-5">
          <div className="flex items-center gap-2 mb-4"><span className="w-5 h-px bg-primary/50" /><h2 className="rd-card-title">{t('builds.informacionBasica')}</h2></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('builds.nombreDeLaBuild')}</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('builds.ejEzrealFullAp')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('common.champion')}</label>
              <input required value={form.champion_name} onChange={e => set('champion_name', e.target.value)} placeholder={t('builds.ejEzreal')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('goals.filterLabels.patches')}</label>
              <input value={form.patch} onChange={e => set('patch', e.target.value)} placeholder={t('builds.ej53')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('goals.filterLabels.lanes')}</label>
              <select value={form.lane} onChange={e => set('lane', e.target.value)}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all">
                <option value="">{t('builds.seleccionar')}</option>
                <option value="top">{t('lanes.top')}</option>
                <option value="jungler">{t('builds.jungler')}</option>
                <option value="mid">{t('lanes.mid')}</option>
                <option value="adc">{t('lanes.adc')}</option>
                <option value="support">{t('lanes.support')}</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_public} onChange={e => set('is_public', e.target.checked)}
                  className="w-4 h-4 accent-primary" />
                <span className="text-sm text-foreground">{t('builds.buildPublica')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rd-card p-5">
          <div className="flex items-center gap-2 mb-4"><span className="w-5 h-px bg-primary/50" /><h2 className="rd-card-title">{t('builds.items')}{form.items.length}/6)</h2></div>
          <div className="flex gap-2 mb-3">
            <input value={itemInput} onChange={e => setItemInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              placeholder={t('builds.nombreDelItem')}
              className="flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            <button type="button" onClick={addItem} disabled={form.items.length >= 6}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.items.map((item, i) => (
              <span key={i} className="flex items-center gap-1 bg-secondary border border-border text-foreground px-2 py-1 rounded-lg text-xs">
                {item}
                <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-red-400 ml-1"><X size={10} /></button>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('builds.botas')}</label>
              <input value={form.boots_id} onChange={e => set('boots_id', e.target.value)} placeholder={t('builds.nombreDeBotas')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('builds.encantamiento')}</label>
              <input value={form.enchantment_id} onChange={e => set('enchantment_id', e.target.value)} placeholder={t('builds.nombreDeEncantamiento')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
          </div>
        </div>

        {/* Runes & Spells */}
        <div className="rd-card p-5">
          <div className="flex items-center gap-2 mb-4"><span className="w-5 h-px bg-primary/50" /><h2 className="rd-card-title">{t('builds.runasYHechizos')}</h2></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('builds.runaPrincipalClave')}</label>
              <input value={form.keystone_rune_id} onChange={e => set('keystone_rune_id', e.target.value)} placeholder={t('builds.ejConquista')}
                className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">{t('builds.hechizos')}{form.spells.length}/2)</label>
              <div className="flex gap-2">
                <input value={spellInput} onChange={e => setSpellInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpell())}
                  placeholder={t('builds.ejFlash')} disabled={form.spells.length >= 2}
                  className="flex-1 bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all disabled:opacity-50" />
                <button type="button" onClick={addSpell} disabled={form.spells.length >= 2}
                  className="bg-secondary border border-border px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50">
                  <Plus size={14} className="text-foreground" />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                {form.spells.map((spell, i) => (
                  <span key={i} className="flex items-center gap-1 bg-secondary text-foreground px-2 py-1 rounded text-xs">
                    {spell}
                    <button type="button" onClick={() => removeSpell(i)} className="text-muted-foreground hover:text-red-400 ml-1"><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rd-card p-5">
          <label className="rd-label block mb-2">{t('builds.notasDeLaBuild')}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            placeholder={t('builds.paraQueSituacionesEs')}
            className="w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 bg-secondary border border-border text-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors">
           {t('common.cancel')}
          </button>
          <button type="submit" disabled={saveMutation.isPending || !form.name || !form.champion_name}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Save size={16} /> {saveMutation.isPending ? t('common.saving') : t('builds.guardarBuild')}
          </button>
        </div>
      </form>
    </div>
  );
}
