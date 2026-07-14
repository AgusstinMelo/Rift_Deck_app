# Rift Deck — Roadmap de mejoras

## Visión

Rift Deck es una plataforma de análisis de rendimiento personal para Wild Rift.
No busca reemplazar una API oficial, un historial automático ni una wiki del
juego. Su propuesta es transformar las partidas que cada usuario decide
registrar en información clara, trazable y útil para tomar mejores decisiones.

La aplicación funciona como un espejo de datos personalizado:

- muestra cómo está jugando el usuario según sus partidas registradas;
- detecta tendencias y asociaciones sin presentarlas como causalidades;
- conecta partidas, builds, runas, matchups y objetivos;
- convierte datos personales en acciones concretas;
- informa siempre la cantidad y calidad de evidencia disponible.

## Restricciones y principios del producto

### Restricciones conocidas

- Wild Rift no dispone de una API oficial pública que permita importar el
  historial completo del jugador.
- Cada usuario carga manualmente sus propias partidas.
- Rift Deck no puede asumir que las partidas registradas representan toda la
  actividad del usuario ni verdad de lo que se registra.
- El rango, las marcas, el LP y el historial externo pueden estar incompletos o
  desactualizados.
- Algunas variables importantes no son observables salvo que el usuario las
  registre expresamente.

### Principios

1. **Facilitar la captura antes de profundizar el análisis.**
   Un análisis sofisticado sobre datos incompletos produce conclusiones débiles.

2. **Describir antes de predecir.**
   La prioridad es explicar qué ocurrió en las partidas registradas.

3. **Asociación no significa causalidad.**
   Los insights deben hablar de señales, tendencias o asociaciones.

4. **Toda conclusión debe ser trazable.**
   El usuario debe poder abrir las partidas que sostienen una métrica o insight.

5. **La confianza depende de la muestra.**
   Cada análisis debe informar partidas consideradas, período y confiabilidad.

6. **Comparar al usuario consigo mismo.**
   Los datos autocargados no son apropiados para rankings competitivos justos.

7. **Recomendar acciones controlables.**
   Priorizar cambios de pool, build, runas, sesiones o hábitos de registro por
   sobre resultados que el usuario no controla directamente.

---

## FASE 0 — Confianza, captura y calidad de datos

**Objetivo:** lograr que registrar una partida sea rápido, consistente y
suficientemente completo para producir análisis útiles.

### Modelo de datos

- [ ] Incorporar `session_id` generado automáticamente.
- [ ] Vincular una partida con una build guardada mediante `build_id`.
- [ ] Guardar el orden de objetos únicamente cuando el usuario lo registre.
- [ ] Diferenciar:
  - datos objetivos: resultado, duración, KDA, campeón, composición;
  - datos subjetivos: estado de ánimo, causa percibida, calidad de ejecución.
- [ ] Permitir registrar opcionalmente:
  - energía;
  - concentración;
  - estado de ánimo;
  - solo queue o premade;
  - principal causa percibida de victoria o derrota.

### Calidad y control

- [ ] Mostrar qué análisis habilita cada campo adicional.
- [ ] Permitir corregir datos desde cualquier gráfico mediante drill-down.
- [ ] Implementar importación y exportación CSV/JSON.
- [ ] Permitir exportar todos los datos personales.
- [ ] Implementar borrado real y seguro de cuenta.

### Experiencia de continuidad



**Entregables:** sesiones automáticas, builds vinculadas,
calidad visible del dato y herramientas de portabilidad.

---

## FASE 1 — Core analytics descriptivo

**Objetivo:** mostrar con claridad qué ocurrió en las partidas registradas, sin
realizar predicciones fuertes.

### Dashboard orientado a decisiones

- [ ] Resumen de las últimas 10 y 20 partidas.
- [ ] Comparación contra el tramo anterior equivalente.
- [ ] Estado visual de tendencia: mejora, estable o descenso.
- [ ] Racha actual.
- [ ] Mejor campeón y línea con muestra suficiente.
- [ ] Principal señal positiva y principal punto de revisión.
- [ ] Acción principal visible: registrar partida.
- [ ] Accesos a las partidas que componen cada indicador.

### Filtros y períodos

- [ ] Últimas 10, 20, 50 y 100 partidas.
- [ ] Rango de fechas personalizado.
- [ ] Filtros por:
  - campeón;
  - línea;
  - parche;
  - tipo de cola;
  - resultado;
  - sesión;
  - build vinculada.
