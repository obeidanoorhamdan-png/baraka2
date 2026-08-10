/**
 * استعلام السجل المدني — يعبّئ الاسم وتاريخ الميلاد تلقائياً من رقم الهوية.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CivilRecord {
  success: true;
  message?: string;
  national_id: string;
  full_name: string;
  birth_date: string | null;
  site_name?: string | null;
  breadwinner_name?: string | null;
  breadwinner_national_id?: string | null;
}

export interface CivilRecordError {
  success: false;
  message: string;
  full_name?: undefined;
  birth_date?: undefined;
}

const cache = new Map<string, CivilRecord | CivilRecordError>();

export async function lookupCivilRecord(nid: string): Promise<CivilRecord | CivilRecordError> {
  const id = String(nid || "").replace(/\D/g, "");
  if (id.length !== 9) {
    return { success: false, message: "رقم الهوية يجب أن يكون 9 أرقام" };
  }
  const hit = cache.get(id);
  if (hit) return hit;

  try {
    const { data, error } = await supabase.functions.invoke("civil-record", {
      body: { national_id: id },
    });
    if (error) throw error;
    const result: CivilRecord | CivilRecordError =
      data?.success === true
        ? (data as CivilRecord)
        : { success: false, message: data?.message || "رقم الهوية غير موجود في السجل المدني" };
    cache.set(id, result);
    return result;
  } catch {
    return { success: false, message: "تعذّر الاتصال بالسجل المدني — تحقّق من الإنترنت" };
  }
}
