# Rift Deck — Roadmap

Revisado el 16/11/2026. Corto plazo: próximas semanas. Mediano: 1 a 3 meses. Largo: más adelante.

---

## Dónde estamos

### Fortalezas (en qué apoyarse)

- **Captura de partidas por foto.** Casi todo se reconoce en el celular sin IA: los 10 campeones, los objetos, los hechizos y los números. Gemini queda de respaldo. Es la ventaja más difícil de copiar.
- **Catálogo etiquetado.** Campeones, objetos y runas tienen rasgos, debilidades, tipo de daño, roles y efectos. Con eso el Coach da consejos de juego y no solo números.
- **Motor del Coach.** Funciones puras con tests. Ajusta por tamaño de muestra, sabe la clase de cada campeón, hace seguimiento de los consejos y siempre muestra entre 4 y 6.
- **Objetivos.** Son configurables (dato × cálculo × condición), se evalúan solos y tienen un límite para el plan Free.
- **Tierlist diaria automática,** con penalización por elo y snapshots por parche.
- **Páginas públicas prerenderizadas** de campeones, objetos y runas, buenas para SEO. Hay 4 idiomas.
- **Base de producto completa:** membresía (Mercado Pago y PayPal), exportación de datos, borrado de cuenta y RLS.

### Límites de los datos (no los podemos cambiar)

- **No hay API de Wild Rift.** Solo sabemos lo que el usuario carga o lo que se ve en la pantalla final.
- **No hay línea de tiempo.** No sabemos oro a los 10 minutos, objetivos, wards, orden de compra ni cuándo murió.
  - El Coach no puede hablar de early/late con precisión. Usa la duración como aproximación.
- **Muestra chica y sesgada.** Un usuario típico tiene entre 20 y 200 partidas, y puede cargar más victorias que derrotas.
  - Todo consejo tiene que sobrevivir a eso, con shrinkage y umbrales.
- **El rango y el LP no son verificables.** No sirven para rankings entre usuarios.
- **Los parches cambian el catálogo.** Un dato de hace dos parches puede no valer.

**Regla general:** comparar al usuario consigo mismo, dar consejos que dependan de él (build, pool, runas, sesiones, muertes) y no inventar datos que no tenemos.

---

## Corto plazo — ordenar la casa y pulir lo que ya está

### Base de datos y deploy

- [x] **Historial de migraciones reparado** (16/11/2026): local y remoto coinciden y las migraciones se aplican con `db push --remote`. Ver [docs/migraciones.md](docs/migraciones.md).
- [x] **Migraciones `202611160001`, `202611160002` y `202611170001` aplicadas.**
- [ ] **Redeployar `delete-account`** (`npx supabase functions deploy delete-account`) para que borre también `coach_insight_log`.
- [x] **CI** en [.github/workflows/ci.yml](.github/workflows/ci.yml): `lint`, `i18n:ui`, `test`, `build` y e2e en cada push a main. Necesita los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

### Rendimiento

- [x] **Partidas por `user_id`:** una sola query compartida (`userMatchesQuery`). Todas las partidas tienen `user_id`, así que se quitó la búsqueda por email.
- [x] **Partidas sin corte en 1000:** se piden por páginas (tope de 10 000). Sugeridor y Biblioteca recortan con `select` sin achicar la caché compartida.
- [ ] **Pedir solo las columnas necesarias** en vez de `select('*')` (requiere revisar qué campos usa cada pantalla).
- [x] **Bundle:** `index` bajó de 844 a 728 KB y `Goals` de 448 a 64 KB (recharts y react-markdown se cargan aparte). Se sacaron 11 dependencias sin uso.
- [ ] **Bundle, siguiente paso:** cargar las páginas públicas (home y biblioteca) de forma diferida para los usuarios logueados, cuidando la hidratación del prerender.
  - Cargar los gráficos (recharts) y `@hello-pangea/dnd` solo donde se usan.
  - Revisar qué componentes de `ui/` no se usan.

### Código

