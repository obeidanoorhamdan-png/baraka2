// Public edge function: "Forgot my data" — verifies the registered phone
// number for a given national_id and, if matched, deletes ALL the user's data
// (auth user + cascading profile/application/family_members) so the person can
// re-register from scratch.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  national_id: string;
  phone: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.national_id || !/^\d{9}$/.test(body.national_id)) {
      return fail("رقم الهوية غير صحيح", "invalid_nid");
    }
    if (!body?.phone || !/^(059|056)\d{7}$/.test(body.phone)) {
      return fail("رقم الجوال غير صحيح", "invalid_phone");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return fail("تعذر الاتصال بالخدمة", "missing_config");
    const admin = createClient(supabaseUrl, serviceKey);

    // Find the profile + verify phone.
    const { data: prof } = await admin
      .from("profiles")
      .select("id, phone")
      .eq("national_id", body.national_id)
      .maybeSingle();

    if (!prof) return fail("لا يوجد حساب بهذه البيانات", "user_not_found");
    if ((prof as any).phone !== body.phone) {
      return fail("رقم الجوال لا يطابق الرقم المسجّل", "phone_mismatch");
    }

    // Block deletion of admin accounts.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", (prof as any).id);
    if ((roles || []).some((r: any) => r.role === "admin")) {
      return fail("لا يمكن حذف هذا الحساب", "forbidden");
    }

    const uid = (prof as any).id as string;

    // Cleanup data manually (in case there are no FK cascades from auth.users).
    const { data: apps } = await admin.from("applications").select("id").eq("user_id", uid);
    const appIds = (apps || []).map((a: any) => a.id);
    if (appIds.length) {
      await admin.from("family_members").delete().in("application_id", appIds);
      await admin.from("aid_distributions").delete().in("application_id", appIds);
    }
    await admin.from("applications").delete().eq("user_id", uid);
    await admin.from("application_drafts").delete().eq("user_id", uid);
    await admin.from("notifications").delete().eq("user_id", uid);
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("id", uid);

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) return fail("تعذّر حذف الحساب: " + delErr.message, "delete_failed");

    return json({ ok: true });
  } catch (e) {
    return fail("حدث خطأ غير متوقع", "unexpected_error");
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
