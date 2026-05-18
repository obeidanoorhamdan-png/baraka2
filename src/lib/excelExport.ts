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
    const [{ data: apps, error: e1 }, { data: profiles, error: e2 }, { data: members, error: e3 }] =
      await Promise.all([
        supabase.from("applications").select("*").eq("status", "approved"),
        supabase.from("profiles").select("*"),
        supabase.from("family_members").select("*"),
      ]);
    if (e1 || e2 || e3) throw e1 || e2 || e3;
    const dataset = {
      apps: (apps || []) as Application[],
      profiles: (profiles || []) as Profile[],
      members: (members || []) as FamilyMember[],
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
