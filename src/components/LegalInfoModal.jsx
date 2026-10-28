import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { tr } from '@/i18n/uiI18n';
import { useT } from '@/lib/LocaleContext';

// Datos del titular (LSSI-CE art. 10). Actualizar acá si cambian.
// TODO: completar código postal y ciudad del domicilio.
const OWNER = {
  name: 'Agustín Melo',
  nie: 'Z5684386X',
  address: 'Av. Dr. Waksman 1, 46006, Valencia, España',
  email: 'riftdeckapp@gmail.com',
  site: 'https://www.riftdeck.com.ar',
};

// Edad mínima para registrarse (LOPDGDD art. 7: consentimiento propio desde los 14 años).
export const MIN_AGE = 14;

// Versión de los textos legales; se guarda junto a la aceptación del registro.
export const LEGAL_VERSION = '2026-10-23';
const UPDATED = '27 de octubre de 2026';

// Documentos legales, en el orden en que se enlazan desde el footer y el perfil.
export const LEGAL_DOCUMENTS = [
  { type: 'legal', get label() { return tr('legal.docs.legal'); } },
  { type: 'terms', get label() { return tr('legal.docs.terms'); } },
  { type: 'privacy', get label() { return tr('legal.docs.privacy'); } },
  { type: 'cookies', get label() { return tr('legal.docs.cookies'); } },
];

