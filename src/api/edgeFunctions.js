import { supabase } from '@/lib/supabaseClient';
import { labels } from '@/i18n/uiI18n';

const COMMON_ERROR_MESSAGES = labels({
  'Invalid plan_code': 'payments.invalidPlan',
  'Membership already active': 'payments.alreadyActive',
});

async function readErrorCode(error) {
  try {
    const body = await error?.context?.json();
    return body?.error || null;
  } catch {
    return null;
  }
}

/**
 * Invoca una edge function y traduce sus errores a un mensaje para el usuario.
 * @param {string} name
 * @param {object} body
 * @param {{ messages?: Record<string, string>, fallback: string }} options
 */
export async function invokeEdgeFunction(name, body, { messages = {}, fallback }) {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const code = await readErrorCode(error);
    throw new Error(messages[code] || COMMON_ERROR_MESSAGES[code] || fallback);
  }
  return data;
}
