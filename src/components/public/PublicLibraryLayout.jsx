import PublicHeader from '@/components/public/PublicHeader';
import LibraryShell from '@/components/library/LibraryShell';
import { useT } from '@/lib/LocaleContext';

// Biblioteca pública: encabezado del sitio y la misma estructura que la privada
// (LibraryShell), con pestañas que son enlaces a cada catálogo.
export default function PublicLibraryLayout({ activeTab, isDetail = false, srTitle, children }) {
  const t = useT();
  return (
    <div className="relative z-10 flex h-dvh min-h-0 flex-col text-foreground">
      <PublicHeader />

      <main className="rd-main-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <LibraryShell
          kicker={t('library.bibliotecaPublica')}
          title={t('nav.library')}
          srTitle={srTitle}
          isDetail={isDetail}
          activeTab={activeTab}
          linkTabs
        >
          {children}
        </LibraryShell>
      </main>
    </div>
  );
}
