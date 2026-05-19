// Public edge function: passwordless sign-in.
// Verifies a single security answer (national_id of a family member, OR birth_date),
// then resets the user's internal password to a fresh random value and returns it
// to the client so it can immediately call signInWithPassword.
//
// For admin (national_id = "2026"): verifies the admin_pin from app_settings instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SigninBody {
  national_id: string;
  answer: {
    kind: "national_id" | "birth_date" | "admin_pin" | "self_birth_date";
    question_id?: string;
    value: string;
  };
}

const ADMIN_NID = "2026";
const DISTRIBUTOR_NID = "2008";
const DISTRIBUTOR_PIN = "2004";

const randomPassword = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "PW-" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as SigninBody;
    if (!body?.national_id) return fail("رقم الهوية مطلوب", "missing_nid");
    if (!body?.answer?.value) return fail("الإجابة مطلوبة", "missing_answer");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return fail("تعذر الاتصال بالخدمة", "missing_config");
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: uid, error: uidErr } = await admin.rpc("find_user_id_by_nid", { _nid: body.national_id });
    if (uidErr || !uid) return fail("لا يوجد حساب بهذا رقم الهوية", "user_not_found");

    let verified = false;

    if (body.national_id === ADMIN_NID) {
      if (body.answer.kind !== "admin_pin") return fail("نوع الإجابة غير صحيح", "invalid_kind");
      const { data: settings } = await admin.from("app_settings").select("admin_pin").eq("id", 1).maybeSingle();
      const adminPin = (settings as any)?.admin_pin || "1234";
      if (body.answer.value.trim() === adminPin) verified = true;
    } else if (body.national_id === DISTRIBUTOR_NID) {
      if (body.answer.kind !== "admin_pin") return fail("نوع الإجابة غير صحيح", "invalid_kind");
      if (body.answer.value.trim() === DISTRIBUTOR_PIN) verified = true;
    } else {
      if (!body.answer.question_id) return fail("بيانات السؤال ناقصة", "missing_qid");
      const v = body.answer.value.trim();
      if (body.answer.kind === "national_id") {
        const { data } = await admin
          .from("family_members")
          .select("id, application_id, applications!inner(user_id)")
          .eq("id", body.answer.question_id)
          .eq("national_id", v)
          .maybeSingle();
        if (data && (data as any).applications?.user_id === uid) verified = true;
      } else if (body.answer.kind === "birth_date") {
        const { data } = await admin
          .from("family_members")
          .select("id, application_id, birth_date, applications!inner(user_id)")
          .eq("id", body.answer.question_id)
          .maybeSingle();
        if (data && (data as any).applications?.user_id === uid && String((data as any).birth_date) === v) {
          verified = true;
        }
      } else if (body.answer.kind === "self_birth_date") {
        // Fallback question: head-of-family own birth_date from profiles.
        // question_id must match the user's own profile id for safety.
        if (body.answer.question_id !== uid) return fail("بيانات السؤال غير صحيحة", "invalid_qid");
        const { data } = await admin
          .from("profiles")
          .select("id, birth_date")
          .eq("id", uid as string)
          .maybeSingle();
        if (data && String((data as any).birth_date) === v) verified = true;
      }
    }

    if (!verified) return fail("الإجابة غير صحيحة، حاول مرة أخرى أو اطلب سؤالاً آخر", "wrong_answer");

    // Generate a fresh random password and apply it
    const newPassword = randomPassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(uid as string, { password: newPassword });
    if (updErr) return fail("تعذّر إنشاء جلسة الدخول، حاول لاحقاً", "update_failed");

    return json({ ok: true, password: newPassword });
  } catch (e) {
    return fail("حدث خطأ غير متوقع، حاول مرة أخرى", "unexpected_error");
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
