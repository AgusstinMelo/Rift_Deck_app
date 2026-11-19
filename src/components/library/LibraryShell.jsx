// Estructura común de la Biblioteca (pública y privada): una barra de una línea con el
// título y las pestañas Campeones / Objetos / Runas, y debajo el contenido, que ocupa todo
// el alto que queda. La grilla de adentro se adapta al ancho real de la biblioteca (con o
// sin sidebar) con container queries, no al ancho de la pantalla.
import { Link } from 'react-router-dom';
import { BookOpen, Gem, Sword } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';

export const LIBRARY_TABS = [
  { id: 'champions', label: 'common.champions', icon: Sword, to: '/campeones' },
  { id: 'items', label: 'common.items', icon: BookOpen, to: '/objetos' },
  { id: 'runes', label: 'common.runes', icon: Gem, to: '/runas' },
];

/**
 * @param {{
 *   kicker: string, title: string, srTitle?: string, isDetail?: boolean,
 *   activeTab: string, linkTabs?: boolean, onSelectTab?: (id: string) => void,
 *   children: React.ReactNode,
 * }} props
 * `linkTabs`: las pestañas son enlaces (biblioteca pública, rastreables); si no, botones.
 * En una ficha el <h1> es el nombre del campeón, objeto o runa: el título de la barra pasa a <p>.
 */
export default function LibraryShell({ kicker, title, srTitle, isDetail = false, activeTab, linkTabs = false, onSelectTab, children }) {
  const t = useT();
  const TitleTag = isDetail ? 'p' : 'h1';

  return (
    <div className="rd-page rd-lib" data-view={isDetail ? 'detail' : 'catalog'}>
      <header className="rd-lib-bar">
        <div className="rd-lib-heading">
          <p className="rd-lib-kicker">{kicker}</p>
          <TitleTag className="rd-lib-title">
            {title}
            {!isDetail && srTitle && <span className="sr-only">: {srTitle}</span>}
          </TitleTag>
        </div>

        <nav className="rd-lib-tabs" aria-label={t('library.seccionesDeLaBiblioteca')}>
          {LIBRARY_TABS.map(({ id, label, icon: Icon, to }) => {
            const active = id === activeTab;
            const content = (
              <>
                <Icon size={15} aria-hidden="true" />
                <span>{t(label)}</span>
              </>
            );
            return linkTabs ? (
              <Link key={id} to={to} aria-current={active ? 'page' : undefined} className={`rd-lib-tab ${active ? 'rd-lib-tab-active' : ''}`}>
                {content}
              </Link>
            ) : (
              <button key={id} type="button" aria-pressed={active} onClick={() => onSelectTab?.(id)} className={`rd-lib-tab ${active ? 'rd-lib-tab-active' : ''}`}>
                {content}
              </button>
            );
          })}
        </nav>
      </header>

      {/* rd-library-catalog / rd-library-detail: los listados y las fichas de objetos y runas
          todavía usan esas clases para su scroll interno. */}
      <div className={`rd-lib-body ${isDetail ? 'rd-library-detail' : 'rd-library-catalog'}`}>
        {children}
      </div>
    </div>
  );
}
