import { supabase } from "@/lib/supabaseClient";

// Versión del parche activo de la app (game_state → game_patches).
export async function getActivePatchVersion() {
  const { data, error } = await supabase
    .from("game_state")
    .select("game_patches(version)")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data?.game_patches?.version || null;
}
