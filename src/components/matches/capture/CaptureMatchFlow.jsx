// Carga de partida con capturas (solo mobile; se carga con lazy desde Matches).
// Es un paso a pantalla completa (no un modal): ocupa la página en lugar del formulario
// de "Nueva partida", con el título arriba, el contenido al medio y las acciones abajo.
// Primero muestra las capturas elegidas para revisarlas (quitar, agregar, ver en grande)
// y recién al confirmar las analiza. Reduce las capturas y las manda a extract-match-capture, que lee el texto (K/D/A, oro,
// duración, resultado, modo, nombres de runas). En paralelo, el marcador se resuelve en
// el celular sin IA (scoreboardLayout + comparación de píxeles): los 10 campeones con su
// línea, los hechizos y los objetos del jugador. Con todo eso arma la precarga del
// formulario manual (MatchBuilder). Si el modelo falla pero el marcador se reconoció,
// sigue igual con lo que se pudo leer.
// Este sheet solo muestra el progreso y los errores: la revisión y el guardado se
// hacen en el mismo formulario que la carga manual.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, ImagePlus, Loader2, PencilLine, RotateCcw, ScanSearch, Trash2 } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';
import { getGamePatchCatalog } from '@/api/gameCatalogSupabase';
import { Spell } from '@/api/entitiesSupabase';
import { extractMatchFromCaptures, MatchCaptureError } from '@/api/matchCaptureSupabase';
import { downscaleCapture, resizeCapture } from '@/features/matchCapture/imageResize';
import { fieldsToPrefill } from '@/features/matchCapture/captureFields';
import { buildCodeMaps } from '@/features/matchCapture/referenceCodes';
import { getReferenceSheets } from '@/features/matchCapture/referenceSheets';
import { identifyRunesIn, identifyScoreboardIn, loadIconCandidates, runesFromModelNames } from '@/features/matchCapture/iconIdentify';
import { clearDraft, loadDraftImages, loadDraftState, saveDraftImages, saveDraftState } from '@/features/matchCapture/captureDraft';

// Alcanza con 2: el marcador y la pestaña Estadísticas › Runa.
export const MAX_CAPTURE_FILES = 2;
// Para leer texto alcanza con 1280 px: el pedido al modelo es más liviano y rápido.
const MODEL_MAX_SIDE = 1280;

const RETRYABLE = new Set(['network_error', 'model_timeout', 'model_unavailable', 'model_busy', 'model_invalid_output', 'internal_error', 'catalog_unavailable']);
// Códigos con mensaje propio en matchCapture.errors.*; el resto cae en internal_error.
const KNOWN_ERRORS = new Set([...RETRYABLE, 'invalid_image', 'image_too_large', 'too_many_images', 'rate_limited', 'model_refused', 'model_error', 'unauthorized', 'not_configured']);

/**
 * Guía de carga compacta: qué 2 capturas sacar, cómo llegar a cada pantalla y cómo
 * deben ser. Pensada para entrar sin scroll en el celular (3 columnas acostado).
 */