- [ ] Guardar filtros favoritos.
- [ ] Comparar dos períodos equivalentes.

### Evolución temporal

- [ ] Winrate móvil y acumulado.
- [ ] Partidas jugadas por semana y mes.
- [ ] Mejor período registrado, indicando siempre el volumen de partidas.
- [ ] Comparación:
  - semana actual vs. anterior;
  - mes actual vs. anterior;
  - últimas N vs. N anteriores.

### Rendimiento por campeón y línea

- [ ] Ranking personal de campeones.
- [ ] Partidas, winrate, KDA y tendencia reciente.
- [ ] Rendimiento por línea.
- [ ] Rendimiento por campeón + línea cuando exista muestra suficiente.
- [ ] Concentración del champion pool.
- [ ] Campeones frecuentes con rendimiento inferior al promedio personal.
- [ ] Campeones prometedores con muestra todavía limitada.

### Duración de partida

- [ ] Segmentos configurables:
  - menos de 15 minutos;
  - 15–20;
  - 20–25;
  - 25–30;
  - más de 30.
- [ ] Mostrar winrate y cantidad de partidas por segmento.
- [ ] Distribución de duraciones.
- [ ] Evitar recomendaciones como “jugá partidas más cortas”; usar mensajes
  como “tu rendimiento registrado disminuye cuando las partidas se extienden”.

### Rachas y sesiones

- [ ] Racha actual y máximas históricas registradas.
- [ ] Agrupar partidas cercanas en el tiempo como una sesión.
- [ ] Resultado por posición dentro de la sesión.
- [ ] Rendimiento según longitud de sesión.
- [ ] Comparar primeras partidas contra partidas posteriores.
- [ ] Identificar “sesión negativa” o “caída potencial de rendimiento”, sin
  diagnosticar tilt.

**Entregables:** Dashboard mejorado, Stats con filtros y evolución temporal,
análisis de sesiones y navegación hasta las partidas originales.

---

## FASE 2 — Insights con evidencia

**Objetivo:** detectar asociaciones útiles y comunicarlas con suficiente
contexto estadístico.

### Contrato común de los insights

Todo insight debe incluir:

- texto descriptivo;
- cantidad de partidas consideradas;
- período;
- promedio de referencia;
- diferencia observada;
- nivel de confianza;
- advertencia cuando la muestra sea pequeña;
- enlace a las partidas que lo sostienen;
- versión de la fórmula utilizada.

### Niveles de evidencia

- **Insuficiente:** no mostrar conclusión; indicar cuántas partidas faltan.
- **Señal inicial:** patrón visible con muestra pequeña.
- **Evidencia moderada:** patrón repetido y diferencia relevante.
- **Evidencia sólida:** muestra amplia, reciente y consistente.

Los umbrales deben adaptarse al tipo de análisis. Una métrica global necesita
menos partidas que una combinación campeón + matchup + build.

### Detección de cambios

- [ ] Comparar períodos equivalentes.
- [ ] Detectar cambios relevantes en lugar de usar siempre un umbral fijo de
  cinco puntos porcentuales.
- [ ] Considerar cantidad de partidas y variabilidad.
- [ ] Alertar sobre:
  - cambio reciente de winrate;
  - caída con un campeón frecuente;
  - mejora sostenida con una línea;
  - sesiones consecutivas negativas;
  - cambio de build o runas asociado a resultados diferentes.
- [ ] Permitir descartar o silenciar insights.

### Patrones personales

- [ ] Rendimiento reciente vs. histórico.
- [ ] Rendimiento por duración.
- [ ] Rendimiento por posición dentro de una sesión.
- [ ] Rendimiento por hora o día solo con muestra suficiente.
- [ ] Build vinculada vs. promedio del campeón.
- [ ] Runa clave o página de runas vs. promedio del campeón.
- [ ] Matchup directo cuando exista evidencia.
- [ ] Sinergias y composiciones únicamente en niveles de agregación útiles.

La redacción debe usar expresiones como:

> En tus partidas registradas aparece una asociación entre X e Y.

Y evitar:

> X provoca que pierdas.

### Análisis horario

- [ ] Heatmap hora × día con volumen y winrate.
- [ ] Ocultar o agrupar celdas con muestra insuficiente.
- [ ] Mostrar tooltip con cantidad de partidas.
- [ ] Tener en cuenta la zona horaria del usuario.
- [ ] Presentarlo como contexto observado, no como horario óptimo universal.

### Anomalías

