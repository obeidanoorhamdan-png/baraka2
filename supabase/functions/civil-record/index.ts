// وسيط آمن للاستعلام عن السجل المدني عبر رقم الهوية (لتجاوز قيود CORS).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.40 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

const BASE = "http://213.6.135.115";
const COOKIE = "phc_warda_dev=23103dd4c9d51321084c59f5441256e9";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let nid = "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      nid = String(body?.national_id ?? body?.id_card_no ?? "");
    } else {
      nid = new URL(req.url).searchParams.get("national_id") ?? "";
    }
    nid = nid.replace(/\D/g, "");
    if (nid.length !== 9) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_id", message: "رقم الهوية يجب أن يكون 9 أرقام" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${BASE}/api/citizens/civilrecord.php?id_card_no=${nid}`, {
      headers: {
        "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        Referer: `${BASE}/`,
        Cookie: COOKIE,
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "upstream", message: "تعذّر الاتصال بالسجل المدني، حاول لاحقاً" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json().catch(() => null);
    if (!data || data.success !== true || !data.full_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "not_found",
          message: "رقم الهوية غير صحيح أو غير موجود في السجل المدني",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        national_id: nid,
        full_name: data.full_name,
        birth_date: data.birth_date ?? null,
        site_name: data.site_name_ar ?? null,
        breadwinner_name: data.breadwinner_full_name ?? null,
        breadwinner_national_id: data.breadwinner_id_card_no ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "server", message: "خطأ في الخدمة، حاول لاحقاً" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