function CaptureGuide() {
  const t = useT();
  const cards = [
    { key: 'step1', ordered: true },
    { key: 'step2', ordered: true },
    { key: 'requirements', ordered: false },
  ];
  return (
    <div className="rd-capture-guide space-y-2">
      <div className="rd-capture-guide-cards grid gap-2">
        {cards.map(({ key, ordered }) => {
          const List = ordered ? 'ol' : 'ul';
          return (
            <section key={key} className={`rounded-lg border p-2.5 ${ordered ? 'border-primary/25 bg-primary/5' : 'border-border bg-secondary/20'}`}>
              <h3 className="mb-1 text-sm font-semibold leading-tight text-foreground">
                {ordered && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{t(`matchCapture.guide.${key}.label`)}</span>}
                {t(`matchCapture.guide.${key}.title`)}
              </h3>
              <List className={`space-y-0.5 pl-4 text-xs leading-snug text-muted-foreground ${ordered ? 'list-decimal' : 'list-disc'}`}>
                {['a', 'b', 'c'].map(item => <li key={item}>{t(`matchCapture.guide.${key}.${item}`)}</li>)}
              </List>
            </section>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground/90">{t('matchCapture.guide.result')}</p>
    </div>
  );
}

/**
 * @param {{
 *   userId: string,
 *   files: File[] | null,          // [] = carga nueva (revisión vacía con la guía);
 *                                  // con archivos = capturas recién elegidas; null = retomar borrador
 *   champions: any[],              // respaldo si no carga el catálogo del parche
 *   defaultPatch: string,
 *   onExtracted: (prefill: object) => void,
 *   onManual: () => void,
 *   onClose: () => void,
 * }} props
 */
export default function CaptureMatchFlow({ userId, files, champions: fallbackChampions, defaultPatch, onExtracted, onManual, onClose }) {
  const t = useT();
  const queryClient = useQueryClient();
  // preparing | review | references | uploading | icons | error
  const [stage, setStage] = useState('preparing');
  const [images, setImages] = useState([]);
  const [errorCode, setErrorCode] = useState('');
  const [preview, setPreview] = useState(null);
  // Resultado del análisis: se muestra en este paso (qué se completó, qué revisar y,
  // si falló la lectura de texto, por qué) antes de pasar al formulario.
  const [result, setResult] = useState(null);
  const runRef = useRef(0);
  const addInputRef = useRef(null);

  // Catálogo del parche (mismo caché que el formulario manual) y hechizos.
  const loadCatalog = useCallback(async () => {
    const [catalog, spells] = await Promise.all([
      defaultPatch
        ? queryClient.fetchQuery({ queryKey: ['game-patch-catalog', defaultPatch], queryFn: () => getGamePatchCatalog(defaultPatch) }).catch(() => null)
        : null,
      queryClient.fetchQuery({ queryKey: ['spells'], queryFn: () => Spell.list('name') }).catch(() => []),
    ]);
    return {
      champions: catalog?.champions?.length ? catalog.champions : fallbackChampions,
      items: catalog?.items || [],
      runes: catalog?.runes || [],
      spells: spells || [],
    };
  }, [defaultPatch, fallbackChampions, queryClient]);

  const fail = useCallback((code) => {
    const known = KNOWN_ERRORS.has(code) ? code : 'internal_error';
    setErrorCode(known);
    setStage('error');
    saveDraftState(userId, { stage: 'error', errorCode: known });
  }, [userId]);

  const extract = useCallback(async (captures) => {
    const run = ++runRef.current;
    setErrorCode('');
    saveDraftState(userId, { stage: 'uploading' });
    try {
      setStage('references');
      const catalog = await loadCatalog();
      if (!catalog.champions.length) throw new MatchCaptureError('catalog_unavailable');

      // 1) Lo que se resuelve en el celular, sin IA: marcador (campeones, líneas,
      //    objetos, hechizos, K/D/A, oro, resultado) y columna de runas.
      setStage('icons');
      const candidates = await loadIconCandidates(catalog);
      const scoreboard = await identifyScoreboardIn(captures, candidates);
      const localRunes = await identifyRunesIn(captures, candidates);
      if (run !== runRef.current) return;

      // 2) El modelo, solo para lo que falta (duración, tipo de partida, nombres de
      //    runas y, si no se reconoció el marcador, todo lo demás). Pedido liviano:
      //    capturas reducidas y la lámina de campeones solo si hace falta.
      setStage('uploading');
      let data = null;
      let modelError = null;
      try {
        const references = scoreboard ? [] : await getReferenceSheets(catalog);
        const light = await Promise.all(captures.map(capture => downscaleCapture(capture, MODEL_MAX_SIDE)));
        data = await extractMatchFromCaptures(light, references);
      } catch (error) {
        modelError = error;
      }
      if (run !== runRef.current) return;
      if (modelError && !scoreboard && !localRunes) throw modelError;
      if (modelError) console.warn('Lectura de texto de las capturas falló:', modelError.code || modelError);
      // Runas: el nombre leído por el modelo manda; si no, la columna de runas comparada
      // en el celular.
      const icons = { runes: (data && runesFromModelNames(data.rune_names, candidates)) || localRunes || [] };
      if (run !== runRef.current) return;

      const prefill = {
        ...fieldsToPrefill(data?.fields || {}, buildCodeMaps(catalog), { defaultPatch, icons, scoreboard }),
        // Si el modelo falló, el resultado lo avisa (lo que falte se completa a mano).
        textError: modelError ? (KNOWN_ERRORS.has(modelError.code) ? modelError.code : 'internal_error') : null,
      };
      saveDraftState(userId, { stage: 'ready', prefill });
      setResult(prefill);
      setStage('done');
    } catch (error) {
      if (run !== runRef.current) return;
      fail(error instanceof MatchCaptureError ? error.code : 'internal_error');
    }
  }, [defaultPatch, fail, loadCatalog, onExtracted, userId]);

  // Reduce y suma capturas a la selección (hasta MAX_CAPTURE_FILES). No analiza: eso espera a que el
  // usuario confirme en la revisión.
  const addFiles = useCallback(async (fileList, current) => {
    setStage('preparing');
    try {
      const resized = [];
      for (const file of fileList.slice(0, Math.max(0, MAX_CAPTURE_FILES - current.length))) {
        resized.push(await resizeCapture(file));
      }
      const next = [...current, ...resized];
      setImages(next);
      await saveDraftImages(userId, next);
      saveDraftState(userId, { stage: 'review' });
      setStage('review');
    } catch {
      setImages(current);
      fail('invalid_image');
    }
  }, [fail, userId]);

  // Arranque: capturas nuevas (a revisión) o borrador guardado. Solo al montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (files) {
        // Carga nueva: arranca en la revisión (vacía, con la guía) o con las capturas
        // recién elegidas. El borrador se guarda recién cuando hay capturas.
        await clearDraft(userId);
        if (cancelled) return;
        if (files.length) addFiles(files, []);
        else setStage('review');
        return;
      }
      const draft = loadDraftState(userId);
      const draftImages = await loadDraftImages(userId);
      if (cancelled) return;
      setImages(draftImages);
      if (draft?.stage === 'ready' && draft.prefill) {
        setResult(draft.prefill);
        setStage('done');
      } else if (draft?.stage === 'uploading' && draftImages.length) {
        // Se cortó mientras analizaba: se vuelve a analizar con las mismas capturas.
        extract(draftImages);
      } else if (draft?.stage === 'error' && draftImages.length) {
        setErrorCode(KNOWN_ERRORS.has(draft.errorCode) ? draft.errorCode : 'internal_error');
        setStage('error');
      } else if (draftImages.length || draft?.stage === 'review') {
        // Estaba revisando: vuelve a la revisión con las capturas elegidas.
        setStage('review');
      } else {
        fail(draft?.errorCode || 'internal_error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCancel = async () => {
    runRef.current += 1;
    await clearDraft(userId);
    onClose();
  };

  const handleManual = async () => {
    runRef.current += 1;
    await clearDraft(userId);
    onManual();
  };

  const handleRemove = async (index) => {
    const next = images.filter((_, position) => position !== index);
    setImages(next);
    await saveDraftImages(userId, next);
  };

  const handleAddFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (picked.length) addFiles(picked, images);
  };

  // Volver a la revisión (desde un error) sin perder las capturas elegidas.
  const backToReview = () => {
    runRef.current += 1;
    setErrorCode('');
    setStage('review');
    saveDraftState(userId, { stage: 'review' });
  };

  const analyzing = ['references', 'uploading', 'icons'].includes(stage);
  const statusText = {
    preparing: t('matchCapture.status.preparing'),
    references: t('matchCapture.status.references'),
    uploading: t('matchCapture.status.processing'),
    icons: t('matchCapture.status.icons'),
  }[stage];
  const secondaryButton = 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 font-medium text-foreground';
  const primaryButton = 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50';

  return (
    <section className="rd-capture-step flex min-h-0 flex-1 flex-col" aria-label={t('matchCapture.title')}>
      <div className="rd-capture-step-inner flex min-h-0 flex-1 flex-col">
        <h1 className="rd-capture-step-title mb-3 font-rajdhani text-2xl font-bold text-foreground">
          {stage === 'done' ? t('matchCapture.review.doneTitle') : stage === 'review' ? t(images.length ? 'matchCapture.review.title' : 'matchCapture.title') : t('matchCapture.title')}
        </h1>

        <div className="rd-capture-step-body min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
          {stage === 'review' && (
            <div className="rd-capture-review space-y-2">
              <p className="text-xs text-muted-foreground">
                {t('matchCapture.review.hint')} · {t('matchCapture.review.count', { count: images.length, max: MAX_CAPTURE_FILES })}
              </p>
              {/* Alto de los recuadros atado al alto de la pantalla para que todo entre. */}
              <div className="flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <div key={`${index}-${image.previewUrl.length}`} className="relative overflow-hidden rounded-lg border border-border bg-secondary/30">
                    <button type="button" onClick={() => setPreview(image.previewUrl)} className="block" aria-label={t('matchCapture.actions.viewCapture', { n: index + 1 })}>
                      <img src={image.previewUrl} alt={t('matchCapture.captureAlt', { n: index + 1 })} className="rd-capture-thumb aspect-video w-auto object-cover" />
                    </button>
                    <button type="button" onClick={() => handleRemove(index)} aria-label={t('matchCapture.actions.removeCapture', { n: index + 1 })}
                      className="absolute right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {images.length < MAX_CAPTURE_FILES && (
                  <button type="button" onClick={() => addInputRef.current?.click()}
                    className="rd-capture-thumb flex aspect-video flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-1 text-center text-xs font-medium leading-tight text-primary">
                    <ImagePlus size={18} /> {t('matchCapture.actions.addCapture')}
                  </button>
                )}
              </div>
              <CaptureGuide />
            </div>
          )}

          {(analyzing || stage === 'preparing') && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" aria-live="polite">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="font-medium text-foreground">{statusText}</p>
              {analyzing && <p className="max-w-xs text-sm text-muted-foreground">{t('matchCapture.status.processingHint')}</p>}
            </div>
          )}

          {stage === 'done' && result && (
            <div className="space-y-3" role="status">
              <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-sm text-foreground/90">{t('matchCapture.prefill.notice')}</p>
              </div>
              {result.review?.length > 0 && (
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-sm text-amber-200">
                  {t('matchCapture.prefill.review', { fields: result.review.map(key => t(`matchCapture.fields.${key}`)).join(', ') })}
                </p>
              )}
              {result.textError && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-300">
                  {t('matchCapture.prefill.textFailed', { reason: t(`matchCapture.errors.${result.textError}`) })}
                </p>
              )}
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
              <AlertTriangle size={32} className="text-red-400" />
              <p className="font-medium text-foreground">{t(`matchCapture.errors.${errorCode || 'internal_error'}`)}</p>
              <p className="max-w-xs text-sm text-muted-foreground">{t('matchCapture.errors.manualHint')}</p>
            </div>
          )}
        </div>

        {/* Acciones: siempre abajo, al alcance del pulgar. */}
        <div className="rd-capture-step-actions flex flex-col gap-2 border-t border-border pt-3">
          {stage === 'review' && (
            <div className="flex gap-2">
              <button type="button" onClick={handleCancel} className={secondaryButton}>
                {t('common.cancel')}
              </button>
              {images.length ? (
                <button type="button" onClick={() => extract(images)} className={primaryButton}>
                  <ScanSearch size={18} /> {t('matchCapture.actions.analyze')}
                </button>
              ) : (
                <button type="button" onClick={() => addInputRef.current?.click()} className={primaryButton}>
                  <ImagePlus size={18} /> {t('matchCapture.actions.chooseCaptures')}
                </button>
              )}
            </div>
          )}
          {stage === 'done' && result && (
            <div className="flex gap-2">
              <button type="button" onClick={handleCancel} className={secondaryButton}>
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => onExtracted(result)} className={primaryButton}>
                {t('matchCapture.actions.continueToForm')} <ArrowRight size={18} />
              </button>
            </div>
          )}
          {stage === 'error' && (
            <>
              {RETRYABLE.has(errorCode) && images.length > 0 && (
                <button type="button" onClick={() => extract(images)} className={primaryButton}>
                  <RotateCcw size={18} /> {t('matchCapture.actions.retry')}
                </button>
              )}
              <div className="flex gap-2">
                {images.length > 0 && (
                  <button type="button" onClick={backToReview} className={secondaryButton}>
                    <ImagePlus size={18} /> {t('matchCapture.actions.changeCaptures')}
                  </button>
                )}
                <button type="button" onClick={handleManual} className={secondaryButton}>
                  <PencilLine size={18} /> {t('matchCapture.actions.manual')}
                </button>
              </div>
              <button type="button" onClick={handleCancel} className={secondaryButton}>
                {t('common.cancel')}
              </button>
            </>
          )}
          {(analyzing || stage === 'preparing') && (
            <button type="button" onClick={handleCancel} className={secondaryButton}>
              {t('common.cancel')}
            </button>
          )}
        </div>
        <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddFiles} />
      </div>

      {preview && (
        <button type="button" onClick={() => setPreview(null)} className="fixed inset-0 z-[410] flex items-center justify-center bg-black/90 p-4" aria-label={t('matchCapture.actions.closePreview')}>
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </button>
      )}
    </section>
  );
}