- [ ] Detectar desviaciones respecto del comportamiento personal habitual.
- [ ] Separar anomalías de datos de anomalías de rendimiento.
- [ ] Evitar alertas ante muestras de una o dos partidas.
- [ ] Mostrar posibles explicaciones como preguntas, no como afirmaciones.

Ejemplo:

> Tus últimas 8 partidas con este campeón están por debajo de tu promedio
> histórico. ¿Cambiaste de build, rol o estilo de juego?

### Reportes

- [ ] Reporte semanal in-app.
- [ ] Reporte mensual in-app.
- [ ] Resumen de:
  - actividad;
  - tendencia;
  - campeones;
  - sesiones;
  - builds;
  - insights destacados.

**Entregables:** insights explicables, niveles de confianza, alertas
contextualizadas y reportes trazables.

---

## FASE 3 — Builds, matchups y recomendaciones

**Objetivo:** conectar el rendimiento registrado con decisiones que el usuario
puede controlar.

### Rendimiento de builds

- [ ] Opcion de seleccionar una build guardada al registrar o editar una partida.
- [ ] Mostrar por build:
  - partidas;
  - frecuencia;
  - winrate;
  - rendimiento reciente;
  - promedio del campeón como referencia.
- [ ] Mostrar las partidas asociadas.
- [ ] Comparar variantes de una misma build.
- [ ] Analizar núcleo de dos o tres objetos antes que builds exactas de seis
  objetos.
- [ ] Analizar orden de compra solo cuando se registre de forma consistente.
- [ ] Versionar builds por parche.

### Alcance de los análisis combinados

Aplicar una progresión por disponibilidad de datos:

1. campeón;
2. campeón + línea;
3. campeón + build o runas;
4. campeón + matchup;
5. campeón + matchup + build, únicamente con evidencia suficiente.

- [ ] Indicar “faltan N partidas para analizar esta combinación”.
- [ ] Agrupar objetos por núcleo o intención cuando una build exacta fragmente
  demasiado la muestra.
- [ ] Evitar conclusiones sobre power spikes si no se registró el minuto de
  compra.
- [ ] Comparar coste teórico de builds sin afirmar impacto causal en el winrate.

### Matchups personales

- [ ] Mejores y peores matchups registrados.
- [ ] Separar rival directo de composición enemiga.
- [ ] Matriz campeón propio × rival solo cuando haya densidad suficiente.
- [ ] Ocultar o neutralizar celdas con muestras pequeñas.
- [ ] Recomendar revisar un matchup, no banear automáticamente un campeón.

### Sugeridor personal

- [ ] Explicar por qué se recomienda cada campeón.
- [ ] Mostrar evidencia usada:
  - rendimiento personal;
  - línea;
  - pool;
  - tierlist externa;
  - objetivo elegido.
- [ ] Diferenciar datos personales de datos de meta.
- [ ] Mostrar confianza y limitaciones.
- [ ] Proponer acciones:
  - priorizar o practicar un pick;
  - revisar un matchup;
  - probar una variante de build;
  - reducir temporalmente el pool;
  - cortar o limitar una sesión.
- [ ] Incorporar feedback “me sirvió / no me sirvió”.
- [ ] Guardar historial de recomendaciones.

### Tierlist y datos externos

- [ ] Separar claramente tierlist global de rendimiento personal.
- [ ] Comparar cambios entre parches.
- [ ] Crear una vista “meta relevante para mi pool”.
- [ ] Alertar cuando un campeón del pool cambie significativamente de tier.

**Entregables:** builds medibles, matchups personales prudentes y sugerencias
explicables basadas en datos personales + contexto de meta.

---

## FASE 4 — Objetivos y progreso

**Objetivo:** ayudar al usuario a sostener hábitos y mejorar variables
observables.

### Objetivos recomendados

- [ ] Registrar N partidas durante un período.
- [ ] Jugar un porcentaje definido con el pool principal.
- [ ] Reducir promedio de muertes.
- [ ] Probar una build en N partidas.
- [ ] Completar N sesiones con longitud máxima.
- [ ] Alcanzar un winrate registrado objetivo, con advertencia de que no
  equivale al rango real.

### Seguimiento

- [ ] Múltiples objetivos simultáneos.
- [ ] Progreso y milestones.
- [ ] Partidas vinculadas con cada objetivo.
- [ ] Recomendaciones de próximos pasos.
- [ ] Celebraciones discretas al alcanzar hitos.

### Simuladores matemáticos

