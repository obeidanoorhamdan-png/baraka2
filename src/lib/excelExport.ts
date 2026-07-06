/**
 * مركز تصدير اكسل احترافي — يعمل أونلاين وأوفلاين (يقرأ من cache عند انقطاع الاتصال).
 * يستخدم ExcelJS لإنتاج ملفات منسقة بشكل احترافي (ألوان، حدود، رؤوس مدمجة، اتجاه RTL).
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { cacheGet, cacheSet } from "./offlineOutbox";

const NA = "لا يوجد";
const ZERO = 0;

/* ---------- أنواع البيانات ---------- */
export interface Profile {
  id: string;
  national_id: string;
  full_name: string;
  phone: string;
  alt_phone?: string | null;
  birth_date: string;
  gender: string;
  marital_status: string;
  chronic_diseases?: string | null;
  is_war_injured?: boolean;
  is_special_needs?: boolean;
}
export interface FamilyMember {
  id: string;
  application_id: string;
  full_name: string;
  national_id?: string | null;
  birth_date: string;
  gender: string;
  relationship: string;
  is_war_injured?: boolean;
  chronic_diseases?: string | null;
  is_pregnant?: boolean;
  is_breastfeeding?: boolean;
  is_special_needs?: boolean;
}
export interface Application {
  id: string;
  user_id: string;
  status: string;
  family_size: number;
  current_camp: string;
  current_landmark: string;
  original_residence: string;
  original_landmark: string;
  has_martyr: boolean;
  martyr_name?: string | null;
  martyr_relationship?: string | null;
  is_female_breadwinner?: boolean;
}

/* ---------- جلب البيانات (المقبولين فقط) ---------- */
export async function fetchApprovedDataset() {
  const cacheKey = "excel:approved-dataset";
  try {
    const [{ data: apps, error: e1 }, { data: profiles, error: e2 }, { data: members, error: e3 }, { data: roster }] =
      await Promise.all([
        supabase.from("applications").select("*").eq("status", "approved"),
        supabase.from("profiles").select("*"),
        supabase.from("family_members").select("*"),
        supabase.from("camp_roster").select("national_id, status").eq("status", "removed"),
      ]);
    if (e1 || e2 || e3) throw e1 || e2 || e3;
    const removed = new Set((roster || []).map((r: any) => r.national_id));
    const profileNid = new Map((profiles || []).map((p: any) => [p.id, p.national_id]));
    const excludedAppIds = new Set(
      (apps || []).filter((a: any) => removed.has(profileNid.get(a.user_id))).map((a: any) => a.id),
    );
    const dataset = {
      apps: ((apps || []) as Application[]).filter((a) => !excludedAppIds.has(a.id)),
      profiles: (profiles || []) as Profile[],
      members: ((members || []) as FamilyMember[]).filter((m) => !excludedAppIds.has((m as any).application_id)),
    };
    await cacheSet(cacheKey, dataset);
    return dataset;
  } catch (e) {
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;
    throw e;
  }
}


/* ---------- أدوات مساعدة ---------- */
function calcAge(birthDate?: string | null): number | string {
  if (!birthDate) return NA;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return NA;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}
function v(x: any): any {
  if (x === null || x === undefined || x === "") return NA;
  return x;
}
function bool(x: any): string {
  return x ? "نعم" : "لا";
}
function pregBreast(m: FamilyMember): string {
  if (m.is_pregnant && m.is_breastfeeding) return "حامل ومرضعة";
  if (m.is_pregnant) return "حامل";
  if (m.is_breastfeeding) return "مرضعة";
  return "لا";
}
function findSpouse(appId: string, members: FamilyMember[]): FamilyMember | null {
  return members.find((m) => m.application_id === appId && (m.relationship === "wife" || m.relationship === "husband")) || null;
}

/* ---------- تنسيق ورقة احترافي ---------- */
function styleSheet(ws: ExcelJS.Worksheet, headers: string[]) {
  ws.views = [{ rightToLeft: true, showGridLines: false }];
  // الصف 1: عنوان مدمج
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = ws.name;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // الصف 2: رؤوس
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  headerRow.height = 28;
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
  ws.views[0].state = "frozen";
  (ws.views[0] as any).ySplit = 2;
}

function applyRowStyles(ws: ExcelJS.Worksheet, startRow: number, colCount: number) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.height = 22;
    const zebra = (r - startRow) % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Arial", size: 10, ...(cell.font || {}) };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    }
  }
  // عرض الأعمدة تلقائي
  ws.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 36);
  });
}

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/* ---------- القوالب ---------- */

