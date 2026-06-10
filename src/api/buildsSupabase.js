import { supabase } from "@/lib/supabaseClient";

export async function getUserBuilds(user, limit = 1000) {
  if (!user) return [];

  let data = [];

  if (user.id) {
    const { data: userBuilds, error } = await supabase
      .from("builds")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = userBuilds || [];
  }

  if (data.length === 0 && user.email) {
    const { data: legacyBuilds, error } = await supabase
      .from("builds")
      .select("*")
      .eq("created_by", user.email)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = legacyBuilds || [];
  }

  return data;
}

export async function getBuildsForChampion(user, champion, limit = 1000) {
  const builds = await getUserBuilds(user, limit);

  return builds.filter(build =>
    build.champion_id === champion.id ||
    build.champion_name?.toLowerCase() === champion.name?.toLowerCase()
  );
}

export async function getComparableBuilds(user, limit = 1000) {
  let query = supabase
    .from("builds")
    .select("*")
    .order("champion_name", { ascending: true })
    .limit(limit);

  if (user?.id) {
    query = query.or(`user_id.eq.${user.id},is_public.eq.true`);
  } else {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBuild(user, payload) {
  if (!user?.id) {
    throw new Error("User id is required to create a build.");
  }

  const { data, error } = await supabase
    .from("builds")
    .insert({
      ...payload,
      user_id: user.id,
      created_by: user.email || payload.created_by || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBuild(id, payload) {
  const { data, error } = await supabase
    .from("builds")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBuild(id) {
  const { data, error } = await supabase
    .from("builds")
    .delete()
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}
