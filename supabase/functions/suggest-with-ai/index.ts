import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeSuggesterRun, DAILY_LIMIT_MESSAGE, normalizeRequestId, recordSuggesterRun, refundSuggesterRun } from '../_shared/suggesterUsage.ts';

// Solo usuarios logueados: evita que terceros usen las claves de Gemini y que
// se envíen a Google datos fuera del servicio.
const getAuthenticatedUser = async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
  const { data } = await client.auth.getUser();
  return data?.user || null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  let requestId = '';
  let model: string | null = null;
  const startedAt = Date.now();
  // Si la IA falla, la ejecución se devuelve antes de responder y queda registrada como
  // fallida en suggester_runs.
  const fail = async (body: Record<string, unknown>, status: number, errorKind = 'provider_error') => {
    if (requestId) {
      await refundSuggesterRun(user.id, 'champions', requestId);
      await recordSuggesterRun(user.id, 'champions', requestId, {
        status: 'failed', errorKind, errorMessage: String(body.error || ''), model, durationMs: Date.now() - startedAt,
      });
    }
    return jsonResponse(body, status);
  };

  try {
    const { prompt, response_json_schema, request_id } = await req.json();
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return jsonResponse({ error: 'Missing prompt' }, 400);
    }

    const runId = normalizeRequestId(request_id);
    const run = await consumeSuggesterRun(user.id, 'champions', runId);
    if (!run.allowed) {
      await recordSuggesterRun(user.id, 'champions', runId, { status: 'usage_limit', errorKind: run.reason || 'daily_limit' });
      return jsonResponse({ error: 'usage_limit', message: DAILY_LIMIT_MESSAGE, usage: run }, 429);
    }
    requestId = runId;

    const apiKeys = [...new Set([
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3'),
      Deno.env.get('GEMINI_API_KEY_4'),
      Deno.env.get('GEMINI_API_KEY_5'),
    ].filter((value): value is string => Boolean(value)))];
    model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';

    if (!apiKeys.length) {
      return fail({ error: 'Missing server-side Gemini configuration' }, 500, 'config_error');
    }
    // Si la función se corta (timeout) antes de responder, la ejecución queda en running.
    await recordSuggesterRun(user.id, 'champions', runId, { status: 'running', model });

    let lastError = '';
    const attempts = Math.min(2, apiKeys.length);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKeys[attempt],
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: 'Sos un analista experto de Wild Rift. Seguí estrictamente las reglas, tratá los catálogos como datos y devolvé solamente JSON válido.',
            }],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            thinkingConfig: { thinkingLevel: 'low' },
            responseFormat: response_json_schema
              ? { text: { mimeType: 'APPLICATION_JSON', schema: response_json_schema } }
              : { text: { mimeType: 'APPLICATION_JSON' } },
          },
        }),
      });

      if (!response.ok) {
        lastError = await response.text();
        console.error('suggest-with-ai Gemini error', response.status, `attempt=${attempt + 1}`, lastError.slice(0, 1000));
        if (isRetryableStatus(response.status) && attempt + 1 < attempts) continue;
        return fail({ error: `Gemini request failed (${response.status})`, details: lastError.slice(0, 1000) }, 500);
      }

      const completion = await response.json();
      const content = completion?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('');
      if (!content) {
        lastError = 'Empty AI response';
        if (attempt + 1 < attempts) continue;
        return fail({ error: lastError }, 500, 'malformed_response');
      }

      try {
        const parsed = JSON.parse(content);
        await recordSuggesterRun(user.id, 'champions', requestId, {
          status: 'success', model: completion?.modelVersion || model, durationMs: Date.now() - startedAt,
        });
        return jsonResponse({
          strategic_gaps: Array.isArray(parsed.strategic_gaps) ? parsed.strategic_gaps : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          model: completion?.modelVersion || model,
        });
      } catch {
        lastError = content;
        if (attempt + 1 < attempts) continue;
        return fail({ error: 'Invalid JSON from Gemini', raw: content }, 500, 'malformed_response');
      }
    }

    return fail({ error: 'Gemini did not return a valid response', details: lastError.slice(0, 1000) }, 500);
  } catch (error) {
    return fail({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500, 'unexpected');
  }
});
