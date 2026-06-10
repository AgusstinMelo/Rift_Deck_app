import { supabase } from "@/lib/supabaseClient";

export async function createBugReport(user, payload) {
  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      ...payload,
      user_id: user?.id || null,
      user_email: user?.email || payload.user_email || null,
      user_name: user?.visible_name || user?.full_name || payload.user_name || null,
      date: new Date().toISOString(),
      status: payload.status || "open",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
