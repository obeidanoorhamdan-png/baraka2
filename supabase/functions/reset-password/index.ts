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

const PIN_AUTH_PREFIX = "Baraka2-PampPIN";
const pinToAuthPassword = (pin: string) => {
  const clean = pin.replace(/\D/g, "").slice(0, 4);
  return `${PIN_AUTH_PREFIX}-${clean}-${clean.split("").reverse().join("")}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as ResetBody;
    if (!body?.national_id || !/^\d{9}$/.test(body.national_id)) {
      return fail("رقم الهوية غير صحيح. يجب أن يكون 9 أرقام.", "invalid_national_id");
    }
    if (!body?.new_password || !/^\d{4}$/.test(body.new_password)) {
      return fail("كلمة المرور يجب أن تكون 4 أرقام بالضبط.", "invalid_pin");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return fail("تعذر الاتصال بخدمة تغيير كلمة المرور. يرجى المحاولة لاحقاً.", "missing_config");
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Re-verify the answers server-side
    const { data: ok, error: verErr } = await admin.rpc("verify_security_answers", {
      _nid: body.national_id,
      _q1: body.q1.id, _k1: body.q1.kind, _v1: body.q1.value,
      _q2: body.q2.id, _k2: body.q2.kind, _v2: body.q2.value,
    });
    if (verErr) return fail("تعذر التحقق من الإجابات. يرجى المحاولة مرة أخرى.", "verify_failed");
    if (ok !== true) return fail("الإجابات غير صحيحة. يرجى التأكد من البيانات وإعادة المحاولة.", "wrong_answers");

    // 2) Resolve user_id
    const { data: uid, error: uidErr } = await admin.rpc("find_user_id_by_nid", { _nid: body.national_id });
    if (uidErr || !uid) return fail("لم يتم العثور على حساب بهذا رقم الهوية.", "user_not_found");

    // 3) Update password using an internal strong value while the family only uses a 4-digit PIN.
    const { error: updErr } = await admin.auth.admin.updateUserById(uid as string, {
      password: pinToAuthPassword(body.new_password),
    });
    if (updErr) return fail("فشل تغيير كلمة المرور. يرجى المحاولة مرة أخرى.", "update_failed");

    return json({ ok: true });
  } catch (e) {
    return fail("حدث خطأ غير متوقع أثناء تغيير كلمة المرور. يرجى المحاولة مرة أخرى.", "unexpected_error");
  }
});

function fail(error: string, code: string) {
  return json({ ok: false, error, code }, 200);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
