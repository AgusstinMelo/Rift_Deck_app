import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import HomeFooter from '@/components/home/HomeFooter';
import Seo from '@/components/Seo';
import { LEGAL_CONTENT, PUBLIC_LEGAL_DOCUMENTS } from '@/components/LegalInfoModal';
import { getLegalSeo } from '@/seo/publicSeo';
import { useT } from '@/lib/LocaleContext';

// Documentos legales con URL propia (/privacidad, /terminos, /eliminar-cuenta...): Google Play
// pide enlazar la política de privacidad y la página para eliminar la cuenta. El prerender trae
// el título; el cuerpo lo dibuja el navegador (main.jsx no hidrata estas rutas), así
// react-markdown sigue fuera del código de la home.
const LegalMarkdown = lazy(() => import('@/components/LegalMarkdown'));

export default function PublicLegal({ type }) {
  const t = useT();
  const content = LEGAL_CONTENT[type];

  return (
    <div className="relative z-10 flex min-h-dvh flex-col text-foreground">
      <Seo {...getLegalSeo(type)} indexable />
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <article className="rd-card p-5 md:p-8">
          <h1 className="mb-5 font-rajdhani text-2xl font-bold uppercase text-foreground md:text-3xl">
            {content.title}
          </h1>
          {t('legal.spanishOnly') && (
            <p className="mb-5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t('legal.spanishOnly')}
            </p>
          )}
          <Suspense fallback={null}>
            <LegalMarkdown>{content.markdown}</LegalMarkdown>
          </Suspense>
        </article>

        <nav aria-label={t('legal.documents')} className="mt-6 flex flex-wrap gap-2">
          {PUBLIC_LEGAL_DOCUMENTS.map(doc => (
            <Link
              key={doc.type}
              to={doc.path}
              aria-current={doc.type === type ? 'page' : undefined}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                doc.type === type
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {doc.label}
            </Link>
          ))}
        </nav>
      </main>

      <HomeFooter />
    </div>
  );
}
