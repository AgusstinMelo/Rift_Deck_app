import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, BookOpen, TrendingUp, Wrench, Swords,
  BarChart3, Sparkles, Settings, Menu, LogOut, User, Bug, Info, Scale, ShieldCheck, Search
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Champion, WRItem, Rune } from '@/api/entitiesSupabase';
import BugReportModal from '@/components/BugReportModal';
import LegalInfoModal from '@/components/LegalInfoModal';
import wordmarkUrl from '@/assets/riftdeck-final.png';

const LOGO_URL = 'https://media.base44.com/images/public/69f960ee6e584cfa5a577a24/aedbcc40d_FullColor.png';
const WORDMARK_URL = wordmarkUrl;

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/library', label: 'Biblioteca', icon: BookOpen },
  { path: '/tierlist', label: 'Tierlist', icon: TrendingUp },
  { path: '/build-calculator', label: 'Builds', icon: Wrench },
  { path: '/matches', label: 'Partidas', icon: Swords },
  { path: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { path: '/suggester', label: 'Sugeridor (BETA)', icon: Sparkles },
];

const infoItems = [
  { type: 'about', label: 'Acerca de', icon: Info },
  { type: 'legal', label: 'Aviso Legal', icon: Scale },
  { type: 'privacy', label: 'Política de privacidad', icon: ShieldCheck },
];

const SEARCH_TYPES = {
  champion: { tab: 'champions', label: 'Campeón' },
  item: { tab: 'items', label: 'Item' },
  rune: { tab: 'runes', label: 'Runa' },
};

