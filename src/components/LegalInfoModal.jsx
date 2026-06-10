import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

const MODAL_CONTENT = {
  about: {
    title: 'Acerca de',
    markdown: `

Rift Deck nació con una idea simple: ayudar a los jugadores a entender mejor el juego que disfrutan.

Creemos que mejorar no depende únicamente de reflejos o mecánicas. Cada partida genera información valiosa: decisiones, patrones, errores, aciertos y oportunidades de aprendizaje. Nuestro objetivo es transformar esos datos en herramientas útiles para que cualquier jugador pueda analizar su rendimiento, optimizar sus elecciones y tomar decisiones más inteligentes dentro de la Grieta.

La plataforma reúne estadísticas, builds, análisis de partidas, seguimiento de rendimiento, información de campeones, objetos, runas y herramientas estratégicas diseñadas para acompañar tanto a jugadores casuales como competitivos.

Rift Deck es un proyecto independiente desarrollado y mantenido por Agustín Melo para jugadores, con el objetivo de ofrecer una experiencia clara, accesible y enfocada en el aprendizaje continuo.

## Servicios Premium y Pagos

Rift Deck ofrece planes de acceso premium que permiten utilizar funciones avanzadas de análisis, estadísticas exclusivas, herramientas estratégicas, contenido adicional y otras funcionalidades reservadas para usuarios suscriptos. Las características específicas incluidas en cada plan se encuentran detalladas en las secciones correspondientes de la plataforma y pueden ser modificadas o ampliadas con el objetivo de mejorar el servicio.

## Pagos y Suscripciones

Los pagos de suscripciones y servicios premium son procesados a través de proveedores externos, incluyendo Mercado Pago y PayPal, quienes operan bajo sus propios términos, condiciones y políticas de privacidad.

Rift Deck no almacena ni tiene acceso a información financiera sensible de los usuarios, tales como números de tarjetas, cuentas bancarias o credenciales de pago.

## Renovaciones y Cancelaciones

Las suscripciones podrán renovarse automáticamente según las condiciones establecidas por la plataforma de pago utilizada.

El usuario podrá cancelar su suscripción en cualquier momento a través de la plataforma de pago correspondiente. La cancelación no generará reembolsos parciales o totales por períodos ya abonados, salvo disposición expresa en contrario o requerimiento legal aplicable.

## Disponibilidad de las Funcionalidades Premium

Rift Deck realiza esfuerzos razonables para garantizar el correcto funcionamiento y disponibilidad de las herramientas premium. Sin embargo, el usuario reconoce y acepta que determinados servicios pueden verse temporalmente afectados por tareas de mantenimiento, actualizaciones, problemas técnicos o situaciones ajenas al control de la plataforma.

En consecuencia, Rift Deck no garantiza la disponibilidad ininterrumpida de las funcionalidades premium y no será responsable por interrupciones temporales, degradación del servicio o limitaciones de acceso derivadas de circunstancias técnicas razonables.

## Limitación de Responsabilidad

Rift Deck no será responsable por:

- Fallos, interrupciones o errores atribuibles a Mercado Pago, PayPal o cualquier otro proveedor externo de servicios.
- Problemas relacionados con el procesamiento, validación o rechazo de pagos efectuados a través de terceros.
- Interrupciones temporales del servicio derivadas de tareas de mantenimiento, actualizaciones o problemas de infraestructura.
- Pérdida de acceso ocasionada por fallos de proveedores externos, servicios de alojamiento, redes de comunicación o plataformas de terceros.
- Pérdida de configuraciones, preferencias, historiales o datos generados por el usuario como consecuencia de errores técnicos, incidentes de seguridad o causas de fuerza mayor.

El uso de las funcionalidades premium implica la aceptación de estas condiciones por parte del usuario.`,
  },
  legal: {
    title: 'Aviso Legal',
    markdown: `

Última actualización: 06-06-2026

El acceso y uso de Rift Deck implica la aceptación de los términos descritos en este Aviso Legal.

## Independencia de la plataforma

Rift Deck es un proyecto independiente y no está afiliado, asociado, patrocinado ni respaldado oficialmente por Riot Games, Inc.

Wild Rift, League of Legends, Riot Games, Runeterra y todos los nombres, marcas, personajes, imágenes y elementos relacionados son propiedad de Riot Games, Inc. y sus respectivos titulares.

## Uso de la información

La información, estadísticas, análisis, recomendaciones y herramientas disponibles en la plataforma tienen fines exclusivamente informativos y educativos.

Rift Deck no garantiza resultados específicos dentro del juego ni asegura mejoras de rendimiento, clasificación o victorias.

## Disponibilidad del servicio

Nos esforzamos por mantener la plataforma disponible y actualizada, pero no garantizamos que el servicio funcione de manera ininterrumpida o libre de errores.

Podemos modificar, actualizar o discontinuar funcionalidades sin previo aviso cuando resulte necesario para el mantenimiento o mejora de la plataforma.

## Responsabilidad

Rift Deck no será responsable por daños directos o indirectos derivados del uso o imposibilidad de uso del servicio, incluyendo pérdida de datos, interrupciones o errores en la información mostrada.

## Propiedad intelectual

Todos los elementos originales desarrollados para Rift Deck, incluyendo diseño, código, contenido, textos, gráficos y funcionalidades, se encuentran protegidos por la legislación aplicable en materia de propiedad intelectual.`,
  },
  privacy: {
    title: 'Política de privacidad',
    markdown: `

Última actualización: 06-06-2026

En Rift Deck valoramos la privacidad de nuestros usuarios y nos comprometemos a proteger la información personal que compartan con nosotros.

## Información que recopilamos

Podemos recopilar información como:

- Dirección de correo electrónico.
- Nombre de usuario.
- Información vinculada a la cuenta utilizada para acceder al servicio.
- Datos de uso de la plataforma.
- Información técnica del dispositivo y navegador.
- Registros de actividad dentro de la plataforma.

## Uso de la información

La información recopilada se utiliza para:

- Proporcionar acceso a la plataforma.
- Mejorar funcionalidades y experiencia de usuario.
- Analizar el rendimiento del servicio.
- Brindar soporte técnico.
- Gestionar suscripciones y membresías.
- Detectar actividades fraudulentas o abusivas.

## Protección de datos

Implementamos medidas razonables de seguridad para proteger la información almacenada. Sin embargo, ningún sistema de transmisión o almacenamiento electrónico puede garantizar seguridad absoluta.

## Compartición de información

No vendemos ni comercializamos información personal de nuestros usuarios.

Podemos compartir información únicamente cuando:

- Sea requerido por una obligación legal.
- Sea necesario para procesar pagos o servicios contratados.
- Sea necesario para proteger la seguridad de la plataforma o sus usuarios.

## Cookies

Rift Deck utiliza cookies y tecnologías similares para:

- Mantener sesiones activas.
- Recordar preferencias del usuario.
- Analizar el uso de la plataforma.
- Mejorar el rendimiento y la experiencia general.

Las cookies pueden ser deshabilitadas desde la configuración del navegador, aunque algunas funcionalidades podrían verse afectadas.

## Servicios de terceros

La plataforma puede utilizar servicios externos para autenticación, análisis, procesamiento de pagos y alojamiento de infraestructura. Estos servicios pueden recopilar información conforme a sus propias políticas de privacidad.

## Derechos del usuario

Los usuarios pueden solicitar:

- Acceso a sus datos.
- Corrección de información inexacta.
- Eliminación de su cuenta y datos asociados.
- Información sobre el tratamiento de sus datos personales.

Para realizar cualquier solicitud relacionada con privacidad, podés contactarnos a:

**disquetegaming@gmail.com**

## Cambios en esta política

Nos reservamos el derecho de actualizar esta Política de Privacidad cuando resulte necesario. Los cambios entrarán en vigor desde su publicación en esta página.`,
  },
};

export default function LegalInfoModal({ type, onClose }) {
  const content = MODAL_CONTENT[type];

  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="rd-card w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="font-rajdhani font-bold text-lg text-foreground uppercase">
            {content.title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
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
      </div>
    </div>
  );
}
