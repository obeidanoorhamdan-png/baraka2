import { supabase } from "@/integrations/supabase/client";

const BUCKET = "announcement-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export type AIResult = { title?: string; body?: string; image?: string };

/** Call the announcement-ai edge function (admin only). */
export async function callAnnouncementAI(payload: {
  action: "write" | "improve" | "image";
  prompt?: string;
  title?: string;
  text?: string;
  image?: string;
}): Promise<AIResult> {
  const { data, error } = await supabase.functions.invoke("announcement-ai", { body: payload });
  if (error) {
    // supabase wraps non-2xx; try to read message
    const msg = (data as any)?.message || error.message || "تعذّر تنفيذ الطلب";
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).message || "تعذّر تنفيذ الطلب");
  return data as AIResult;
}

/** Upload a Blob/File to the announcement media bucket and return a long-lived signed URL. */
export async function uploadAnnouncementMedia(file: Blob, ext: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "تعذّر إنشاء رابط الوسائط");
  return data.signedUrl;
}

/** Convert a data URL to a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
