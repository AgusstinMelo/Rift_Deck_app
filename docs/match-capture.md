# Carga de partidas con capturas (mobile)

En el celular, el usuario sube 1 o 2 capturas de la pantalla de fin de partida (el marcador y la pestaña Estadísticas › Runa). La app extrae los datos con Gemini (plan gratuito), el usuario los confirma y recién ahí se guarda la partida.

## Piezas

| Parte | Archivo |
|---|---|
| Esquema de campos, validación del JSON del modelo y unificación de capturas (compartido con los tests) | `supabase/functions/_shared/matchCapture.js` |
| Edge function (auth, validación de imágenes, rate limit, llamada a Gemini) | `supabase/functions/extract-match-capture/index.ts` |
| Campos extraídos → formulario → registro de `matches` | `src/features/matchCapture/captureFields.js` |
| Reducción de imágenes en el cliente (lado mayor 1600 px, JPEG 0.8) | `src/features/matchCapture/imageResize.js` |
| Borrador (localStorage + IndexedDB) | `src/features/matchCapture/captureDraft.js` |
| Bottom sheet: procesando / error (al terminar abre el formulario manual precargado) | `src/components/matches/capture/CaptureMatchFlow.jsx` |
| Láminas de referencia y códigos | `src/features/matchCapture/referenceSheets.js`, `referenceCodes.js` |
| Barra inferior en Partidas (solo mobile) | `src/pages/Matches.jsx` |
| Tests | `test/matchCapture/matchCapture.test.js` (`npm run test:capture`) |

**Agregar un campo:** sumarlo a `CAPTURE_FIELDS` en `_shared/matchCapture.js`. El JSON Schema del modelo, el prompt, la validación y la unificación se derivan de esa lista. Para mostrarlo en la confirmación, agregarlo en `captureFields.js` y en `CaptureMatchFlow.jsx`.

## Qué se extrae y cómo

Todo lo que pide la carga manual, **menos el lado del mapa**. Al terminar la lectura se abre el **mismo formulario de carga manual** (`MatchBuilder` con `initialMatch`) ya completo, con un aviso de qué conviene revisar. El usuario recorre los pasos y guarda como siempre.

| Dato | De dónde sale |
|---|---|
| Campeón, aliados y enemigos (con línea), objetos, runas, hechizos | **Identificación visual** contra las láminas de referencia (ver abajo). |
| Resultado, K / D / A, duración, oro, tipo de partida, línea propia | Lectura de la captura. |
| Fecha, hora, parche | La fecha y hora actuales y el parche vigente, porque la pantalla de resultados no los muestra. |
| Lado | Queda vacío. |

### Cómo se identifica cada cosa

La pantalla de resultados de Wild Rift tiene siempre la misma disposición:
- **Escala:** escala con el alto de la pantalla y está centrada en el ancho.
- **Orden de las filas:** top, jungla, mid, ADC, soporte, como indican los íconos de línea del medio.
- **Tu fila:** tiene una barra dorada a la izquierda.

Por eso casi todo se resuelve **en el celular, sin IA** (`scoreboardLayout.js`):

| Qué | Cómo | Respaldo |
|---|---|---|
| Tu fila y tu línea | Se busca la barra dorada; la fila da la línea. | Lo que lea el modelo. |
| Los 10 campeones con su línea | Se recorta cada retrato en su posición fija y se compara por píxeles con el catálogo, sin repetir campeones. | Lámina de referencia de campeones (Gemini). |
| Tus hechizos y objetos | Posiciones fijas en tu fila y comparación por píxeles. | Cajas `box_2d` de Gemini. |
| Runas | Nombre escrito al lado de cada runa, leído por Gemini. | Columna central de la pestaña de runas comparada por píxeles en el celular, y por último las cajas de Gemini. |
| K/D/A, oro, duración, resultado, modo | Gemini, que lee el texto. | — |

El celular detecta solo qué captura es el marcador (por la barra dorada) y cuál es la pestaña de runas (porque las 5 posiciones de la columna se parecen mucho a runas reales). Si Gemini falla o no hay cupo, igual se abre el formulario con lo que se reconoció en el celular, y el texto queda para completar.