- [ ] Calcular victorias netas necesarias para alcanzar un winrate registrado.
- [ ] Simular escenarios 5–5, 6–4, 7–3, etc.
- [ ] Evitar presentar una fecha estimada como predicción fiable.
- [ ] No proyectar rango o marcas sin datos introducidos y mantenidos por el
  usuario.

**Entregables:** objetivos controlables, progreso verificable y simuladores
transparentes.

---

## FASE 5 — Comunidad y contenido compartible

**Objetivo:** sumar valor social sin convertir datos autocargados en rankings de
habilidad.

### Funciones permitidas

- [ ] Compartir builds mediante enlace o imagen.
- [ ] Compartir reportes personales de forma opcional.
- [ ] Perfil público configurable.
- [ ] Colecciones públicas de builds.
- [ ] Favoritos y clonación de builds.

### Funciones pospuestas

- [ ] Leaderboards de winrate o consistencia.
- [ ] Rankings de habilidad.
- [ ] Comparación directa de rendimiento entre usuarios.

Estas funciones requieren datos comparables, completos y verificables. Las
partidas autocargadas pueden estar seleccionadas, incompletas o usar criterios
distintos.

---

## Métricas y conceptos específicos

### Champion pool

- [ ] Concentración del pool mediante porcentaje de uso de top 1, top 3 y top 5.
- [ ] Diversidad por línea.
- [ ] Especialización descriptiva, sin etiquetar automáticamente como buena o
  mala.
- [ ] Tendencia por campeón con comparación de períodos equivalentes.
- [ ] Señalar campeones sobreutilizados con rendimiento bajo.
- [ ] Evitar afirmar que reemplazar un campeón elevará el winrate a un valor
  exacto; mostrarlo como simulación.

### Consistencia

El consistency score puede existir como métrica personal experimental:

- [ ] Definir públicamente la fórmula.
- [ ] Combinar variabilidad entre sesiones, estabilidad reciente y tamaño de
  muestra.
- [ ] Versionar cambios en la fórmula.
- [ ] Mostrar componentes del score.
- [ ] Comparar solamente contra el historial propio.
- [ ] No utilizar una distribución normal si los datos no la justifican.

### Arquetipos y playstyle

Mantenerlos como resúmenes descriptivos y revisables:

- [ ] Pool concentrado o diverso.
- [ ] Preferencia por determinadas líneas.
- [ ] Rendimiento temprano o tardío según duración.
- [ ] Variabilidad alta o baja entre sesiones.
- [ ] Preferencia de builds según categorías.
- [ ] Permitir que el usuario confirme o rechace la interpretación.

No inferir sin datos:

- presión psicológica;
- calidad de decisiones;
- agresividad real;
- velocidad de reacción;
- nivel de habilidad;
- causas internas de una derrota.

---

## UX/UI

### Trazabilidad e interacción

- [ ] Click en una métrica para abrir sus partidas.
- [ ] Permitir navegar de partida → build → campeón → insight.
- [ ] Comparador de períodos.
- [ ] Guardar vistas y filtros.

### Visualizaciones

- [ ] Series temporales para evolución.
- [ ] Barras con volumen y winrate.
- [ ] Heatmaps solo cuando exista densidad.
- [ ] Distribuciones de duración, KDA y otras métricas continuas.
- [ ] Evitar scatter plots de resultado binario sin una representación útil.
- [ ] Mostrar intervalos o bandas de confianza cuando corresponda.

### Estados y accesibilidad

- [ ] No depender exclusivamente de verde y rojo.
- [ ] Light/Dark mode OLED como mejora posterior.
- [ ] Lazy loading para módulos pesados.

---

## Arquitectura técnica

### Prioridad inmediata

- [ ] Corregir lint y typecheck.
- [ ] Agregar tests unitarios para cálculos estadísticos.
- [ ] Agregar tests de integración para partidas, builds y membresías.
- [ ] Documentar el esquema de datos.
- [ ] Versionar migraciones.
- [ ] Aplicar RLS estricta por `user_id`.
- [ ] Revisar autorización de updates y deletes.
- [ ] Implementar borrado de cuenta.
- [ ] Normalizar fechas y zonas horarias.
- [ ] Corregir problemas de codificación de textos.
- [ ] Reducir duplicación entre formularios de partidas.

### Base de datos

- [ ] Índices en:
  - `user_id`;
  - `date`;
  - `champion_id` o nombre normalizado;
  - `session_id`;
  - `build_id`;
  - combinaciones realmente usadas por las consultas.
