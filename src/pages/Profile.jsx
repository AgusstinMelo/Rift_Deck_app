import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { AllChampions, AllWRItems, AllRunes } from '@/api/entitiesSupabase';
import {
  User,
  Save,
  Loader2,
  CheckCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  Search,
  Image
} from 'lucide-react';

const AVATAR_TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'champion', label: 'Campeones' },
  { id: 'item', label: 'Ítems' },
  { id: 'rune', label: 'Runas' },
];

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [visibleName, setVisibleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [avatarQuery, setAvatarQuery] = useState('');
  const [avatarType, setAvatarType] = useState('all');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const DELETE_CONFIRM_TEXT = 'ELIMINAR MI CUENTA';

  const { data: champions = [], isLoading: championsLoading } = useQuery({
    queryKey: ['profile-avatars', 'champions'],
    queryFn: () => AllChampions.list('name'),
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['profile-avatars', 'items'],
    queryFn: () => AllWRItems.list('name'),
  });
  const { data: runes = [], isLoading: runesLoading } = useQuery({
    queryKey: ['profile-avatars', 'runes'],
    queryFn: () => AllRunes.list('name'),
  });

  const avatarOptions = [
    ...champions.map(entity => ({ ...entity, type: 'champion' })),
    ...items.map(entity => ({ ...entity, type: 'item' })),
    ...runes.map(entity => ({ ...entity, type: 'rune' })),
  ].filter(entity => {
    const imageUrl = entity.image_url || entity.image_url_card;
    const matchesType = avatarType === 'all' || entity.type === avatarType;
    return imageUrl && matchesType && normalize(entity.name).includes(normalize(avatarQuery.trim()));
  });

  const saveAvatar = async avatarUrl => {
    setAvatarLoading(true);
    setAvatarSuccess(false);
    setAvatarError('');
    try {
      await updateUser({ avatar_url: avatarUrl });
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err) {
      setAvatarError(err?.message || 'Error al actualizar la imagen de perfil.');
    } finally {
      setAvatarLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadVisibleName();
  }, [user]);

  const loadVisibleName = async () => {
    setLoadingData(true);
    setVisibleName(user?.visible_name || user?.full_name || '');
    setLoadingData(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!visibleName.trim()) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await updateUser({ visible_name: visibleName.trim() });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || 'Error al actualizar el nombre.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== DELETE_CONFIRM_TEXT) return;

    // TODO: implementar borrado de cuenta con Supabase y limpieza segura de datos privados.
    setDeleteError('La eliminaciÃ³n de cuenta todavÃ­a no estÃ¡ disponible durante la migraciÃ³n a Supabase.');
  };

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Imagen de perfil" className="h-full w-full rounded-full object-cover" />
          ) : (
            <User size={22} className="text-primary" />
          )}
        </div>

        <div>
          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Mi Perfil
          </h1>

          <p className="text-sm text-muted-foreground">
            {user?.email}
          </p>
        </div>
      </div>

      <div className="rd-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pencil size={15} className="text-primary" />
          <h2 className="rd-card-title">Nombre de usuario</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Este nombre se mostrará en el sidebar y en tu perfil. Podés cambiarlo cuando quieras.
        </p>

        {loadingData ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 size={14} className="animate-spin" />
            Cargando...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="rd-label mb-1.5 block">
                Nombre de usuario
              </label>

              <input
                type="text"
                value={visibleName}
                onChange={e => setVisibleName(e.target.value)}
                placeholder="¿Cómo querés que te llamen?"
                required
                className="w-full bg-secondary/70 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                <CheckCircle size={14} />
                Nombre actualizado correctamente.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !visibleName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}

              Guardar nombre
            </button>
          </form>
        )}
      </div>

      <div className="rd-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Image size={15} className="text-primary" />
          <h2 className="rd-card-title">Imagen de perfil</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Elegí cualquier imagen disponible de campeones, ítems o runas.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={avatarQuery}
              onChange={event => setAvatarQuery(event.target.value)}
              placeholder="Buscar imagen..."
              className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {AVATAR_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setAvatarType(type.id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${avatarType === type.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-muted-foreground hover:text-foreground'}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {championsLoading || itemsLoading || runesLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Cargando imágenes...</div>
        ) : (
          <div className="grid max-h-80 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
            {avatarOptions.map(entity => {
              const imageUrl = entity.image_url || entity.image_url_card;
              const selected = user?.avatar_url === imageUrl;
              return (
                <button
                  key={`${entity.type}-${entity.id}`}
                  type="button"
                  onClick={() => saveAvatar(imageUrl)}
                  disabled={avatarLoading}
                  title={entity.name}
                  aria-label={`Usar ${entity.name} como imagen de perfil`}
                  className={`aspect-square overflow-hidden rounded-full border-2 bg-secondary/60 transition-all hover:scale-105 hover:border-primary ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                >
                  <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        )}

        {!championsLoading && !itemsLoading && !runesLoading && avatarOptions.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No se encontraron imágenes.</p>
        )}
        {avatarError && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{avatarError}</p>}
        {avatarSuccess && <p className="mt-4 flex items-center gap-2 text-sm text-green-400"><CheckCircle size={14} /> Imagen de perfil actualizada.</p>}
      </div>

      <div className="rd-card p-6 border-red-500/25 bg-red-500/[0.03]">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={19} className="text-red-400" />
          </div>

          <div>
            <h2 className="font-rajdhani font-bold text-xl text-red-400 uppercase tracking-tight">
              Eliminar cuenta
            </h2>

            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Esta acción eliminará tu cuenta y todos los datos privados asociados:
              partidas, builds, estadísticas personales y cualquier registro vinculado a tu usuario.
              No se puede deshacer.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="rd-label mb-1.5 block text-red-400">
              Para confirmar, escribí: {DELETE_CONFIRM_TEXT}
            </label>

            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={DELETE_CONFIRM_TEXT}
              className="w-full bg-secondary/70 border border-red-500/25 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-all placeholder:text-muted-foreground"
            />
          </div>

          {deleteError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {deleteError}
            </p>
          )}

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={true}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-500/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Trash2 size={14} />

            Eliminar mi cuenta definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
