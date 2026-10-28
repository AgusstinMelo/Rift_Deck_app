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
  };
  const { data, error } = await supabase.functions.invoke('suggest-build-v2', { body });
  const temporaryFailure = Boolean(error) || (!data?.ok && isTemporaryProviderFailure(data));

  if (error) {
    throw Object.assign(
      new Error('No se pudo conectar con el generador de builds. Probá nuevamente en unos segundos.'),
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