/** كشف الأسر الكامل — جميع الأسر المقبولة (رب الأسرة + الزوج/ة + الموقع) */
export async function exportFamiliesAll() {
  const { apps, profiles, members } = await fetchApprovedDataset();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Baraka 2";
  wb.created = new Date();
  const ws = wb.addWorksheet("كشف الأسر المقبولة");

  const headers = [
    "م",
    "اسم رب الأسرة",
    "رقم الهوية",
    "العمر",
    "تاريخ الميلاد",
    "الجوال",
    "الجوال البديل",
    "أمراض مزمنة",
    "مصاب حرب",
    "اسم الزوج/ة",
    "هوية الزوج/ة",
    "عمر الزوج/ة",
    "تاريخ ميلاد الزوج/ة",
    "حامل/مرضعة",
    "حجم الأسرة",
    "السكن الأصلي",
    "أقرب معلم للسكن الأصلي",
    "المخيم الحالي",
    "المعلم الحالي للسكن",
  ];
  styleSheet(ws, headers);

  let i = 1;
  for (const app of apps) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    const spouse = findSpouse(app.id, members);
    ws.addRow([
      i++,
      v(head.full_name),
      v(head.national_id),
      calcAge(head.birth_date),
      v(head.birth_date),
      v(head.phone),
      v(head.alt_phone),
      v(head.chronic_diseases),
      bool(head.is_war_injured),
      spouse ? v(spouse.full_name) : NA,
      spouse ? v(spouse.national_id) : NA,
      spouse ? calcAge(spouse.birth_date) : NA,
      spouse ? v(spouse.birth_date) : NA,
      spouse ? pregBreast(spouse) : NA,
      app.family_size ?? ZERO,
      v(app.original_residence),
      v(app.original_landmark),
      v(app.current_camp),
      v(app.current_landmark),
    ]);
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `كشف_الأسر_المقبولة_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** الأرامل والنساء معيلات */
export async function exportWidows() {
  const { apps, profiles, members } = await fetchApprovedDataset();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الأرامل والنساء المعيلات");
  const headers = [
    "م", "اسم المعيلة", "رقم الهوية", "العمر", "تاريخ الميلاد",
    "الجوال", "الجوال البديل", "أمراض مزمنة", "مصاب", "حجم الأسرة",
    "عدد الأبناء", "السكن الأصلي", "المخيم الحالي", "المعلم الحالي",
  ];
  styleSheet(ws, headers);

  let i = 1;
  for (const app of apps) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    const isWidow = head.marital_status === "widow" || head.marital_status === "widowed";
    if (!app.is_female_breadwinner && !isWidow) continue;
    const children = members.filter(
      (m) => m.application_id === app.id && m.relationship !== "wife" && m.relationship !== "husband",
    );
    ws.addRow([
      i++,
      v(head.full_name), v(head.national_id), calcAge(head.birth_date), v(head.birth_date),
      v(head.phone), v(head.alt_phone), v(head.chronic_diseases), bool(head.is_war_injured),
      app.family_size ?? ZERO, children.length,
      v(app.original_residence), v(app.current_camp), v(app.current_landmark),
    ]);
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `الأرامل_والمعيلات_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** الأيتام — أبناء قاصرون في أسر بها شهيد */
export async function exportOrphans() {
  const { apps, profiles, members } = await fetchApprovedDataset();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الأيتام");
  const headers = [
    "م", "اسم اليتيم", "رقم الهوية", "العمر", "تاريخ الميلاد", "الجنس",
    "أمراض مزمنة", "مصاب", "اسم الشهيد", "صلة القرابة بالشهيد",
    "اسم المعيل", "هوية المعيل", "جوال المعيل", "السكن الأصلي", "المخيم الحالي",
  ];
  styleSheet(ws, headers);

  let i = 1;
  for (const app of apps.filter((a) => a.has_martyr)) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    const orphans = members.filter((m) => {
      if (m.application_id !== app.id) return false;
      if (m.relationship === "wife" || m.relationship === "husband") return false;
      const age = calcAge(m.birth_date);
      return typeof age === "number" && age < 18;
    });
    for (const o of orphans) {
      ws.addRow([
        i++,
        v(o.full_name), v(o.national_id), calcAge(o.birth_date), v(o.birth_date),
        o.gender === "male" ? "ذكر" : o.gender === "female" ? "أنثى" : NA,
        v(o.chronic_diseases), bool(o.is_war_injured),
        v(app.martyr_name), v(app.martyr_relationship),
        v(head.full_name), v(head.national_id), v(head.phone),
        v(app.original_residence), v(app.current_camp),
      ]);
    }
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `الأيتام_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** الأطفال حسب الفئة العمرية */
export async function exportChildrenByAge(minAge: number, maxAge: number) {
  const { apps, profiles, members } = await fetchApprovedDataset();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`الأطفال ${minAge}-${maxAge} سنة`);
  const headers = [
    "م", "اسم الطفل", "رقم الهوية", "العمر", "تاريخ الميلاد", "الجنس",
    "أمراض مزمنة", "مصاب حرب", "ذوي همم",
    "اسم الأب", "هوية الأب", "جوال الأب", "الجوال البديل",
    "اسم الأم", "هوية الأم",
    "السكن الأصلي", "المخيم الحالي", "المعلم الحالي",
  ];
  styleSheet(ws, headers);

  let i = 1;
  const approvedIds = new Set(apps.map((a) => a.id));
  for (const app of apps) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    const spouse = findSpouse(app.id, members);
    const father = head.gender === "male" ? head : spouse;
    const mother = head.gender === "female" ? head : spouse;
    const kids = members.filter((m) => {
      if (!approvedIds.has(m.application_id) || m.application_id !== app.id) return false;
      if (m.relationship === "wife" || m.relationship === "husband") return false;
      const age = calcAge(m.birth_date);
      return typeof age === "number" && age >= minAge && age <= maxAge;
    });
    for (const k of kids) {
      ws.addRow([
        i++,
        v(k.full_name), v(k.national_id), calcAge(k.birth_date), v(k.birth_date),
        k.gender === "male" ? "ذكر" : k.gender === "female" ? "أنثى" : NA,
        v(k.chronic_diseases), bool(k.is_war_injured), bool(k.is_special_needs),
        father ? v((father as any).full_name) : NA,
        father ? v((father as any).national_id) : NA,
        father ? v((father as any).phone) : NA,
        father ? v((father as any).alt_phone) : NA,
        mother ? v((mother as any).full_name) : NA,
        mother ? v((mother as any).national_id) : NA,
        v(app.original_residence), v(app.current_camp), v(app.current_landmark),
      ]);
    }
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `الأطفال_${minAge}-${maxAge}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** ذوو الاحتياجات الخاصة (همم) */
export async function exportSpecialNeeds() {
  const { apps, profiles, members } = await fetchApprovedDataset();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ذوو الهمم");
  const headers = [
    "م", "الاسم", "رقم الهوية", "العمر", "تاريخ الميلاد", "الجنس",
    "صلة القرابة", "أمراض مزمنة", "مصاب حرب",
    "اسم رب الأسرة", "جوال رب الأسرة", "المخيم الحالي",
  ];
  styleSheet(ws, headers);
  let i = 1;
  for (const app of apps) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    if (head.is_special_needs) {
      ws.addRow([
        i++, v(head.full_name), v(head.national_id), calcAge(head.birth_date), v(head.birth_date),
        head.gender === "male" ? "ذكر" : "أنثى", "رب الأسرة",
        v(head.chronic_diseases), bool(head.is_war_injured),
        v(head.full_name), v(head.phone), v(app.current_camp),
      ]);
    }
    const sn = members.filter((m) => m.application_id === app.id && m.is_special_needs);
    for (const m of sn) {
      ws.addRow([
        i++, v(m.full_name), v(m.national_id), calcAge(m.birth_date), v(m.birth_date),
        m.gender === "male" ? "ذكر" : "أنثى", v(m.relationship),
        v(m.chronic_diseases), bool(m.is_war_injured),
        v(head.full_name), v(head.phone), v(app.current_camp),
      ]);
    }
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `ذوو_الهمم_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ============================================================================
 *  محرك التصدير الذكي (Excel Wizard Engine)
 *  بناء قوالب ديناميكية: أعمدة قابلة للاختيار + أعمدة حسابية + فلاتر متقدمة.
 * ==========================================================================*/

export interface Dataset {
  apps: Application[];
  profiles: Profile[];
  members: FamilyMember[];
}

/** جلب جميع البيانات (كل الحالات) مع تخزين محلي للعمل دون اتصال. */
export async function fetchDataset(): Promise<Dataset> {
  const cacheKey = "excel:full-dataset";
  try {
    const [{ data: apps, error: e1 }, { data: profiles, error: e2 }, { data: members, error: e3 }, { data: roster }] =
      await Promise.all([
        supabase.from("applications").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("family_members").select("*"),
        supabase.from("camp_roster").select("national_id, status").eq("status", "removed"),
      ]);
    if (e1 || e2 || e3) throw e1 || e2 || e3;
    // Exclude families whose head national_id was removed from the camp roster.
    const removed = new Set((roster || []).map((r: any) => r.national_id));
    const profileNid = new Map((profiles || []).map((p: any) => [p.id, p.national_id]));
    const excludedAppIds = new Set(
      (apps || []).filter((a: any) => removed.has(profileNid.get(a.user_id))).map((a: any) => a.id),
    );
    const dataset: Dataset = {
      apps: ((apps || []) as Application[]).filter((a) => !excludedAppIds.has(a.id)),
      profiles: (profiles || []) as Profile[],
      members: ((members || []) as FamilyMember[]).filter((m) => !excludedAppIds.has((m as any).application_id)),
    };
    await cacheSet(cacheKey, dataset);
    return dataset;
  } catch (e) {
    const cached = await cacheGet<Dataset>(cacheKey);
    if (cached) return cached;
    throw e;
  }
}


/* ---------- قواميس الترجمة ---------- */
const G = (g?: string | null) => (g === "male" ? "ذكر" : g === "female" ? "أنثى" : NA);

const MARITAL_AR: Record<string, string> = {
  single: "أعزب/عزباء",
  married: "متزوج/ة",
  divorced: "مطلق/ة",
  widow: "أرمل/ة",
  widowed: "أرمل/ة",
  separated: "منفصل/ة",
};
const maritalAr = (s?: string | null) => (s ? MARITAL_AR[s] || s : NA);

const REL_AR: Record<string, string> = {
  son: "ابن",
  daughter: "ابنة",
  wife: "زوجة",
  husband: "زوج",
  brother: "أخ",
  sister: "أخت",
  father: "أب",
  mother: "أم",
  grandfather: "جد",
  grandmother: "جدة",
  other: "أخرى",
};
const relAr = (s?: string | null) => (s ? REL_AR[s] || s : NA);

const isWidow = (head?: Profile | null) =>
  !!head && (head.marital_status === "widow" || head.marital_status === "widowed");

function isOrphan(m: FamilyMember, app: Application): boolean {
  if (!app.has_martyr) return false;
  if (m.relationship === "wife" || m.relationship === "husband") return false;
  const age = calcAge(m.birth_date);
  return typeof age === "number" && age < 18;
}

/* ---------- كتالوج الأعمدة ---------- */
export interface ColDef {
  key: string;
  label: string;
}

type FamilyCtx = { app: Application; head: Profile; spouse: FamilyMember | null; fam: FamilyMember[] };
type MemberCtx = { m: FamilyMember; app: Application; head: Profile; spouse?: FamilyMember | null };

/** اسم المخيم دائماً بالعربية الكاملة "بركة 2". */
const campAr = (c?: string | null): string => {
  if (!c) return "بركة 2";
  const s = String(c).trim().toLowerCase();
  if (s.includes("baraka") || s.includes("بركة") || s === "2") return "بركة 2";
  return c;
};

/** الحالة الصحية مجمّعة في نص واحد واضح. */
function healthStatus(p: {
  is_war_injured?: boolean | null;
  chronic_diseases?: string | null;
  is_special_needs?: boolean | null;
  is_pregnant?: boolean | null;
  is_breastfeeding?: boolean | null;
}): string {
  const parts: string[] = [];
  if (p.is_war_injured) parts.push("مصاب حرب");
  if (p.chronic_diseases && String(p.chronic_diseases).trim() !== "")
    parts.push(`مرض مزمن: ${p.chronic_diseases}`);
  if (p.is_special_needs) parts.push("ذوي همم");
  if (p.is_pregnant) parts.push("حامل");
  if (p.is_breastfeeding) parts.push("مرضعة");
  return parts.length ? parts.join("، ") : "سليم";
}

const FAMILY_GETTERS: Record<string, (c: FamilyCtx) => any> = {
  head_name: (c) => v(c.head.full_name),
  national_id: (c) => v(c.head.national_id),
  head_gender: (c) => G(c.head.gender),
  head_age: (c) => calcAge(c.head.birth_date),
  head_birth: (c) => v(c.head.birth_date),
  marital_status: (c) => maritalAr(c.head.marital_status),
  phone: (c) => v(c.head.phone),
  alt_phone: (c) => v(c.head.alt_phone),
  chronic: (c) => v(c.head.chronic_diseases),
  war_injured: (c) => bool(c.head.is_war_injured),
  special_needs: (c) => bool(c.head.is_special_needs),
  spouse_name: (c) => (c.spouse ? v(c.spouse.full_name) : NA),
  spouse_nid: (c) => (c.spouse ? v(c.spouse.national_id) : NA),
  spouse_gender: (c) => (c.spouse ? G(c.spouse.gender) : NA),
  spouse_age: (c) => (c.spouse ? calcAge(c.spouse.birth_date) : NA),
  spouse_birth: (c) => (c.spouse ? v(c.spouse.birth_date) : NA),
  spouse_chronic: (c) => (c.spouse ? v(c.spouse.chronic_diseases) : NA),
  spouse_war_injured: (c) => (c.spouse ? bool(c.spouse.is_war_injured) : NA),
  spouse_special_needs: (c) => (c.spouse ? bool(c.spouse.is_special_needs) : NA),
  spouse_preg: (c) => (c.spouse ? pregBreast(c.spouse) : NA),
  family_size: (c) => c.app.family_size ?? ZERO,
  children_count: (c) =>
    c.fam.filter((m) => m.relationship !== "wife" && m.relationship !== "husband").length,
  original_residence: (c) => v(c.app.original_residence),
  original_landmark: (c) => v(c.app.original_landmark),
  current_camp: (c) => v(c.app.current_camp),
  current_landmark: (c) => v(c.app.current_landmark),
  has_martyr: (c) => bool(c.app.has_martyr),
  martyr_name: (c) => v(c.app.martyr_name),
  status: (c) => statusAr(c.app.status),
};

export const FAMILY_COLS: ColDef[] = [
  { key: "head_name", label: "اسم رب الأسرة" },
  { key: "national_id", label: "رقم هوية رب الأسرة" },
  { key: "head_gender", label: "الجنس" },
  { key: "head_age", label: "العمر" },
  { key: "head_birth", label: "تاريخ الميلاد" },
  { key: "marital_status", label: "الحالة الاجتماعية" },
  { key: "phone", label: "الجوال" },
  { key: "alt_phone", label: "الجوال البديل" },
  { key: "chronic", label: "أمراض مزمنة" },
  { key: "war_injured", label: "مصاب حرب" },
  { key: "special_needs", label: "ذوي همم" },
  { key: "spouse_name", label: "اسم الزوج/ة" },
  { key: "spouse_nid", label: "هوية الزوج/ة" },
  { key: "spouse_gender", label: "جنس الزوج/ة" },
  { key: "spouse_age", label: "عمر الزوج/ة" },
  { key: "spouse_birth", label: "تاريخ ميلاد الزوج/ة" },
  { key: "spouse_chronic", label: "أمراض مزمنة (الزوج/ة)" },
  { key: "spouse_war_injured", label: "مصاب حرب (الزوج/ة)" },
  { key: "spouse_special_needs", label: "ذوي همم (الزوج/ة)" },
  { key: "spouse_preg", label: "حامل/مرضعة (الزوجة)" },
  { key: "family_size", label: "عدد الأفراد" },
  { key: "children_count", label: "عدد الأبناء" },
  { key: "original_residence", label: "السكن الأصلي" },
  { key: "original_landmark", label: "أقرب معلم أصلي" },
  { key: "current_camp", label: "المخيم/مكان الإيواء" },
  { key: "current_landmark", label: "المعلم الحالي" },
  { key: "has_martyr", label: "يوجد شهيد" },
  { key: "martyr_name", label: "اسم الشهيد" },
  { key: "status", label: "حالة الطلب" },
];

const MEMBER_GETTERS: Record<string, (c: MemberCtx) => any> = {
  member_name: (c) => v(c.m.full_name),
  national_id: (c) => v(c.m.national_id),
  gender: (c) => G(c.m.gender),
  age: (c) => calcAge(c.m.birth_date),
  birth: (c) => v(c.m.birth_date),
  relationship: (c) => relAr(c.m.relationship),
  chronic: (c) => v(c.m.chronic_diseases),
  war_injured: (c) => bool(c.m.is_war_injured),
  special_needs: (c) => bool(c.m.is_special_needs),
  preg_breast: (c) => pregBreast(c.m),
  orphan: (c) => bool(isOrphan(c.m, c.app)),
  father_martyr: (c) => bool(c.app.has_martyr),
  martyr_name: (c) => v(c.app.martyr_name),
  head_name: (c) => v(c.head.full_name),
  head_nid: (c) => v(c.head.national_id),
  head_phone: (c) => v(c.head.phone),
  current_camp: (c) => v(c.app.current_camp),
  current_landmark: (c) => v(c.app.current_landmark),
  // ---- أعمدة تقرير الأفراد ----
  health_status: (c) => healthStatus(c.m),
  father_name: (c) => {
    const father = c.head.gender === "male" ? c.head : c.spouse;
    return father ? v((father as any).full_name) : NA;
  },
  father_nid: (c) => {
    const father = c.head.gender === "male" ? c.head : c.spouse;
    return father ? v((father as any).national_id) : NA;
  },
  contact_phone: (c) => v(c.head.phone),
  contact_alt_phone: (c) => v(c.head.alt_phone),
  original_residence: (c) => v(c.app.original_residence),
  current_residence: (c) => campAr(c.app.current_camp),
  camp_name: () => "بركة 2",
};

export const MEMBER_COLS: ColDef[] = [
  { key: "member_name", label: "اسم الفرد" },
  { key: "national_id", label: "رقم الهوية" },
  { key: "gender", label: "الجنس" },
  { key: "age", label: "العمر" },
  { key: "birth", label: "تاريخ الميلاد" },
  { key: "relationship", label: "صلة القرابة" },
  { key: "chronic", label: "أمراض مزمنة" },
  { key: "war_injured", label: "مصاب" },
  { key: "special_needs", label: "ذوي همم" },
  { key: "preg_breast", label: "حامل/مرضعة" },
  { key: "orphan", label: "يتيم" },
  { key: "father_martyr", label: "استشهاد الأب" },
  { key: "martyr_name", label: "اسم الشهيد" },
  { key: "head_name", label: "اسم المعيل" },
  { key: "head_nid", label: "هوية المعيل" },
  { key: "head_phone", label: "جوال المعيل" },
  { key: "current_camp", label: "المخيم/مكان الإيواء" },
  { key: "current_landmark", label: "المعلم الحالي" },
  { key: "health_status", label: "الحالة الصحية" },
  { key: "father_name", label: "اسم الأب" },
  { key: "father_nid", label: "رقم هوية الأب" },
  { key: "contact_phone", label: "رقم التواصل" },
  { key: "contact_alt_phone", label: "رقم التواصل البديل" },
  { key: "original_residence", label: "مكان السكن الأصلي" },
  { key: "current_residence", label: "مكان السكن الحالي" },
  { key: "camp_name", label: "اسم المخيم" },
];

const STATUS_AR: Record<string, string> = {
  approved: "مقبول",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
};
const statusAr = (s?: string | null) => (s ? STATUS_AR[s] || s : NA);

/* ---------- الأعمدة الحسابية ---------- */
export type PersonFlag = "pregnant" | "breastfeeding" | "war_injured" | "chronic" | "special_needs";
export interface ComputedCol {
  id: string;
  label: string;
  gender?: "all" | "male" | "female";
  ageMin?: number | null;
  ageMax?: number | null;
  flags?: PersonFlag[];
}

export const COMPUTED_PRESETS: ComputedCol[] = [
  // ---- الفئات العمرية (الجنسان معاً) ----
  { id: "kids_0_2_all", label: "رُضّع (0-2) — الكل", gender: "all", ageMin: 0, ageMax: 2 },
  { id: "kids_0_5_all", label: "أطفال (0-5) — الكل", gender: "all", ageMin: 0, ageMax: 5 },
  { id: "kids_6_12_all", label: "أطفال (6-12) — الكل", gender: "all", ageMin: 6, ageMax: 12 },
  { id: "teens_13_17_all", label: "مراهقون (13-17) — الكل", gender: "all", ageMin: 13, ageMax: 17 },
  { id: "students_6_18_all", label: "طلاب (6-18) — الكل", gender: "all", ageMin: 6, ageMax: 18 },
  { id: "adults_18_59_all", label: "بالغون (18-59) — الكل", gender: "all", ageMin: 18, ageMax: 59 },
  { id: "elderly_60_all", label: "كبار السن (60+) — الكل", gender: "all", ageMin: 60, ageMax: null },
  // ---- الذكور حسب الفئات العمرية ----
  { id: "kids_0_5_m", label: "ذكور (0-5)", gender: "male", ageMin: 0, ageMax: 5 },
  { id: "kids_6_12_m", label: "ذكور (6-12)", gender: "male", ageMin: 6, ageMax: 12 },
  { id: "teens_13_17_m", label: "ذكور (13-17)", gender: "male", ageMin: 13, ageMax: 17 },
  { id: "adult_male", label: "ذكور بالغون (18+)", gender: "male", ageMin: 18, ageMax: null },
  { id: "elderly_male", label: "ذكور كبار السن (60+)", gender: "male", ageMin: 60, ageMax: null },
  // ---- الإناث حسب الفئات العمرية ----
  { id: "kids_0_5_f", label: "إناث (0-5)", gender: "female", ageMin: 0, ageMax: 5 },
  { id: "kids_6_12_f", label: "إناث (6-12)", gender: "female", ageMin: 6, ageMax: 12 },
  { id: "teens_13_17_f", label: "إناث (13-17)", gender: "female", ageMin: 13, ageMax: 17 },
  { id: "adult_female", label: "إناث بالغات (18+)", gender: "female", ageMin: 18, ageMax: null },
  { id: "elderly_female", label: "إناث كبار السن (60+)", gender: "female", ageMin: 60, ageMax: null },
  // ---- الإجمالي حسب الجنس ----
  { id: "total_male", label: "إجمالي الذكور", gender: "male" },
  { id: "total_female", label: "إجمالي الإناث", gender: "female" },
  // ---- الحالات الصحية والخاصة ----
  { id: "pregnant", label: "عدد الحوامل", gender: "female", flags: ["pregnant"] },
  { id: "breastfeeding", label: "عدد المرضعات", gender: "female", flags: ["breastfeeding"] },
  { id: "injured", label: "عدد المصابين", flags: ["war_injured"] },
  { id: "chronic", label: "أصحاب الأمراض المزمنة", flags: ["chronic"] },
  { id: "special", label: "ذوو الهمم", flags: ["special_needs"] },
];

interface Person {
  gender?: string | null;
  birth_date?: string | null;
  is_pregnant?: boolean;
  is_breastfeeding?: boolean;
  is_war_injured?: boolean;
  chronic_diseases?: string | null;
  is_special_needs?: boolean;
}

function matchPerson(p: Person, cc: ComputedCol): boolean {
  if (cc.gender && cc.gender !== "all" && p.gender !== cc.gender) return false;
  const age = calcAge(p.birth_date);
  if (cc.ageMin != null && (typeof age !== "number" || age < cc.ageMin)) return false;
  if (cc.ageMax != null && (typeof age !== "number" || age > cc.ageMax)) return false;
  for (const f of cc.flags || []) {
    if (f === "pregnant" && !p.is_pregnant) return false;
    if (f === "breastfeeding" && !p.is_breastfeeding) return false;
    if (f === "war_injured" && !p.is_war_injured) return false;
    if (f === "special_needs" && !p.is_special_needs) return false;
    if (f === "chronic" && !(p.chronic_diseases && p.chronic_diseases !== "")) return false;
  }
  return true;
}

/* ---------- إعدادات التصدير ---------- */
export type Entity = "family" | "member";
export type MemberKind = "orphan" | "injured" | "chronic" | "preg_breast" | "special_needs";

export interface ExportConfig {
  title: string;
  entity: Entity;
  columns: string[];
  computed: ComputedCol[];
  filters: {
    camp?: string | null;
    status?: "approved" | "pending" | "rejected" | "all";
    ageMin?: number | null;
    ageMax?: number | null;
    maritalWidow?: boolean;
    femaleBreadwinner?: boolean;
    hasMartyr?: boolean;
    memberKinds?: MemberKind[];
    familySizeMin?: number | null;
    familySizeMax?: number | null;
  };
}

export function listCamps(ds: Dataset): string[] {
  const set = new Set<string>();
  for (const a of ds.apps) if (a.current_camp) set.add(a.current_camp);
  return Array.from(set).sort();
}

/** بناء الرؤوس والصفوف وفق الإعدادات. */
export function buildExport(ds: Dataset, cfg: ExportConfig): { headers: string[]; rows: any[][] } {
  const { apps, profiles, members } = ds;
  const f = cfg.filters;

  let pool = apps.slice();
  if (f.status && f.status !== "all") pool = pool.filter((a) => a.status === f.status);
  if (f.camp) pool = pool.filter((a) => a.current_camp === f.camp);
  if (f.hasMartyr) pool = pool.filter((a) => a.has_martyr);
  if (f.femaleBreadwinner || f.maritalWidow) {
    pool = pool.filter((a) => {
      const head = profiles.find((p) => p.id === a.user_id);
      return (f.femaleBreadwinner && a.is_female_breadwinner) || (f.maritalWidow && isWidow(head));
    });
  }
  if (f.familySizeMin != null) pool = pool.filter((a) => (a.family_size ?? 0) >= f.familySizeMin!);
  if (f.familySizeMax != null) pool = pool.filter((a) => (a.family_size ?? 0) <= f.familySizeMax!);

  if (cfg.entity === "family") {
    const colDefs = cfg.columns
      .map((k) => FAMILY_COLS.find((c) => c.key === k))
      .filter(Boolean) as ColDef[];
    const headers = ["م", ...colDefs.map((c) => c.label), ...cfg.computed.map((c) => c.label)];
    const rows: any[][] = [];
    let i = 1;
    for (const app of pool) {
      const head = profiles.find((p) => p.id === app.user_id);
      if (!head) continue;
      const spouse = findSpouse(app.id, members);
      const fam = members.filter((m) => m.application_id === app.id);
      const ctx: FamilyCtx = { app, head, spouse, fam };
      const people: Person[] = [
        {
          gender: head.gender,
          birth_date: head.birth_date,
          is_war_injured: head.is_war_injured,
          chronic_diseases: head.chronic_diseases,
          is_special_needs: head.is_special_needs,
        },
        ...fam,
      ];
      const row: any[] = [i++, ...colDefs.map((c) => FAMILY_GETTERS[c.key](ctx))];
      for (const cc of cfg.computed) row.push(people.filter((p) => matchPerson(p, cc)).length);
      rows.push(row);
    }
    return { headers, rows };
  }

  // entity === "member"
  const colDefs = cfg.columns
    .map((k) => MEMBER_COLS.find((c) => c.key === k))
    .filter(Boolean) as ColDef[];
  const headers = ["م", ...colDefs.map((c) => c.label)];
  const rows: any[][] = [];
  let i = 1;
  const kinds = f.memberKinds || [];
  for (const app of pool) {
    const head = profiles.find((p) => p.id === app.user_id);
    if (!head) continue;
    const fam = members.filter((m) => m.application_id === app.id);
    for (const m of fam) {
      const age = calcAge(m.birth_date);
      if (f.ageMin != null && (typeof age !== "number" || age < f.ageMin)) continue;
      if (f.ageMax != null && (typeof age !== "number" || age > f.ageMax)) continue;
      if (kinds.length) {
        const ok = kinds.some((k) => {
          if (k === "orphan") return isOrphan(m, app);
          if (k === "injured") return !!m.is_war_injured;
          if (k === "chronic") return !!(m.chronic_diseases && m.chronic_diseases !== "");
          if (k === "preg_breast") return !!(m.is_pregnant || m.is_breastfeeding);
          if (k === "special_needs") return !!m.is_special_needs;
          return false;
        });
        if (!ok) continue;
      }
      rows.push([i++, ...colDefs.map((c) => MEMBER_GETTERS[c.key]({ m, app, head }))]);
    }
  }
  return { headers, rows };
}

/** التحقق من إعدادات التصدير قبل التنفيذ. يُعيد قائمة بالمشاكل (فارغة = سليم). */
export function validateConfig(cfg: ExportConfig): string[] {
  const errors: string[] = [];
  // 1) يجب اختيار عمود واحد على الأقل
  if (!cfg.columns || cfg.columns.length === 0) {
    errors.push("لم يتم اختيار أي عمود للتصدير — اختر عموداً واحداً على الأقل.");
  }
  // 2) التأكد أن الأعمدة المختارة معرّفة فعلاً ضمن الكيان الحالي
  const catalog = cfg.entity === "family" ? FAMILY_COLS : MEMBER_COLS;
  const known = new Set(catalog.map((c) => c.key));
  const unknown = cfg.columns.filter((k) => !known.has(k));
  if (unknown.length) {
    errors.push(`أعمدة غير صالحة لنوع التقرير الحالي: ${unknown.join("، ")}`);
  }
  // 3) الأعمدة الحسابية متاحة فقط لتقارير العائلات
  if (cfg.entity !== "family" && cfg.computed.length > 0) {
    errors.push("الأعمدة الحسابية متاحة فقط في تقرير العائلات — أزلها أو بدّل نوع التقرير.");
  }
  // 4) كشف تعارض الأعمدة الحسابية (تكرار نفس التسمية أو نفس الشرط)
  const seenLabels = new Set<string>();
  const seenSig = new Set<string>();
  for (const cc of cfg.computed) {
    if (seenLabels.has(cc.label)) {
      errors.push(`عمود حسابي مكرّر بنفس الاسم: «${cc.label}»`);
    }
    seenLabels.add(cc.label);
    const sig = `${cc.gender || "all"}|${cc.ageMin ?? ""}|${cc.ageMax ?? ""}|${(cc.flags || []).slice().sort().join(",")}`;
    if (seenSig.has(sig)) {
      errors.push(`عمودان حسابيان بنفس الشرط (تعارض): «${cc.label}»`);
    }
    seenSig.add(sig);
    // نطاق عمري غير منطقي
    if (cc.ageMin != null && cc.ageMax != null && cc.ageMin > cc.ageMax) {
      errors.push(`نطاق عمري غير صحيح في «${cc.label}» (الحد الأدنى أكبر من الأقصى).`);
    }
  }
  // 5) نطاق الفلتر العمري
  const { ageMin, ageMax } = cfg.filters;
  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    errors.push("نطاق العمر في الفلاتر غير صحيح (الحد الأدنى أكبر من الأقصى).");
  }
  // 6) نطاق عدد الأفراد
  const { familySizeMin, familySizeMax } = cfg.filters;
  if (familySizeMin != null && familySizeMax != null && familySizeMin > familySizeMax) {
    errors.push("نطاق عدد الأفراد غير صحيح (الحد الأدنى أكبر من الأقصى).");
  }
  return errors;
}

/** توليد ملف XLSX منسق احترافياً من نتيجة البناء. */
export async function generateWorkbook(title: string, headers: string[], rows: any[][]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Baraka 2";
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 30) || "تقرير");
  styleSheet(ws, headers);

  // الأعمدة التي تمثل تواريخ (لتنسيقها بصيغة عربية RTL: يوم/شهر/سنة)
  const dateCols = headers
    .map((h, i) => (h.includes("تاريخ") || h.includes("ميلاد") ? i + 1 : -1))
    .filter((i) => i > 0);

  for (const r of rows) {
    const added = ws.addRow(r);
    for (const ci of dateCols) {
      const cell = added.getCell(ci);
      const raw = cell.value;
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          cell.value = d;
          cell.numFmt = "dd/mm/yyyy";
        }
      }
    }
  }
  applyRowStyles(ws, 3, headers.length);
  await saveWorkbook(wb, `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** تشغيل التصدير الكامل: تحقق + جلب + بناء + تنزيل. */
export async function runWizardExport(cfg: ExportConfig) {
  const problems = validateConfig(cfg);
  if (problems.length) throw new Error(problems.join("\n"));
  const ds = await fetchDataset();
  const { headers, rows } = buildExport(ds, cfg);
  if (!rows.length) throw new Error("لا توجد بيانات مطابقة للفلاتر المحددة");
  await generateWorkbook(cfg.title, headers, rows);
  return rows.length;
}

/* ---------- القوالب الجاهزة ---------- */
export interface Preset {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  config: ExportConfig;
}

export const PRESETS: Preset[] = [
  {
    id: "aid",
    label: "توزيع المساعدات",
    emoji: "📦",
    desc: "الاسم، الهوية، الجوال، عدد الأفراد، المخيم",
    config: {
      title: "كشف توزيع المساعدات",
      entity: "family",
      columns: ["head_name", "national_id", "phone", "family_size", "current_camp"],
      computed: [],
      filters: { status: "approved" },
    },
  },
  {
    id: "widows",
    label: "الأرامل وأسرهن",
    emoji: "🤲",
    desc: "العائلات التي يعيلها أرمل/أرملة",
    config: {
      title: "كشف الأرامل والمعيلات",
      entity: "family",
      columns: ["head_name", "national_id", "head_age", "phone", "family_size", "children_count", "current_camp"],
      computed: [{ id: "kids_0_5", label: "أطفال (0-5)", gender: "all", ageMin: 0, ageMax: 5 }],
      filters: { status: "approved", maritalWidow: true, femaleBreadwinner: true },
    },
  },
  {
    id: "orphans",
    label: "الأيتام التفصيلي",
    emoji: "👶",
    desc: "الأطفال الأيتام مع المعيل والمخيم",
    config: {
      title: "كشف الأيتام",
      entity: "member",
      columns: ["member_name", "national_id", "gender", "age", "martyr_name", "head_name", "head_phone", "current_camp"],
      computed: [],
      filters: { status: "approved", hasMartyr: true, memberKinds: ["orphan"] },
    },
  },
  {
    id: "medical",
    label: "الحالات الطبية والمصابين",
    emoji: "🏥",
    desc: "الجرحى وأصحاب الأمراض والتواصل",
    config: {
      title: "كشف الحالات الطبية",
      entity: "member",
      columns: ["member_name", "national_id", "age", "relationship", "war_injured", "chronic", "head_phone", "current_camp"],
      computed: [],
      filters: { status: "approved", memberKinds: ["injured", "chronic"] },
    },
  },
  {
    id: "maternity",
    label: "الحوامل والمرضعات",
    emoji: "🤰",
    desc: "النساء بحاجة لرعاية أمومة",
    config: {
      title: "كشف الحوامل والمرضعات",
      entity: "member",
      columns: ["member_name", "national_id", "age", "preg_breast", "head_name", "head_phone", "current_camp"],
      computed: [],
      filters: { status: "approved", memberKinds: ["preg_breast"] },
    },
  },
  {
    id: "clothes",
    label: "ملابس الأطفال",
    emoji: "🧒",
    desc: "الأعمار من 0 إلى 12",
    config: {
      title: "كشف ملابس الأطفال",
      entity: "member",
      columns: ["member_name", "gender", "age", "relationship", "head_name", "head_phone", "current_camp"],
      computed: [],
      filters: { status: "approved", ageMin: 0, ageMax: 12 },
    },
  },
  {
    id: "students",
    label: "طلاب المدارس",
    emoji: "🎒",
    desc: "الأعمار من 6 إلى 18",
    config: {
      title: "كشف طلاب المدارس",
      entity: "member",
      columns: ["member_name", "gender", "age", "relationship", "head_name", "head_phone", "current_camp"],
      computed: [],
      filters: { status: "approved", ageMin: 6, ageMax: 18 },
    },
  },
  {
    id: "martyrs",
    label: "أسر الشهداء",
    emoji: "🕊️",
    desc: "العائلات التي بها شهيد",
    config: {
      title: "كشف أسر الشهداء",
      entity: "family",
      columns: ["head_name", "national_id", "phone", "martyr_name", "family_size", "children_count", "current_camp"],
      computed: [],
      filters: { status: "approved", hasMartyr: true },
    },
  },
  {
    id: "males_by_age",
    label: "الذكور حسب الأعمار",
    emoji: "👦",
    desc: "إحصاء الذكور لكل أسرة حسب الفئات العمرية",
    config: {
      title: "تقرير الذكور حسب الفئات العمرية",
      entity: "family",
      columns: ["head_name", "national_id", "phone", "family_size", "current_camp"],
      computed: [
        { id: "kids_0_5_m", label: "ذكور (0-5)", gender: "male", ageMin: 0, ageMax: 5 },
        { id: "kids_6_12_m", label: "ذكور (6-12)", gender: "male", ageMin: 6, ageMax: 12 },
        { id: "teens_13_17_m", label: "ذكور (13-17)", gender: "male", ageMin: 13, ageMax: 17 },
        { id: "adult_male", label: "ذكور بالغون (18+)", gender: "male", ageMin: 18, ageMax: null },
        { id: "total_male", label: "إجمالي الذكور", gender: "male" },
      ],
      filters: { status: "approved" },
    },
  },
  {
    id: "females_by_age",
    label: "الإناث حسب الأعمار",
    emoji: "👧",
    desc: "إحصاء الإناث لكل أسرة حسب الفئات العمرية",
    config: {
      title: "تقرير الإناث حسب الفئات العمرية",
      entity: "family",
      columns: ["head_name", "national_id", "phone", "family_size", "current_camp"],
      computed: [
        { id: "kids_0_5_f", label: "إناث (0-5)", gender: "female", ageMin: 0, ageMax: 5 },
        { id: "kids_6_12_f", label: "إناث (6-12)", gender: "female", ageMin: 6, ageMax: 12 },
        { id: "teens_13_17_f", label: "إناث (13-17)", gender: "female", ageMin: 13, ageMax: 17 },
        { id: "adult_female", label: "إناث بالغات (18+)", gender: "female", ageMin: 18, ageMax: null },
        { id: "total_female", label: "إجمالي الإناث", gender: "female" },
      ],
      filters: { status: "approved" },
    },
  },
  {
    id: "special_by_camp",
    label: "ذوو الهمم حسب المخيم",
    emoji: "♿",
    desc: "أفراد ذوو الاحتياجات الخاصة مرتّبون بالمخيم",
    config: {
      title: "كشف ذوي الهمم حسب المخيم",
      entity: "member",
      columns: ["current_camp", "member_name", "national_id", "gender", "age", "relationship", "chronic", "head_name", "head_phone"],
      computed: [],
      filters: { status: "approved", memberKinds: ["special_needs"] },
    },
  },
];
