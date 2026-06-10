import { supabase } from "@/lib/supabaseClient";

export async function getUserMatches(user, limit = 1000) {
  if (!user) return [];

  let data = [];

  if (user.id) {
    const { data: userMatches, error } = await supabase
      .from("matches")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = userMatches || [];
  }

  if (data.length === 0 && user.email) {
    const { data: legacyMatches, error } = await supabase
      .from("matches")
      .select("*")
      .eq("created_by", user.email)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = legacyMatches || [];
  }

  return data;
}

export async function createMatch(user, payload) {
  if (!user?.id) {
    throw new Error("User id is required to create a match.");
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({
      ...payload,
      user_id: user.id,
      created_by: user.email,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMatch(id, payload) {
  const { data, error } = await supabase
    .from("matches")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMatch(id) {
  const { data, error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}

export async function deleteMatches(ids) {
  if (!ids?.length) return [];

  const { data, error } = await supabase
    .from("matches")
    .delete()
    .in("id", ids)
    .select();

  if (error) throw error;
  return data;
}
