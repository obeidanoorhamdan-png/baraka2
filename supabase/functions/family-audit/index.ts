import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const asText = (value: unknown) => typeof value === "string" && value.trim() ? value : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const nationalId = String(body?.national_id ?? "").replace(/\D/g, "");
    if (!/^\d{9}$/.test(nationalId)) {
      return new Response(JSON.stringify({ error: "رقم الهوية يجب أن يكون 9 أرقام" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("service_unavailable");
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });

    let userId: string | null = null;
    const { data: head } = await db.from("profiles").select("id").eq("national_id", nationalId).maybeSingle();
    userId = head?.id ?? null;
    if (!userId) {
      const { data: member } = await db.from("family_members").select("application_id").eq("national_id", nationalId).limit(1).maybeSingle();
      if (member?.application_id) {
        const { data: applicationOwner } = await db.from("applications").select("user_id").eq("id", member.application_id).maybeSingle();
        userId = applicationOwner?.user_id ?? null;
      }
    }
    if (!userId) return new Response(JSON.stringify({ data: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [{ data: profile }, { data: application }] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db.from("applications").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (!profile) return new Response(JSON.stringify({ data: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: members } = application?.id
      ? await db.from("family_members").select("*").eq("application_id", application.id).eq("is_head", false).order("created_at")
      : { data: [] };

    const paths = new Set<string>();
    const documentFields = ["id_card_url", "birth_certificate_url", "injury_report_url", "pregnancy_report_url", "chronic_disease_report_url", "special_needs_report_url"];
    for (const record of [profile, ...(members ?? [])]) {
      for (const field of documentFields) {
        const path = asText(record?.[field]);
        if (path) paths.add(path);
      }
    }
    const martyrPath = asText(application?.martyr_death_certificate_url);
    if (martyrPath) paths.add(martyrPath);

    const signedUrls: Record<string, string> = {};
    await Promise.all([...paths].map(async (path) => {
      const { data } = await db.storage.from("medical-reports").createSignedUrl(path, 600, { download: false });
      if (data?.signedUrl) signedUrls[path] = data.signedUrl;
    }));

    const attachUrls = (record: Record<string, unknown>) => {
      const result = { ...record } as Record<string, unknown>;
      for (const field of documentFields) {
        const path = asText(record[field]);
        result[field] = path ? signedUrls[path] ?? null : null;
      }
      return result;
    };

    const safeApplication = application ? { ...application } : null;
    if (safeApplication?.martyr_death_certificate_url) {
      safeApplication.martyr_death_certificate_url = signedUrls[safeApplication.martyr_death_certificate_url] ?? null;
    }

    return new Response(JSON.stringify({
      data: { head: attachUrls(profile), app: safeApplication, members: (members ?? []).map(attachUrls) },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return new Response(JSON.stringify({ error: "تعذّر جلب البيانات، حاول مجدداً" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
