import { supabase } from '@/lib/supabaseClient';
import { createV2BuildJsonSchema } from './v2Schema';
import { tr } from '../../i18n/uiI18n.js';

const isTemporaryProviderFailure = data => {
  const detail = `${data?.error || ''} ${data?.details || ''}`;
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|high demand/i.test(detail);
};

export async function requestV2Build(prompt, snapshot, context = {}) {
  const body = {
    prompt,
    response_json_schema: createV2BuildJsonSchema(snapshot, context),
    provider_attempt: context.attempt || 1,
    request_id: context.requestId,
    // Qué se pidió, para el registro de ejecuciones (suggester_runs).
    run_context: context.runContext,
  };
  const { data, error } = await supabase.functions.invoke('suggest-build-v2', { body });
  const temporaryFailure = Boolean(error) || (!data?.ok && isTemporaryProviderFailure(data));

  if (error) {
    throw Object.assign(
      new Error(tr('buildV2.providerUnreachable')),
      { kind: 'provider_error', retryable: true, details: error.message },
    );
  }
  if (data?.kind === 'usage_limit') {
    throw Object.assign(new Error(data.error), { kind: 'usage_limit', retryable: false });
  }
  if (!data?.ok) {
    const malformed = data?.kind === 'malformed_response';
    const message = temporaryFailure
      ? tr('buildV2.providerBusy')
      : data?.error || tr('buildV2.providerInvalid');
    throw Object.assign(new Error(message), {
      kind: data?.kind || 'provider_error',
      raw: data?.raw,
      details: data?.details,
      retryable: temporaryFailure || malformed,
    });
  }
  return data;
}

/**
 * Cierra la ejecución en suggester_runs con el resultado final: la IA pudo responder bien y
 * la build no pasar la validación local. Nunca rompe la pantalla si falla.
 */
export async function finishV2BuildRun(requestId, status, errorKind = null) {
  if (!requestId) return;
  try {
    const { error } = await supabase.rpc('finish_suggester_run', {
      p_feature: 'build', p_request_id: requestId, p_status: status, p_error_kind: errorKind,
    });
    if (error && import.meta.env.DEV) console.debug('[Build IA V2] finish_suggester_run', error);
  } catch (cause) {
    if (import.meta.env.DEV) console.debug('[Build IA V2] finish_suggester_run', cause);
  }
}
