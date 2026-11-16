// Markdown mínimo para textos de catálogo (descripciones de objetos): párrafos separados
// por línea en blanco, listas ("1. ", "- ", "* ") y **negrita**. Reemplaza a
// react-markdown en las páginas públicas para no sumar ~150 KB al bundle principal, y
// renderiza igual en el prerender (sin carga diferida).
//
// Sigue CommonMark en lo que usan esos textos: un salto de línea simple no corta el
// párrafo (el navegador lo muestra como espacio), una lista puede empezar en medio de un
// párrafo (la numerada solo si arranca en 1) y las líneas sin marcador después de un
// ítem continúan ese ítem.
import { Fragment } from 'react';

const ORDERED = /^ {0,3}(\d{1,9})[.)]\s+(.*)$/;
const BULLET = /^ {0,3}[-*+]\s+(.*)$/;

function listMarker(line) {
  const ordered = line.match(ORDERED);
  if (ordered) return { ordered: true, start: Number(ordered[1]), text: ordered[2] };
  const bullet = line.match(BULLET);
  if (bullet) return { ordered: false, start: 1, text: bullet[1] };
  return null;
}

/** Bloques de un texto: { type: 'p', text } | { type: 'ol' | 'ul', start, items: string[] }. */
export function parseSimpleMarkdown(source) {
  const blocks = [];
  // Se conserva el fin de línea original (\n o \r\n) dentro de cada bloque, como react-markdown.
  const tokens = String(source ?? '').split(/(\r\n|\r|\n)/);
  let paragraph = null;
  let list = null;

  // Cada línea es [texto, fin de línea que la sigue].
  const joinLines = lines => lines.map(([text, eol], index) => text + (index < lines.length - 1 ? eol : '')).join('');
  const close = () => {
    if (paragraph) blocks.push({ type: 'p', text: joinLines(paragraph) });
    if (list) blocks.push({ type: list.ordered ? 'ol' : 'ul', start: list.start, items: list.items.map(joinLines) });
    paragraph = null;
    list = null;
  };

  for (let index = 0; index < tokens.length; index += 2) {
    const rawLine = tokens[index];
    const eol = tokens[index + 1] || '\n';
    if (!rawLine.trim()) { close(); continue; }
    const line = rawLine.trim();
    const marker = listMarker(rawLine);

    if (marker && list && marker.ordered === list.ordered) {
      list.items.push([[marker.text.trim(), eol]]);
      continue;
    }
    // Dentro de un párrafo, solo una numerada que empieza en 1 (o una viñeta) abre lista.
    if (marker && (!paragraph || !marker.ordered || marker.start === 1)) {
      close();
      list = { ordered: marker.ordered, start: marker.start, items: [[[marker.text.trim(), eol]]] };
      continue;
    }
    if (list) { list.items[list.items.length - 1].push([line, eol]); continue; }
    if (!paragraph) paragraph = [];
    paragraph.push([line, eol]);
  }
  close();
  return blocks;
}

// Escape de CommonMark: una barra antes de un signo de puntuación ASCII lo deja literal.
const unescape = text => text.replace(/\\([!-/:-@[-`{-~])/g, '$1');

function Inline({ text, strong: Strong }) {
  // **negrita**; el resto, texto tal cual (React lo escapa).
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => (
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <Strong key={index}>{unescape(part.slice(2, -2))}</Strong>
      : <Fragment key={index}>{unescape(part)}</Fragment>
  ));
}

const DefaultStrong = ({ children }) => <strong>{children}</strong>;
const DefaultParagraph = ({ children }) => <p>{children}</p>;

/** `components`: { p, strong } con la misma forma que en react-markdown. */
export default function SimpleMarkdown({ children, components = {} }) {
  const Paragraph = components.p || DefaultParagraph;
  const Strong = components.strong || DefaultStrong;

  return parseSimpleMarkdown(children).map((block, index) => {
    if (block.type === 'p') {
      return <Paragraph key={index}><Inline text={block.text} strong={Strong} /></Paragraph>;
    }
    const List = block.type;
    return (
      <List key={index} start={block.type === 'ol' && block.start !== 1 ? block.start : undefined}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}><Inline text={item} strong={Strong} /></li>
        ))}
      </List>
    );
  });
}
