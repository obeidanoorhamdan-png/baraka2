// Idempotent bootstrap. Creates default accounts:
//   - Super Admin: national_id "2026", PIN "1234"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIN_AUTH_PREFIX = "Baraka2-PampPIN";
const pinToAuthPassword = (pin: string) => {
  const clean = pin.replace(/\D/g, "").slice(0, 4);
  return `${PIN_AUTH_PREFIX}-${clean}-${clean.split("").reverse().join("")}`;
};

type Seed = {
  nid: string;
  pin: string;
  role: "admin";
  fullName: string;
  phone: string;
};

const SEEDS: Seed[] = [
  { nid: "2026", pin: "1234", role: "admin", fullName: "إدارة مخيم بركة 2", phone: "0599999999" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const results: any[] = [];

    for (const s of SEEDS) {
      const email = `${s.nid}@baraka2.local`;
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("national_id", s.nid)
        .maybeSingle();

      if (existing?.id) {
        await admin.auth.admin.updateUserById(existing.id, { password: pinToAuthPassword(s.pin) });
        await admin.from("user_roles").upsert(
          { user_id: existing.id, role: s.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
        results.push({ nid: s.nid, status: "exists" });
        continue;
      }

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: pinToAuthPassword(s.pin),
        email_confirm: true,
        user_metadata: {
          national_id: s.nid,
          full_name: s.fullName,
          phone: s.phone,
          birth_date: "1990-01-01",
          gender: "male",
          marital_status: "single",
        },
      });
      if (error) { results.push({ nid: s.nid, error: error.message }); continue; }
      if (created?.user?.id) {
        await admin.from("user_roles").upsert(
          { user_id: created.user.id, role: s.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      }
      results.push({ nid: s.nid, status: "created" });
    }

    return json({ ok: true, results });
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