**Con las capturas reales de `test/fixtures/captures`** (3 partidas: Kai'Sa, Ornn y Xayah):
- 30/30 campeones;
- 6/6 hechizos;
- 15/15 objetos, más los slots vacíos;
- 15/15 runas.

La identificación local tarda unos 1,2 s por marcador.

**Límite conocido:** las medidas salen de capturas con relación 2,22:1. En pantallas con otra proporción, la interfaz del juego podría acomodarse distinto. En ese caso no se encuentra la barra o las comparaciones dan parecidos bajos: se usa el respaldo de Gemini y esos datos quedan marcados para revisar. Con capturas de esos teléfonos se pueden ajustar las constantes de `LAYOUT`.

Detalles de la comparación por píxeles:
- Cada recorte y cada ícono del catálogo se reducen a una grilla chica de color y se mide su correlación. Es insensible al brillo y al contraste.
- **Calibración por tipo de ícono:**
  - **Runas y hechizos (redondos):** grilla de 32×32 y solo el centro (radio 0,5), porque el marco del juego no está en el catálogo.
  - **Objetos:** grilla de 24×24 sin el borde.
  - **Clave de runas:** el primer ícono de la columna solo se compara contra las runas clave.
- **Tolerancia a cajas imprecisas:**
  - Por caja: se prueban recortes corridos (±15%) y escalados.
  - Por grupo: como los slots de objetos y la columna de runas están alineados y equiespaciados, sus cajas se corrigen en conjunto (`regularizeLine`), aunque falte algún slot.
- **Repeticiones:** las runas se asignan sin repetir; los objetos sí pueden repetirse (por ejemplo, dos Espadas Largas).
- **Slots vacíos:** se detectan porque el recorte centrado es casi liso.
- **Confianza:** sale del parecido y de la diferencia con el segundo candidato. Lo que no es "alta" queda en el aviso de "revisá" del formulario.

**Calibración con capturas reales** (`test/fixtures/captures`, 6 capturas, 36 íconos con respuesta conocida). Las cajas tienen ruido aleatorio agregado para simular la imprecisión de Gemini:

| Ruido en las cajas | Aciertos |
|---|---|
| 0% | 36/36 |
| 15% | 36/36 |
| 25% | 33–35/36 |

El banco de pruebas que se usó (Chromium headless con `playwright-core`) no está en el repo. Para recalibrar, las piezas son `iconMatcher.js` (puro) e `iconIdentify.js` (canvas).

## Cuándo aparece

Solo si coincide `MOBILE_CAPTURE_QUERY` (`src/hooks/useMatchMedia.js`): `(pointer: coarse)` y (ancho ≤ 1023 px o alto ≤ 500 px). Se detecta por media queries y no por user agent. En escritorio no se renderiza nada y el chunk `CaptureMatchFlow` no se descarga. La carga manual sigue en el botón "A mano" de la misma barra, y también en el error.

## Puesta en marcha

1. **No hace falta ninguna key nueva.** La función usa las mismas `GEMINI_API_KEY`, `GEMINI_API_KEY_2` … `_5` que el Sugeridor, que ya están cargadas en Supabase. Si probás en otro proyecto, sacá una key gratis en [Google AI Studio](https://aistudio.google.com/apikey) y cargala con `npx supabase secrets set GEMINI_API_KEY=...`.
   Opcionales:
   ```bash
   npx supabase secrets set MATCH_CAPTURE_MODEL=gemini-3.5-flash-lite  # si no, usa GEMINI_MODEL
   npx supabase secrets set MATCH_CAPTURE_HOURLY_LIMIT=20
   ```
2. Deploy: `npx supabase functions deploy extract-match-capture`.

Las keys solo viven en la función. El cliente llama a la función con la sesión de Supabase.

**Plan gratuito de Gemini:** tiene límites de pedidos por minuto y por día (ver AI Studio). Cuando se agotan, la función devuelve `model_busy` y el usuario ve "probá en un rato". Además, en el plan gratuito Google puede usar lo que se envía para mejorar sus productos: las capturas tienen nombres de invocador, así que conviene mencionarlo en la política de privacidad.

## Detalles del backend

- **Validación de entrada:** 1 o 2 imágenes, tipos `image/jpeg|png|webp`, y el tipo declarado tiene que coincidir con los primeros bytes reales del archivo. Cada imagen decodificada puede pesar hasta 2.5 MB y el body completo hasta 12 MB. El usuario tiene que estar logueado.
- **Imágenes:** solo viven en memoria durante el request. No se escriben en Storage ni en la base, y tampoco se loguean.
- **Modelo:** usa `MATCH_CAPTURE_MODEL`, o si no `GEMINI_MODEL`, y por defecto `gemini-3.5-flash-lite`:
  - salida JSON con esquema (`responseFormat`);
  - el esquema no usa nulls: un dato faltante va con `confidence: "none"`;
  - `temperature: 0` y razonamiento bajo;
  - timeout de 45 s, con 1 reintento usando la siguiente key ante 429, 5xx o timeout.
- **Respuesta:** se valida contra el esquema (estructura, tipos y rangos) antes de llegar al cliente. Si no pasa, devuelve `model_invalid_output` y el cliente ofrece reintentar o cargar a mano.
- **Unificación:** el modelo devuelve una lectura por captura y el servidor las unifica. Por campo, gana el valor de mayor confianza. Si las capturas no coinciden, el campo queda marcado para revisión. Las capturas que el modelo marca como "no es pantalla de resultados" se ignoran, salvo que sean las únicas.
- **Errores:** todos vuelven como `{ error: "<código>" }` y la interfaz los traduce desde `matchCapture.errors.*`.

## Pendiente: requiere cambios en la base (no aplicados)

Esto necesita migraciones, así que no lo apliqué. Hay que revisarlo y aprobarlo antes.

### 1. Límite de uso durable

Hoy la función intenta llamar a la RPC `consume_match_capture_run`. Como todavía no existe, aplica el límite en la memoria del isolate: protege de ráfagas, pero se reinicia cuando Supabase recicla la instancia. Con esta migración el límite pasa a ser durable sin tocar código:

```sql
create table if not exists public.match_capture_runs (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists match_capture_runs_user_created_idx
  on public.match_capture_runs (user_id, created_at desc);
alter table public.match_capture_runs enable row level security; -- sin policies: solo service role

create or replace function public.consume_match_capture_run(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select count(*) into v_used
    from public.match_capture_runs
   where user_id = p_user_id and created_at > now() - interval '1 hour';
  if v_used >= p_limit then
    return false;
  end if;
  insert into public.match_capture_runs (user_id) values (p_user_id);
  delete from public.match_capture_runs where created_at < now() - interval '2 days';
  return true;
end;
$$;

revoke all on function public.consume_match_capture_run(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_match_capture_run(uuid, int) to service_role;
```

## Cómo probarlo en mobile

**Con devtools (Chrome):**
1. `npm run dev` y abrir `/matches` logueado.
2. DevTools → Toggle device toolbar → elegir un teléfono, por ejemplo Pixel 7. El modo dispositivo emula `pointer: coarse`. Si la barra no aparece, recargar con el modo dispositivo ya activo.
3. Tocar "Cargar con capturas" y elegir las 2 capturas de una partida (marcador y pestaña de runas).
4. Revisar en Network la llamada a `extract-match-capture`. El body tiene que ser JPEG en base64 de pocos cientos de KB por imagen.
5. Probar el borrador: con la confirmación abierta, recargar la página. La barra muestra "Continuar carga" y el formulario vuelve como estaba.
6. Probar los errores: en Network → Offline, intentar la carga. Tiene que aparecer el error con "Reintentar" y "Cargar a mano".
7. En escritorio (sin modo dispositivo) no tiene que aparecer la barra, y en Network no tiene que descargarse `CaptureMatchFlow-*.js`.

**En un teléfono real:** `npm run dev -- --host` y abrir `http://<ip-de-la-pc>:5173` desde el celular, en la misma red. iOS ofrece "Fototeca / Tomar foto / Elegir archivo" y convierte HEIC a JPEG al elegir.

**Función local:** `npx supabase functions serve extract-match-capture --env-file supabase/.env.local` con `GEMINI_API_KEY` en ese archivo.

## Opcional: share target (solo Android)

Se evaluó pero no se implementó. `share_target` en `manifest.json` permitiría recibir capturas desde el menú "Compartir" de Android. Necesita:
- que la PWA esté instalada;
- un `share_target` con `method: "POST"` y `enctype: "multipart/form-data"`;
- un service worker que intercepte ese POST y le pase los archivos a la app.

Hoy la app no tiene service worker, así que sumarlo implica agregar uno y probar el cacheo. iOS/Safari no soporta `share_target`, y ahí el flujo queda solo con el botón.

## Qué quedó pendiente / limitaciones

- La migración de arriba (límite de uso durable).
- La edge function no se ejecutó localmente, porque no hay Deno ni Supabase CLI en esta máquina. Antes del deploy conviene un `deno check` y una prueba con capturas reales.
- La precisión del modelo con distintos idiomas y layouts de la pantalla de resultados de Wild Rift hay que medirla con capturas reales. El prompt está en `SYSTEM_PROMPT` dentro de la función.
- Objetos, runas y hechizos se reconocen por el ícono: es lo que más puede fallar. En la confirmación se pueden quitar los que estén mal; para sumar los que falten hay que editar la partida después de guardarla.
- Las líneas de aliados y enemigos se deducen de la captura cuando se puede. Si no, se reparten en las líneas libres, y conviene revisarlas al editar la partida.
