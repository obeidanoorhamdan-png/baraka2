// Announcement AI helper (admin-only).
// Actions:
//   - "write":   generate a professional Arabic announcement (title + body) from a short idea.
//   - "improve": rewrite/polish existing announcement text.
//   - "image":   generate a new image, or edit an uploaded image, from a prompt.
// Uses Lovable AI Gateway (free, no user key needed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "missing_api_key", message: "مفتاح الذكاء الاصطناعي غير مهيأ" }, 500);

    // --- Auth: only admin tier may use AI ---
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "unauthorized", message: "يلزم تسجيل الدخول" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_admin_tier", { _user_id: uid });
    if (!isAdmin) return json({ error: "forbidden", message: "هذه الميزة للإدارة فقط" }, 403);

    const body = await req.json();
    const action = body?.action as string;

    if (action === "write" || action === "improve") {
      const sys = action === "write"
        ? "أنت محرر محترف لإعلانات مخيم إغاثي اسمه (مخيم بركة 2). اكتب إعلاناً عربياً رسمياً واضحاً ومنسقاً وموجزاً. أعد فقط JSON بالشكل {\"title\":\"...\",\"body\":\"...\"} دون أي نص إضافي."
        : "أنت محرر لغوي محترف. حسّن النص العربي التالي لإعلان مخيم إغاثي ليكون رسمياً واضحاً ومنسقاً مع الحفاظ على المعنى. أعد فقط JSON بالشكل {\"title\":\"...\",\"body\":\"...\"}.";
      const userMsg = action === "write"
        ? `الفكرة: ${body.prompt || ""}`
        : `العنوان الحالي: ${body.title || ""}\nالمحتوى الحالي: ${body.text || body.body || ""}`;

      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
          response_format: { type: "json_object" },
        }),
      });
      if (res.status === 429) return json({ error: "rate_limit", message: "الخدمة مشغولة، حاول لاحقاً" }, 429);
      if (res.status === 402) return json({ error: "no_credits", message: "نفدت أرصدة الذكاء الاصطناعي" }, 402);
      if (!res.ok) return json({ error: "ai_error", message: await res.text() }, 500);
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = { title: "", body: content }; }
      return json({ title: parsed.title || "", body: parsed.body || "" });
    }

    if (action === "image") {
      const prompt = body.prompt as string;
      if (!prompt) return json({ error: "bad_request", message: "الوصف مطلوب" }, 400);
      const content: any[] = [{ type: "text", text: prompt }];
      if (body.image) content.push({ type: "image_url", image_url: { url: body.image } });

      const res = await fetch(`${GATEWAY}/images/generations`, {
        method: "POST",
        headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image",
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      });
      if (res.status === 429) return json({ error: "rate_limit", message: "الخدمة مشغولة، حاول لاحقاً" }, 429);
      if (res.status === 402) return json({ error: "no_credits", message: "نفدت أرصدة الذكاء الاصطناعي" }, 402);
      if (!res.ok) return json({ error: "ai_error", message: await res.text() }, 500);
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) return json({ error: "no_image", message: "تعذّر توليد الصورة" }, 500);
      return json({ image: `data:image/png;base64,${b64}` });
    }

    return json({ error: "bad_action", message: "إجراء غير معروف" }, 400);
  } catch (e) {
    return json({ error: "server_error", message: String(e) }, 500);
  }
});
