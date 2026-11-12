import { supabase } from '@/lib/supabaseClient';

/** Error con el código que devuelve extract-match-capture (o 'network_error'). */
export class MatchCaptureError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * Manda las capturas reducidas a la edge function y devuelve los campos unificados.
 * @param {Array<{ media_type: string, data: string }>} images
 * @param {Array<{ media_type: string, data: string }>} references
 *   Láminas de referencia (íconos del catálogo numerados con su código) para que el
 *   modelo identifique visualmente campeones, objetos, runas y hechizos.
 * @returns {Promise<{ fields: Record<string, any>, ignored_images: number[] }>}
 */
export async function extractMatchFromCaptures(images, references = []) {
  const toPayload = list => list.map(({ media_type, data: base64 }) => ({ media_type, data: base64 }));
  const { data, error } = await supabase.functions.invoke('extract-match-capture', {
    body: { images: toPayload(images), references: toPayload(references) },
  });

  if (error) {
    let code = 'network_error';
    try {
      code = (await error.context?.json())?.error || code;
    } catch {
      // Sin cuerpo JSON (corte de red, timeout del gateway): queda network_error.
    }
    throw new MatchCaptureError(code);
  }
  if (!data?.ok || !data.fields) throw new MatchCaptureError('model_invalid_output');
  return data;
}
