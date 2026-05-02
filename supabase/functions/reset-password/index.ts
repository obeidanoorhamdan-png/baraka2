// Public edge function: reset password using national_id + 2 family security answers.
// Re-verifies via verify_security_answers RPC, then uses the admin API to set the new password.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetBody {
  national_id: string;
  new_password: string;
  q1: { id: string; kind: "national_id" | "birth_date"; value: string };
  q2: { id: string; kind: "national_id" | "birth_date"; value: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as ResetBody;
    if (!body?.national_id || !/^\d{9}$/.test(body.national_id)) {
      return json({ error: "Invalid national ID" }, 400);
    }
    if (!body?.new_password || body.new_password.length < 6) {
      return json({ error: "Password too short" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Re-verify the answers server-side
    const { data: ok, error: verErr } = await admin.rpc("verify_security_answers", {
      _nid: body.national_id,
      _q1: body.q1.id, _k1: body.q1.kind, _v1: body.q1.value,
      _q2: body.q2.id, _k2: body.q2.kind, _v2: body.q2.value,
    });
    if (verErr) return json({ error: verErr.message }, 400);
    if (ok !== true) return json({ error: "Wrong answers" }, 403);

    // 2) Resolve user_id
    const { data: uid, error: uidErr } = await admin.rpc("find_user_id_by_nid", { _nid: body.national_id });
    if (uidErr || !uid) return json({ error: "User not found" }, 404);

    // 3) Update password using the admin API
    const { error: updErr } = await admin.auth.admin.updateUserById(uid as string, {
      password: body.new_password,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true });
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
