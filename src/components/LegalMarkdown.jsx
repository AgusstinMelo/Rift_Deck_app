// Cuerpo en markdown de los documentos legales. Va en su propio archivo para cargarse
// solo al abrir el modal: react-markdown no entra en el bundle principal.
import ReactMarkdown from 'react-markdown';

const COMPONENTS = {
  h2: ({ children }) => (
    <h3 className="font-rajdhani text-primary text-base font-bold uppercase tracking-wide mt-6 first:mt-0 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-6 text-muted-foreground mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-2 text-sm leading-6 text-muted-foreground">
      {children}
    </ul>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

export default function LegalMarkdown({ children }) {
  return <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>;
}
