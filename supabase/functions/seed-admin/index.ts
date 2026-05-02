// Idempotent admin bootstrap. Creates the admin account if it doesn't exist.
// Admin login: national_id "2026", PIN "1234". Synthetic email: 2026@baraka2.local
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_NID = "2026";
const ADMIN_PIN = "1234";
const ADMIN_EMAIL = `${ADMIN_NID}@baraka2.local`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check if profile already exists for the admin NID
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("national_id", ADMIN_NID)
      .maybeSingle();

    if (existing?.id) {
      // Make sure it has admin role (idempotent)
      await admin.from("user_roles").upsert(
        { user_id: existing.id, role: "admin" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
      return json({ ok: true, status: "exists" });
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PIN,
      email_confirm: true,
      user_metadata: {
        national_id: ADMIN_NID,
        full_name: "إدارة مخيم بركة 2",
        phone: "0599999999",
        birth_date: "1990-01-01",
        gender: "male",
        marital_status: "single",
      },
    });
    if (error) return json({ error: error.message }, 400);

    // Trigger should auto-promote, but ensure it explicitly
    if (created?.user?.id) {
      await admin.from("user_roles").upsert(
        { user_id: created.user.id, role: "admin" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }
    return json({ ok: true, status: "created" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
