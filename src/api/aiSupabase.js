import { supabase } from "@/lib/supabaseClient";

export async function suggestWithAI(payload) {
  const { data, error } = await supabase.functions.invoke("suggest-with-ai", {
    body: payload,
  });

  if (error) throw error;
  return data;
}