- [ ] Mantener datos crudos como fuente de verdad.
- [ ] Agregados por usuario solo cuando las mediciones de rendimiento lo
  justifiquen.
- [ ] Evitar particionamiento temporal prematuro.

### Estadística

- [ ] Definir muestras mínimas por tipo de análisis.
- [ ] Usar intervalos para proporciones cuando sea útil.
- [ ] Comparar períodos equivalentes.
- [ ] Corregir por volumen antes de generar alertas.
- [ ] Evitar correlaciones sobre variables con pocos casos.
- [ ] Usar métodos robustos antes que polynomial fit o modelos complejos.
- [ ] Crear fixtures y datasets sintéticos para probar cada fórmula.

### Caché y procesamiento

Inicialmente:

- [ ] React Query para caché de cliente.
- [ ] Invalidación al crear, editar o eliminar una partida.
- [ ] Cálculo local para estadísticas de volumen moderado.
- [ ] Funciones de Supabase para operaciones sensibles o agregados necesarios.

Posponer hasta que existan métricas de escala que lo justifiquen:

- Redis;
- particionamiento por mes;
- materialized views generalizadas;
- queue system completo;
- pirámides de rollups;
- seasonal decomposition;
- predicciones polinómicas;
- leaderboards recalculados diariamente.

### Pagos y seguridad

- [ ] Gestión de estado, renovación, vencimiento y cancelación.
- [ ] Evitar mostrar errores internos o payloads sensibles al usuario.

---

## Priorización resumida

### Fase 0 — Captura y confianza

Sesiones, builds vinculadas, calidad de datos, exportación,
borrado y estabilización técnica.

### Fase 1 — Análisis descriptivo

Filtros, evolución temporal, campeón, línea, duración, rachas, sesiones y
drill-down.

### Fase 2 — Insights explicables

Muestras mínimas, niveles de confianza, anomalías prudentes, alertas y reportes.

### Fase 3 — Decisiones controlables

Builds, runas, matchups, tierlist contextual y sugerencias con evidencia.

### Fase 4 — Objetivos

Metas controlables, milestones y simuladores matemáticos transparentes.

### Fase 5 — Comunidad opcional

Compartir builds, reportes y perfiles sin rankings de habilidad basados en datos
autocargados.

---

## Checklist de implementación

### Preparación

- [ ] Documentar campos actuales y nuevos.
- [ ] Definir las métricas y muestras mínimas.
- [ ] Diseñar migraciones.
- [ ] Establecer eventos de analytics de producto.
- [ ] Definir criterios de éxito por fase.

### Desarrollo incremental

- [ ] Implementar verticalmente: captura → cálculo → UI → drill-down.
- [ ] Agregar tests antes de publicar cada fórmula.
- [ ] Revisar lenguaje de insights para evitar causalidad injustificada.
- [ ] Probar con usuarios que cargan pocas, medianas y muchas partidas.

### QA

- [ ] Múltiples navegadores.
- [ ] Mobile, tablet y desktop.
- [ ] Accesibilidad WCAG AA.
- [ ] Datos incompletos, duplicados y extremos.
- [ ] Diferentes zonas horarias.
- [ ] Lighthouse como guía, no como único criterio.

### Deployment

- [ ] Staging.
- [ ] Migraciones reversibles.
- [ ] Monitoreo de errores.
- [ ] Rollback.
- [ ] Métricas de adopción y calidad de registro.

---

## Métricas de éxito del producto

- Tiempo medio para registrar una partida.
- Porcentaje de formularios completados.
- Partidas registradas por usuario activo.
- Porcentaje de partidas vinculadas a una build.
- Usuarios que regresan para consultar Stats.
- Insights abiertos mediante drill-down.
- Recomendaciones calificadas como útiles.
- Objetivos creados y completados.
- Tasa de errores y registros duplicados.
- Retención semanal y mensual.

---

## Visión final

Rift Deck será el dashboard personal de rendimiento para Wild Rift que mejor
aprovecha datos ingresados voluntariamente:

- muestra exactamente qué datos está usando;
- ayuda a registrar partidas sin fricción;
- detecta patrones sin vender falsas certezas;
- conecta cada conclusión con evidencia;
- recomienda acciones que el usuario puede controlar;
- combina rendimiento personal con contexto externo claramente identificado.

El diferenciador no es disponer de más datos que otras plataformas. Es obtener
valor honesto, comprensible y accionable de los datos que cada usuario decide
registrar.

---

**Actualizado:** 30/06/2026  
**Owner:** Agustín Melo  
**Estado:** Roadmap activo