const MODAL_CONTENT = {
  about: {
    get title() { return tr('legal.titles.about'); },
    get markdown() { return tr('legal.about', { owner: OWNER.name, email: OWNER.email }); },
  },

  legal: {
    get title() { return tr('legal.titles.legal'); },
    markdown: `
Última actualización: ${UPDATED}

En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de este sitio web.

## Datos del titular

- **Titular:** ${OWNER.name}
- **NIE:** ${OWNER.nie}
- **Domicilio:** ${OWNER.address}
- **Correo electrónico:** ${OWNER.email}
- **Sitio web:** ${OWNER.site}

## Objeto

Rift Deck es una plataforma web que permite registrar partidas de Wild Rift, analizar el rendimiento personal y consultar información de campeones, objetos, runas, builds y tierlists. El uso de la plataforma se rige por este Aviso legal, los Términos y condiciones, la Política de privacidad y la Política de cookies.

## Independencia respecto de Riot Games

Rift Deck no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas las propiedades asociadas son marcas comerciales o marcas registradas de Riot Games, Inc.

Wild Rift, League of Legends, Runeterra y los nombres, imágenes y elementos de campeones, objetos y runas pertenecen a Riot Games, Inc. y se muestran únicamente con fines informativos.

## Propiedad intelectual

El diseño, el código, los textos, los gráficos y las funcionalidades originales de Rift Deck pertenecen a su titular y están protegidos por la legislación de propiedad intelectual. No se permite su reproducción, distribución o transformación sin autorización, salvo los usos permitidos por la ley.

## Responsabilidad

La información, estadísticas, tierlists y recomendaciones de Rift Deck son orientativas y no garantizan resultados dentro del juego. El titular procura que el servicio funcione correctamente, pero no puede asegurar que esté siempre disponible o libre de errores. Nada de lo indicado limita los derechos que la ley reconoce a los consumidores.

## Enlaces externos

Rift Deck puede incluir enlaces a sitios de terceros. El titular no controla esos sitios y no es responsable de sus contenidos ni de sus políticas.

## Legislación aplicable

Este sitio se rige por la legislación española. Si eres consumidor, podrás acudir a los juzgados y tribunales de tu domicilio.`,
  },

  terms: {
    get title() { return tr('legal.titles.terms'); },
    markdown: `
Última actualización: ${UPDATED}

Estos términos regulan el uso de Rift Deck, cuyo titular es ${OWNER.name} (los datos completos figuran en el Aviso legal). Al crear una cuenta los aceptas expresamente.

## Requisitos para usar Rift Deck

- Debes tener al menos **${MIN_AGE} años** para crear una cuenta.
- Los datos que indiques al registrarte deben ser veraces y debes mantener tu contraseña en secreto.
- La cuenta es personal: eres responsable de la actividad que se realice con ella.

## Uso permitido

Puedes usar Rift Deck para registrar tus partidas, analizar tu rendimiento y consultar la información del juego. No está permitido:

- Usar la plataforma para fines ilícitos o contrarios a estos términos.
- Intentar acceder a cuentas o datos de otros usuarios, o a partes no públicas del servicio.
- Sobrecargar, automatizar o extraer de forma masiva información del servicio.
- Publicar en builds públicas contenido ofensivo, ilegal o que infrinja derechos de terceros.

## Tu contenido

Las partidas, builds y objetivos que registras son tuyos. Nos das permiso para almacenarlos y procesarlos con el único fin de prestarte el servicio. Si marcas una build como pública, otros usuarios podrán verla.

## Información orientativa

Las estadísticas, tierlists, sugerencias y consejos del Coach se generan a partir de datos del juego y de tus partidas. Son orientativos: no garantizan victorias, subidas de rango ni resultados concretos.

## Servicio gratuito y planes de pago

Hoy Rift Deck es gratuito. Si en el futuro se ofrecen planes de pago:

- Antes de contratar verás el precio final con impuestos, la duración, la forma de renovación y cómo cancelar.
- Podrás cancelar la renovación en cualquier momento; la cancelación tendrá efecto al final del período ya pagado.
- Como consumidor tendrás **14 días naturales** para desistir de la contratación sin indicar motivos. Si pides expresamente que el servicio empiece antes de que termine ese plazo, y luego desistes, pagarás solo la parte proporcional al tiempo usado.
- Los pagos se procesarán a través de proveedores externos (Mercado Pago y PayPal). Rift Deck no almacena los datos de tu tarjeta ni de tus medios de pago.

## Baja y eliminación de la cuenta

Puedes eliminar tu cuenta cuando quieras desde tu perfil. Al hacerlo se borran tus datos personales y tu contenido, como se explica en la Política de privacidad.

Podemos suspender o cerrar una cuenta que incumpla gravemente estos términos, avisándote cuando sea posible.

## Disponibilidad y cambios

Podemos actualizar, mejorar o retirar funciones del servicio. Si cambiamos estos términos de forma relevante, te lo comunicaremos antes de que entren en vigor.

## Responsabilidad

Respondemos de los daños causados por dolo o culpa grave. No respondemos de interrupciones debidas a causas ajenas a nuestro control, como fallos de proveedores externos o del propio juego. Nada de lo anterior limita los derechos que te reconoce la normativa de consumidores.

## Legislación aplicable

Estos términos se rigen por la legislación española. Si eres consumidor, podrás acudir a los juzgados y tribunales de tu domicilio. Para cualquier consulta o reclamación, escríbenos a **${OWNER.email}**.`,
  },

  privacy: {
    get title() { return tr('legal.titles.privacy'); },
    markdown: `
Última actualización: ${UPDATED}

Esta política explica cómo se tratan tus datos personales en Rift Deck, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).

## Responsable del tratamiento

- **Responsable:** ${OWNER.name}
- **NIE:** ${OWNER.nie}
- **Domicilio:** ${OWNER.address}
- **Contacto para privacidad:** ${OWNER.email}

## Qué datos tratamos

- **Cuenta:** correo electrónico, nombre visible, imagen de perfil y contraseña (que se guarda cifrada). Si entras con Google, recibimos de tu cuenta de Google tu nombre, tu correo y la dirección de tu foto de perfil, que usamos como imagen de perfil hasta que elijas otra desde tu perfil.
- **Contenido que registras:** partidas (campeón, línea, resultado, KDA, draft y otros datos de juego), builds y objetivos personales.
- **Reportes de errores:** el texto que envías, junto con tu correo y tu nombre visible.
- **Datos técnicos:** dirección IP y registros técnicos que generan los proveedores de alojamiento al servir la plataforma.
- **Pagos** (cuando estén disponibles): datos de la suscripción. Los datos de la tarjeta o del medio de pago los gestiona directamente el proveedor de pagos.

No tratamos categorías especiales de datos ni tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti. Los análisis del Coach son sugerencias de juego que puedes seguir o ignorar.

## Para qué y con qué base legal

- **Prestarte el servicio** (cuenta, registro de partidas, estadísticas, Coach, tierlist y sugeridor): ejecución del contrato que aceptas al registrarte (art. 6.1.b RGPD).
- **Sugeridores con inteligencia artificial (campeones y builds):** cuando los usas, enviamos a Google (Gemini) los datos de juego necesarios para generar la sugerencia, como tus campeones, el draft y estadísticas de partidas. No enviamos tu correo ni tu nombre. Base: ejecución del contrato, a petición tuya.
- **Atender reportes y consultas:** interés legítimo en dar soporte y mejorar el servicio (art. 6.1.f RGPD).
- **Seguridad y prevención de abusos:** interés legítimo (art. 6.1.f RGPD).
- **Obligaciones legales**, como las fiscales cuando haya pagos (art. 6.1.c RGPD).

No enviamos comunicaciones comerciales. Solo recibirás correos necesarios para tu cuenta, como la confirmación del registro o la recuperación de la contraseña.

## Cuánto tiempo conservamos los datos

- Mientras tu cuenta esté activa.
- Si eliminas la cuenta, borramos tus datos de la base de datos en ese momento. Pueden permanecer en las copias de seguridad del proveedor hasta que se renueven en su ciclo ordinario.
- Si hubiera datos de facturación, se conservarán durante los plazos que exige la ley (hasta 6 años).

## Quién recibe tus datos

No vendemos tus datos. Solo los comparten los proveedores que necesitamos para prestar el servicio, como encargados del tratamiento:

- **Supabase Inc.** (base de datos, autenticación y funciones del servidor) — Estados Unidos.
- **Vercel Inc.** (alojamiento de la web) — Estados Unidos.
- **Google LLC** (Gemini, para el sugeridor, e inicio de sesión con Google) — Estados Unidos.
- **Servidores de imágenes** de la plataforma (media.base44.com) y de Tencent (game.gtimg.cn), que reciben tu dirección IP al mostrar imágenes de campeones, objetos y runas; y de Google (googleusercontent.com), que la recibe al mostrar la foto de perfil de Google mientras la uses.
- Cuando haya pagos: **PayPal (Europe) S.à r.l. et Cie, S.C.A.** — Luxemburgo; y **Mercado Pago** — Argentina.

También podremos comunicar datos a autoridades cuando una ley lo exija.

## Transferencias internacionales

Algunos proveedores están en Estados Unidos. Esas transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. cuando el proveedor está adherido o, en su defecto, en las cláusulas contractuales tipo aprobadas por la Comisión Europea. Argentina cuenta con una decisión de adecuación de la Comisión Europea.

## Tus derechos

Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad:

- **Desde tu perfil:** puedes descargar todos tus datos y eliminar tu cuenta.
- **Por correo:** escribiendo a **${OWNER.email}**, indicando qué derecho quieres ejercer.

Si consideras que no hemos atendido bien tu solicitud, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).

## Menores

Rift Deck no está dirigido a menores de ${MIN_AGE} años. Al registrarte declaras tener al menos esa edad. Si detectamos una cuenta de un menor de ${MIN_AGE} años, la eliminaremos.

## Seguridad

Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexión cifrada, contraseñas cifradas y acceso de cada usuario solo a sus propios datos.

## Cambios en esta política

Si cambiamos esta política de forma relevante, te lo comunicaremos antes de que el cambio entre en vigor.`,
  },

  cookies: {
    get title() { return tr('legal.titles.cookies'); },
    markdown: `
Última actualización: ${UPDATED}

## Qué usamos

Rift Deck solo usa almacenamiento **técnico**, imprescindible para que la plataforma funcione:

- **Sesión de usuario:** el almacenamiento local del navegador guarda el identificador de tu sesión para que no tengas que iniciar sesión en cada visita.
- **Preferencias de la interfaz:** datos mínimos para recordar ajustes de la plataforma.

Según el artículo 22.2 de la LSSI-CE, este almacenamiento técnico no requiere tu consentimiento.

## Qué no usamos

Rift Deck **no usa** cookies de análisis, de publicidad ni de seguimiento, ni comparte datos de navegación con redes publicitarias. Por eso no mostramos un banner de cookies.

## Contenido de terceros

Algunas imágenes (de campeones, objetos y runas, y la foto de perfil de Google si entras con Google y no elegiste otra) se cargan desde servidores externos, que reciben la dirección IP necesaria para enviarlas. Si al iniciar sesión eliges Google, ese proceso se rige por la política de privacidad de Google.

## Cómo gestionarlo

Puedes borrar el almacenamiento de Rift Deck desde la configuración de tu navegador. Si lo haces, se cerrará tu sesión.

Si en el futuro incorporamos cookies que no sean técnicas, actualizaremos esta política y te pediremos tu consentimiento antes de usarlas.`,
  },
};

