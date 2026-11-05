import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const nid = String(body?.national_id ?? "").replace(/\D/g, "");
    if (!/^\d{9}$/.test(nid)) return json({ error: "رقم الهوية يجب أن يكون 9 أرقام" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: prof } = await db.from("profiles").select("id").eq("national_id", nid).maybeSingle();
    const { data: roster } = await db.from("camp_roster").select("status,head_name").eq("national_id", nid).maybeSingle();
    const approved = roster?.status === "approved";

    if (body?.action === "check") {
      if (prof) return json({ status: "account" });
      return json({ status: approved ? "register" : "not_approved" });
    }

    if (body?.action !== "register") return json({ error: "action" }, 400);
    if (prof) return json({ error: "يوجد حساب لهذه الهوية، أدخل كلمة المرور" }, 409);
    if (!approved) return json({ error: "رقم الهوية غير معتمد في سجل المخيم" }, 403);

    const fullName = String(body?.full_name ?? "").trim();
    const birth = String(body?.birth_date ?? "");
    const phone = String(body?.phone ?? "").replace(/\D/g, "");
    const gender = body?.gender === "female" ? "female" : "male";
    if (fullName.split(/\s+/).length < 3 || fullName.length > 120) return json({ error: "اكتب الاسم الرباعي أو الثلاثي على الأقل" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(Date.parse(birth))) return json({ error: "تاريخ الميلاد غير صحيح" }, 400);
    if (!/^\d{9,12}$/.test(phone)) return json({ error: "رقم التواصل غير صحيح" }, 400);

    const { error } = await db.auth.admin.createUser({
      email: `${nid}@baraka2.local`,
      password: `Baraka2#${birth.slice(0, 4)}`,
      email_confirm: true,
      user_metadata: { national_id: nid, full_name: fullName, birth_date: birth, phone, gender },
    });
    if (error) return json({ error: "تعذّر إنشاء الحساب، حاول مجدداً" }, 400);
    return json({ ok: true });
  } catch {
    return json({ error: "تعذّر الاتصال بالخادم" }, 500);
  }
});
