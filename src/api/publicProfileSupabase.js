import { supabase } from "@/lib/supabaseClient";

/**
 * Perfil público por nombre de link. `null` si no existe o no es público.
 * Lo resuelve get_public_profile() en la base: solo agregados y builds públicas.
 */
export async function getPublicProfile(slug) {
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: slug });
  if (error) throw error;
  return data || null;
}

/** Link completo del perfil público. */
export function publicProfileUrl(slug) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.riftdeckapp.com";
  return `${origin}/p/${slug}`;
}

/** Marca una build como pública (aparece en el perfil público) o privada. */
export async function setBuildPublic(id, isPublic) {
  const { data, error } = await supabase
    .from("builds")
    .update({ is_public: Boolean(isPublic) })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
