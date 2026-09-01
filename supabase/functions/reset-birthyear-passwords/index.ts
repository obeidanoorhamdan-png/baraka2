// Admin-only: reset every head-of-family account password to their birth year (4 digits).
// The stored auth password is `Baraka2#<year>`; the family types only the 4-digit year.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTH_PW_PREFIX = "Baraka2#";
const ADMIN_NID = "2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ ok: false, error: "تعذر الاتصال بالخدمة" });

    // Validate the caller's JWT and require an admin-tier role.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "غير مصرح" }, 401);
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await asUser.auth.getUser();
    const caller = userRes?.user;
    if (!caller) return json({ ok: false, error: "غير مصرح" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_admin_tier", { _user_id: caller.id });
    if (isAdmin !== true) return json({ ok: false, error: "هذه العملية للمشرفين فقط" }, 403);

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, national_id, birth_date, full_name");
    if (error) return json({ ok: false, error: error.message });

    let updated = 0;
    const skipped: string[] = [];
    for (const p of profiles || []) {
      const year = String((p as any).birth_date || "").slice(0, 4);
      if ((p as any).national_id === ADMIN_NID) continue;
      if (!/^\d{4}$/.test(year)) {
        skipped.push((p as any).national_id || (p as any).id);
        continue;
      }
      const { error: e } = await admin.auth.admin.updateUserById((p as any).id, {
        password: `${AUTH_PW_PREFIX}${year}`,
      });
      if (e) skipped.push((p as any).national_id || (p as any).id);
      else updated++;
    }

    return json({ ok: true, updated, skipped_count: skipped.length });
  } catch (e) {
    return json({ ok: false, error: "حدث خطأ غير متوقع" });
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