- [x] **Carga y edición de partida unificadas:** los pasos, la build y las estadísticas viven en [matchFlow.jsx](src/components/matches/matchFlow.jsx). Los dos formularios pasaron de 2280 a 1488 líneas en total.
- [x] **`Stats.jsx` dividido** (de 1377 a 708 líneas): cálculos en `components/stats/statsHelpers.js` y tarjetas en `StatsSections.jsx`.
- [x] **`index.css` dividido** en 14 archivos en `src/styles/`, importados en el mismo orden (el CSS compilado es idéntico).
- [ ] **Reemplazar en el CSS las reglas que dependen del orden de los elementos** (`:nth-child`) por clases.
- [x] **Smoke e2e de las páginas públicas** con Playwright (`npm run test:e2e`).
- [ ] **Corregir la hidratación del prerender:** el HTML prerenderizado no coincide con el primer render del cliente (errores de React #418/#423). Ya estaba así; el test marcado con `test.fail()` lo sigue.
- [ ] **E2e con login** (cargar partida → ver Coach), con una cuenta de prueba en un proyecto de Supabase aparte.

### Coach (iterar con datos reales)

- [ ] **Botón "¿te sirvió?"** en cada consejo, guardado en `coach_insight_log`. Es la única forma de saber qué familias aportan.
- [ ] **Revisar consejos con cuentas reales** de distintos roles (tirador, tanque, soporte, jungla) y ajustar umbrales y textos, como se hizo con Kai'Sa.
- [ ] **Usar la participación en kills** una vez que haya partidas con kills de equipo: rol de soporte/jungla, "jugás aislado" y similares.

### Captura

- [ ] **Juntar capturas de teléfonos con otra relación de aspecto** (no 2,22:1) y ajustar `LAYOUT`.
- [ ] **Medir cuántas veces se corrige cada campo** en la confirmación, para saber dónde falla la lectura.

---

## Mediano plazo — que el Coach acompañe antes, durante y después

### Antes de jugar

- [ ] **Preparar partida:** elegís tu campeón y el rival, y ves en una pantalla tu historial en ese matchup, el plan del Coach, la build del sugeridor y las runas que mejor te funcionaron. Junta piezas que ya existen (Coach, Sugeridor, Library).
- [ ] **Recomendación de pool:** "esta semana jugá X e Y". Se calcula con tu rendimiento, la tierlist y el parche.

### Durante la sesión

- [ ] **Aviso de tilt** al cargar una partida: "llevás 3 derrotas seguidas; después de 3, tu winrate baja al 30 %". Solo si el patrón del usuario lo justifica.
- [ ] **Resumen de sesión** al cerrar el día: partidas, resultado y un solo consejo.

### Después de jugar

- [ ] **Informe semanal** con qué mejoró, qué empeoró, el consejo que seguiste y su resultado (usa el seguimiento que ya existe). Puede ir por email o como notificación.
- [ ] **Análisis por parche:** cómo te fue con tus campeones antes y después de un cambio de objetos o runas que los afecte.
- [ ] **Ciclo consejo → objetivo → resultado:** que el Coach diga si el objetivo que creaste desde un consejo mejoró el dato.

### Captura y datos

- [ ] **Cargar varias partidas de una vez** (subir 5 o 10 marcadores seguidos).
- [ ] **Captura también en escritorio** (hoy es solo mobile).
- [ ] **Compartir al instalar como PWA** (share target): mandar la captura desde la galería directo a Rift Deck. Ya hay `manifest.json`; falta el service worker.
- [ ] **Investigar si la pestaña Estadísticas** muestra daño infligido y recibido o daño a torres. Si se puede leer, el Coach gana mucho (aporte de daño, tanqueo).
- [ ] **Vincular la build guardada a la partida** (`build_id`). Hoy `SavedBuildPicker` solo precarga la build. Con el vínculo se mide qué build tuya rinde más.
- [ ] **Importar desde CSV** (exportar en JSON ya existe).

### Producto

- [ ] **Separar mejor Free y Premium:** Coach completo, informe semanal y preparar partida como Premium. Que lo básico siga siendo gratis.
- [ ] **Onboarding:** las primeras 5 partidas con capturas guiadas y el primer consejo visible enseguida.

---

## Largo plazo — escala y comunidad (cuando haya volumen)

- [ ] **Datos agregados anónimos y opt-in:** "jugadores de Rift Deck con Kai'Sa contra Draven ganan X %". Hace falta mucho volumen y corregir el sesgo de autocarga; no prometer antes de tener los números.
- [ ] **Modo coach/equipo:** un coach real (o un dúo/equipo) ve las partidas y consejos de sus alumnos y deja notas. Es la monetización natural.
- [ ] **Perfil público opcional** y tarjetas compartibles ("mi semana en Rift Deck"). Sin rankings entre usuarios.
- [ ] **App nativa o PWA completa,** con notificaciones de tilt, informe semanal y objetivos.
- [ ] **Asistente de draft** con sinergias y counters de tu pool contra la composición rival, usando el catálogo y tu historial.
- [ ] **Redacción con IA opcional** sobre el informe del Coach. Los datos y el consejo los sigue decidiendo el motor; la IA solo escribe.

---

## Lo que no vamos a hacer

- Rankings competitivos entre usuarios con datos autocargados.
- Leer el juego en vivo, overlays o automatizaciones que puedan violar los términos de Riot.
- Consejos generados libremente por IA sin pasar por el motor y el catálogo.
- Consejos del tipo "jugá más partidas para validar".

## Cómo priorizar

1. Lo que hace más rápido cargar una partida, porque sin partidas no hay Coach.
2. Lo que hace más útil el consejo que el usuario ve hoy.
3. Lo que reduce el riesgo técnico: migraciones, CI y código duplicado.
4. Lo nuevo y vistoso, al final.
