import { supabase } from '@/lib/supabaseClient';
import { createV2BuildJsonSchema } from './v2Schema';

export async function requestV2Build(prompt, snapshot) {
  const { data, error } = await supabase.functions.invoke('suggest-build-v2', {
    body: { prompt, response_json_schema: createV2BuildJsonSchema(snapshot) },
  });
  if (error) throw Object.assign(new Error(error.message), { kind: 'provider_error' });
  if (!data?.ok) {
    const providerDetail = typeof data?.details === 'string' ? data.details : '';
    const message = [data?.error || 'El proveedor no devolvió una respuesta válida.', providerDetail].filter(Boolean).join(' · ');
    throw Object.assign(new Error(message), {
      kind: data?.kind || 'provider_error', raw: data?.raw, details: providerDetail,
    });
  }
  return data;
}