function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function SidebarSearch({ collapsed, onNavigate, onExpand }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  const { data: champions = [] } = useQuery({
    queryKey: ['sidebar-search', 'champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['sidebar-search', 'items'],
    queryFn: () => WRItem.list('name'),
  });

  const { data: runes = [] } = useQuery({
    queryKey: ['sidebar-search', 'runes'],
    queryFn: () => Rune.list('name'),
  });

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    if (normalizedQuery.length < 1) return [];

    const allResults = [
      ...champions.map(entity => ({ entity, type: 'champion' })),
      ...items.map(entity => ({ entity, type: 'item' })),
      ...runes.map(entity => ({ entity, type: 'rune' })),
    ];

    return allResults
      .filter(({ entity }) => normalizeSearch(entity.name).includes(normalizedQuery))
      .sort((a, b) => {
        const nameA = normalizeSearch(a.entity.name);
        const nameB = normalizeSearch(b.entity.name);
        const startsA = nameA.startsWith(normalizedQuery);
        const startsB = nameB.startsWith(normalizedQuery);

        if (startsA !== startsB) return startsA ? -1 : 1;

        return String(a.entity.name || '').localeCompare(String(b.entity.name || ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        });
      })
      .slice(0, 8);
  }, [champions, items, query, runes]);

  const goToResult = ({ entity, type }) => {
    const config = SEARCH_TYPES[type];
    navigate(`/library?tab=${config.tab}&id=${encodeURIComponent(entity.id)}`);
    setQuery('');
    setOpen(false);
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="rd-nav-item rd-nav-item-idle justify-center px-2 w-full"
        title="Buscar"
        aria-label="Buscar"
      >
        <Search size={18} className="shrink-0" />
      </button>
    );
  }

  return (
    <div ref={searchRef} className="relative mb-3">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />

      <input
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar..."
        className="
          w-full h-10 rounded-xl border border-primary/10
          bg-secondary/50 pl-9 pr-3 text-sm text-foreground
          placeholder:text-muted-foreground outline-none
          focus:border-primary/35 focus:ring-2 focus:ring-primary/10
          transition-all
        "
      />

      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[360] overflow-hidden rounded-xl border border-primary/20 bg-popover shadow-2xl">
          {suggestions.length > 0 ? (
            <div className="max-h-80 overflow-y-auto p-1.5">
              {suggestions.map(({ entity, type }) => {
                const config = SEARCH_TYPES[type];
                const imageUrl = entity.image_url || entity.image_url_card;

                return (
                  <button
                    key={`${type}-${entity.id}`}
                    type="button"
                    onClick={() => goToResult({ entity, type })}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-primary/10 transition-colors"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={entity.name}
                        className="h-9 w-9 rounded-lg object-cover border border-primary/15 shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {entity.name?.[0] || '?'}
                      </div>
                    )}

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {entity.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {config.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Sin resultados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState(null);
  const location = useLocation();
  const { user, logout } = useAuth();
  const visibleName = user?.visible_name || user?.full_name || user?.email || 'Usuario';

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden rd-app-shell">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-[250] lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:relative z-[300] h-full flex flex-col
          rd-sidebar
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="rd-sidebar-brand">
          {!collapsed ? (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex items-center justify-center gap-3">
                <img
                  src={LOGO_URL}
                  alt="Rift Deck"
                  className="w-12 h-12 object-contain drop-shadow-[0_0_18px_rgba(77,166,255,.22)] shrink-0"
                />
                <img
                  src={WORDMARK_URL}
                  alt="Rift Deck"
                  className="h-16 object-contain drop-shadow-[0_0_12px_rgba(212,175,55,.30)]"
                />
              </div>

              <div className="flex items-center gap-2 opacity-70">
                <span className="h-px w-4 bg-primary/40" />
                <span className="text-[8px] uppercase tracking-[0.32em] text-primary">
                  Juega con Información
                </span>
                <span className="h-px w-4 bg-primary/40" />
              </div>
            </div>
          ) : (
            <img
              src={LOGO_URL}
              alt="Rift Deck"
              className="w-10 h-10 object-contain mx-auto drop-shadow-[0_0_18px_rgba(77,166,255,.22)]"
            />
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex mt-3 text-muted-foreground hover:text-primary transition-colors ${collapsed ? 'mx-auto' : 'self-start ml-5'}`}
          >
            <Menu size={16} />
          </button>
        </div>

        <nav className="flex-1 py-5 overflow-y-auto px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <SidebarSearch
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
            onExpand={() => setCollapsed(false)}
          />

          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);

            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`
                  rd-nav-item group
                  ${active ? 'rd-nav-item-active' : 'rd-nav-item-idle'}
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
              >
                {active && <span className="rd-nav-active-bar" />}

                <Icon size={18} className="shrink-0" />

                {!collapsed && (
                  <span className="font-medium text-sm">{label}</span>
                )}

                {collapsed && (
                  <span className="absolute left-full ml-3 px-2 py-1 bg-popover border border-primary/20 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="rd-sidebar-footer space-y-3">
          {user?.role === 'admin' && (
            <Link
              to="/admin/tierlist-config"
              className={`flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
            >
              <Settings size={16} />
              {!collapsed && <span>Config Tierlist</span>}
            </Link>
          )}

          {infoItems.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setActiveInfoModal(type)}
              className={`
                flex items-center text-muted-foreground hover:text-primary
                transition-colors text-sm
                ${collapsed
                  ? 'w-full justify-center gap-0 px-0'
                  : 'w-full justify-start gap-3'
                }
              `}
              title={label}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}

          <button
            onClick={() => setBugModalOpen(true)}
            className={`
              flex items-center text-muted-foreground hover:text-red-400 
              transition-colors text-sm
              ${collapsed 
                ? 'w-full justify-center gap-0 px-0' 
                : 'w-full justify-start gap-3'
              }
            `}
            title="Reportar bug"
          >
            <Bug size={16} className="shrink-0" />
            {!collapsed && <span>Reportar Bug</span>}
          </button>

          {user && (
            <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <User size={13} className="text-primary" />
              </div>
              {!collapsed && (
                <Link to="/profile" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <p className="text-xs text-foreground font-medium truncate">{visibleName}</p>
                </Link>
              )}
              {!collapsed && (
                <button
                  onClick={() => logout()}
                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  title="Cerrar sesión"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="relative lg:hidden flex items-center justify-center h-14 px-4 border-b border-primary/10 bg-card shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="
              absolute left-4 top-1/2 z-[200]
              flex h-12 w-12 -translate-y-1/2
              items-center justify-center rounded-xl
              p-0 leading-none
              text-muted-foreground
              transition-colors
              hover:bg-secondary/70 hover:text-primary
              active:bg-secondary
            "
            aria-label="Abrir menú"
          >
            <Menu size={22} className="pointer-events-none" />
          </button>

          <div className="pointer-events-none flex min-w-0 items-center justify-center gap-2 overflow-hidden px-16">
            <img src={LOGO_URL} alt="Rift Deck" className="w-7 h-7 object-contain" />
            <img src={WORDMARK_URL} alt="Rift Deck" className="h-6 object-contain" />
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="
              absolute right-4 top-1/2 z-[200]
              flex h-12 w-12 -translate-y-1/2
              items-center justify-center rounded-xl
              p-0 leading-none
              text-muted-foreground
              transition-colors
              hover:bg-secondary/70 hover:text-red-400
              active:bg-secondary
            "
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} className="pointer-events-none" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto rd-main-content">
          <Outlet />
        </main>
      </div>
      {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
      {activeInfoModal && (
        <LegalInfoModal
          type={activeInfoModal}
          onClose={() => setActiveInfoModal(null)}
        />
      )}
    </div>
  );
}
