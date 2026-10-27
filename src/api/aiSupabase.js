import { supabase } from "@/lib/supabaseClient";
import { newSuggesterRequestId } from "@/api/suggesterUsageSupabase";

async function readErrorBody(error) {
  try {
    return await error?.context?.json();
  } catch {
    return null;
  }
}

export async function suggestWithAI(payload) {
  const { data, error } = await supabase.functions.invoke("suggest-with-ai", {
    body: { ...payload, request_id: newSuggesterRequestId() },
  });

  if (error) {
    const body = await readErrorBody(error);
    if (body?.error === "usage_limit") {
      throw Object.assign(new Error(body.message), { kind: "usage_limit" });
    }
    throw error;
  }
  return data;
}
