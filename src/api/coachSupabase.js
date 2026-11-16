import { supabase } from "@/lib/supabaseClient";

// Historial del Rift Deck Coach (coach_insight_log): qué consejos ya se mostraron y
// desde cuándo, para marcar novedades y medir el seguimiento. Si la tabla todavía no
// existe (migración sin aplicar), el Coach funciona igual, sin historial.

export async function getCoachHistory(user) {
  if (!user?.id) return [];
  const { data, error } = await supabase
    .from("coach_insight_log")
    .select("insight_key, track, first_seen_at")
    .eq("user_id", user.id)
    .order("first_seen_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return data || [];
}

/** Registra consejos nuevos sin pisar la fecha en que se vieron por primera vez. */
export async function logCoachInsights(user, insights) {
  if (!user?.id || !insights.length) return;
  const rows = insights.map(insight => ({
    user_id: user.id,
    insight_key: insight.id,
    track: insight.track || null,
  }));
  await supabase
    .from("coach_insight_log")
    .upsert(rows, { onConflict: "user_id,insight_key", ignoreDuplicates: true });
}
