/**
 * كشف مشاكل بيانات الأسر — منطق موحّد يُستخدم في جدول الطلبات وفي نافذة حل المشاكل.
 */
export type IssueCode =
  | "head_nid"
  | "head_phone"
  | "head_dob"
  | "size_mismatch"
  | "member_nid"
  | "member_dob"
  | "camp"
  | "origin";

export interface FamilyIssue {
  code: IssueCode;
  label: string;
  /** يمكن إصلاحه بضغطة واحدة */
  autoFix?: "sync_size";
}

const isValidNid = (v: any) => String(v || "").replace(/\D/g, "").length === 9;

export const ISSUE_LABELS: Record<IssueCode, string> = {
  head_nid: "هوية رب الأسرة",
  head_phone: "رقم الجوال",
  head_dob: "تاريخ ميلاد رب الأسرة",
  size_mismatch: "عدد الأفراد غير مطابق",
  member_nid: "أفراد بدون هوية",
  member_dob: "أفراد بدون تاريخ ميلاد",
  camp: "المخيم الحالي",
  origin: "السكن الأصلي",
};

export function detectFamilyIssues(app: any, head: any, members: any[]): FamilyIssue[] {
  const p = head || {};
  const mem = members || [];
  const out: FamilyIssue[] = [];

  if (!isValidNid(p.national_id)) out.push({ code: "head_nid", label: "رقم هوية رب الأسرة ناقص أو غير صحيح" });
  if (!p.phone) out.push({ code: "head_phone", label: "رقم الجوال ناقص" });
  if (!p.birth_date) out.push({ code: "head_dob", label: "تاريخ ميلاد رب الأسرة ناقص" });

  const actual = mem.filter((m) => !m.is_head).length + 1;
  if ((app?.family_size || 0) !== actual) {
    out.push({
      code: "size_mismatch",
      label: `عدد الأفراد المسجل (${app?.family_size || 0}) لا يطابق الفعلي (${actual})`,
      autoFix: "sync_size",
    });
  }

  const noNid = mem.filter((m) => !m.is_head && !isValidNid(m.national_id));
  if (noNid.length) out.push({ code: "member_nid", label: `${noNid.length} فرد بدون رقم هوية صحيح` });

  const noDob = mem.filter((m) => !m.birth_date);
  if (noDob.length) out.push({ code: "member_dob", label: `${noDob.length} فرد بدون تاريخ ميلاد` });

  if (!app?.current_camp) out.push({ code: "camp", label: "المخيم/مكان الإيواء ناقص" });
  if (!app?.original_residence) out.push({ code: "origin", label: "السكن الأصلي ناقص" });

  return out;
}

/** العدد الفعلي للأفراد (رب الأسرة + الأفراد بدون تكراره) */
export const actualFamilySize = (members: any[]) =>
  (members || []).filter((m) => !m.is_head).length + 1;