export default function LegalInfoModal({ type, onClose }) {
  // Se puede pasar de un documento legal a otro sin cerrar el modal.
  const [current, setCurrent] = useState(type);
  const t = useT();
  const content = MODAL_CONTENT[current];
  const isLegalDocument = LEGAL_DOCUMENTS.some(doc => doc.type === current);

  useEffect(() => {
    if (!content) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [content, onClose]);

  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="rd-card rd-modal-panel w-full max-w-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 id="legal-modal-title" className="font-rajdhani font-bold text-lg text-foreground uppercase">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={t('dashboard.cerrar')}
            aria-label={t('dashboard.cerrar')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {/* Los documentos legales solo existen en español (versión vinculante). */}
          {isLegalDocument && t('legal.spanishOnly') && (
            <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t('legal.spanishOnly')}
            </p>
          )}
          <ReactMarkdown
            components={{
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
            }}
          >
            {content.markdown}
          </ReactMarkdown>
        </div>

        {isLegalDocument && (
          <nav aria-label={t('legal.documents')} className="flex flex-wrap gap-2 border-t border-border p-4 shrink-0">
            {LEGAL_DOCUMENTS.map(doc => (
              <button
                key={doc.type}
                type="button"
                onClick={() => setCurrent(doc.type)}
                aria-current={doc.type === current ? 'page' : undefined}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  doc.type === current
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {doc.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
