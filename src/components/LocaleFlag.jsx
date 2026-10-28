// Banderas de los idiomas en SVG: los emojis de bandera no se ven en Windows.
// Todas comparten el viewBox 30x20 (proporción 3:2).

const USA_STARS = Array.from({ length: 20 }, (_, index) => ({
  cx: 1.4 + (index % 5) * 2.3,
  cy: 1.3 + Math.floor(index / 5) * 2.5,
}));

const FLAGS = {
  // Latinoamérica (no tiene bandera): México, Centroamérica, el Caribe y Sudamérica
  // sobre fondo azul, sin Estados Unidos ni Canadá.
  'es-419': (
    <>
      <rect width="30" height="20" fill="#1d4ed8" />
      <g fill="#d4af37">
        {/* México y Centroamérica */}
        <path d="M5.2 0.8 9.4 1.2 10.6 2.4 12 2.1 12.3 3.9 11.6 5.4 12.1 6.1 13.6 5.7 13.9 6.5 12.9 7.3 12.3 7.2 13.3 8.3 14.6 9.1 16.5 9.9 16.4 10.5 14.3 9.9 12.8 9.2 11.2 8.3 9.5 7.2 8.2 5.8 6.9 3.9 5.8 2.4z" />
        {/* Baja California */}
        <path d="M3.6 0.9 4.6 2.6 5.6 4.3 6.3 5.6 5.7 5.7 4.6 4.1 3.6 2.3z" />
        {/* Cuba y La Española */}
        <path d="M14.2 4.4 17.3 4.9 18.4 5.6 17.6 5.8 14.1 4.9z" />
        <path d="M19 6 20.9 6 21.2 6.5 19.2 6.7z" />
        {/* Sudamérica */}
        <path d="M16.4 10.2 18 9.4 20.4 9.2 22.4 10.1 24.6 11.1 26.9 12.2 26.6 13.7 24.6 14.9 23.4 16.2 22.1 17.4 21 18.6 20 19.6 19.4 19.4 19.6 17.6 19.1 15.8 18 14.2 17 12.6 16.5 11.4z" />
      </g>
    </>
  ),
  'es-ES': (
    <>
      <rect width="30" height="20" fill="#c60b1e" />
      <rect y="5" width="30" height="10" fill="#ffc400" />
    </>
  ),
  'pt-BR': (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <path fill="#ffdf00" d="M15 2.2 27.6 10 15 17.8 2.4 10z" />
      <circle cx="15" cy="10" r="4.6" fill="#002776" />
      <path d="M10.6 9.1c3-.9 6.3-.6 8.9 1" stroke="#fff" strokeWidth="0.9" fill="none" />
    </>
  ),
  en: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={index} y={index * (40 / 13)} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="12" height={140 / 13} fill="#3c3b6e" />
      {USA_STARS.map(star => <circle key={`${star.cx}-${star.cy}`} {...star} r="0.45" fill="#fff" />)}
    </>
  ),
};

export default function LocaleFlag({ locale, className = 'h-3.5 w-[21px] ring-white/15' }) {
  const flag = FLAGS[locale];
  if (!flag) return null;
  return (
    <svg
      viewBox="0 0 30 20"
      className={`shrink-0 overflow-hidden rounded-[3px] ring-1 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {flag}
    </svg>
  );
}
