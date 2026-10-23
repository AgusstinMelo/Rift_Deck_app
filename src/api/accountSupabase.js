import { supabase } from "@/lib/supabaseClient";

// Tablas con datos del usuario. `legacyEmailColumn`: registros antiguos que solo
// guardaban el email del autor (antes de user_id).
const USER_TABLES = [
  { table: "profiles", idColumn: "id" },
  { table: "matches", idColumn: "user_id", legacyEmailColumn: "created_by" },
  { table: "builds", idColumn: "user_id", legacyEmailColumn: "created_by" },
  { table: "personal_goals", idColumn: "user_id" },
  { table: "personal_goal_checkins", idColumn: "user_id" },
  { table: "bug_reports", idColumn: "user_id" },
  { table: "memberships", idColumn: "user_id" },
];

// Derecho de acceso y portabilidad (RGPD arts. 15 y 20): todos los datos del
// usuario en un JSON descargable. Cada consulta respeta las políticas RLS.
export async function exportMyData(user) {
  const data = {};
  const unavailable = [];

  for (const { table, idColumn, legacyEmailColumn } of USER_TABLES) {
    let query = supabase.from(table).select("*");
    query = legacyEmailColumn && user.email
      ? query.or(`${idColumn}.eq.${user.id},${legacyEmailColumn}.eq.${user.email}`)
      : query.eq(idColumn, user.id);

    const { data: rows, error } = await query;
    if (error) {
      unavailable.push(table);
      continue;
    }
    data[table] = rows || [];
  }

  return {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at || null,
    },
    data,
    ...(unavailable.length ? { unavailable_tables: unavailable } : {}),
  };
}

export function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Derecho de supresión (RGPD art. 17): la Edge Function borra los datos y el usuario de Auth.
export async function deleteMyAccount(confirmText) {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirm: confirmText },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
