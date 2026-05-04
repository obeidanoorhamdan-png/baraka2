// Public edge function: passwordless sign-in.
// Verifies a single security answer (national_id of one family member, OR birth_date),
// then resets the user's internal password to a fresh random value and returns it
// to the client so they can immediately call signInWithPassword.
//
// For admin (national_id = "2026"), instead verifies the admin_pin from app_settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SigninBody {
  national_id: string;
  // For regular users: { kind: "national_id"|"birth_date", question_id: uuid, value: string }
  // For admin: { kind: "admin_pin", value: "1234" }
  answer: {
    kind: "national_id" | "birth_date" | "admin_pin";
    question_id?: string;
    value: string;
  };
}

const ADMIN_NID = "2026";

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

    // Resolve user_id by national_id
    const { data: uid, error: uidErr } = await admin.rpc("find_user_id_by_nid", { _nid: body.national_id });
    if (uidErr || !uid) return fail("لا يوجد حساب بهذا رقم الهوية", "user_not_found");

    // Verify based on flow
    if (body.national_id === ADMIN_NID) {
      // Admin flow: check admin_pin from app_settings
      if (body.answer.kind !== "admin_pin") return fail("نوع الإجابة غير صحيح للإدارة", "invalid_kind");
      const { data: settings } = await admin.from("app_settings").select("admin_pin").eq("id", 1).maybeSingle();
      const adminPin = (settings as any)?.admin_pin || "1234";
      if (body.answer.value.trim() !== adminPin) {
        return fail("كل