/**
 * تصدير احترافي: ملف واحد بعدة أوراق (ملخص وإحصائيات + الأسر + الأفراد + الشكاوى)
 * وجدولة تصدير تلقائي محلية للإدارة.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { fetchDataset, ageParts, hasChronic, type Dataset } from "./excelExport";

const NA = "لا يوجد";
const ORANGE = "FFEA580C";
const DARK = "FF7C2D12";
const v = (x: any) => (x === null || x === undefined || x === "" ? NA : x);
const yn = (b: any) => (b ? "نعم" : "لا");
const G = (g?: string | null) => (g === "male" ? "ذكر" : g === "female" ? "أنثى" : NA);
const REL: Record<string, string> = { son: "ابن", daughter: "ابنة", wife: "زوجة", husband: "زوج", father: "أب", mother: "أم", brother: "أخ", sister: "أخت", other: "أخرى" };
const STATUS: Record<string, string> = { approved: "مقبول", pending: "قيد المراجعة", rejected: "مرفوض" };

export interface Stats {
  families: number; persons: number; males: number; females: number;
  ageBands: { label: string; count: number }[];
  health: { label: string; count: number }[];
  status: { label: string; count: number }[];
  students: number; widows: number; martyrs: number;
}

export function computeStats(ds: Dataset): Stats {
  const pById = new Map(ds.profiles.map((p) => [p.id, p]));
  const persons: { birth: string; gender: string; war?: boolean; special?: boolean; chronic?: string | null; preg?: boolean; student?: boolean }[] = [];
  for (const a of ds.apps) {
    const h: any = pById.get(a.user_id);
    if (h) persons.push({ birth: h.birth_date, gender: h.gender, war: h.is_war_injured, special: h.is_special_needs, chronic: h.chronic_diseases, student: h.is_university_student });
    for (const m of ds.members as any[]) if (m.application_id === a.id && !m.is_head)
      persons.push({ birth: m.birth_date, gender: m.gender, war: m.is_war_injured, special: m.is_special_needs, chronic: m.chronic_diseases, preg: m.is_pregnant, student: m.is_university_student });
  }
  const bands = [
    { label: "أقل من سنتين", min: 0, max: 1 }, { label: "2 - 5 سنوات", min: 2, max: 5 },
    { label: "6 - 12 سنة", min: 6, max: 12 }, { label: "13 - 17 سنة", min: 13, max: 17 },
    { label: "18 - 59 سنة", min: 18, max: 59 }, { label: "60 سنة فأكثر", min: 60, max: 200 },
  ];
  const ageBands = bands.map((b) => ({ label: b.label, count: persons.filter((p) => { const a = ageParts(p.birth); return a && a.years >= b.min && a.years <= b.max; }).length }));
  const statusCount = (s: string) => ds.apps.filter((a) => a.status === s).length;
  return {
    families: ds.apps.length,
    persons: persons.length,
    males: persons.filter((p) => p.gender === "male").length,
    females: persons.filter((p) => p.gender === "female").length,
    ageBands,
    health: [
      { label: "مصاب حرب", count: persons.filter((p) => p.war).length },
      { label: "أمراض مزمنة", count: persons.filter((p) => hasChronic(p.chronic)).length },
      { label: "ذوي همم", count: persons.filter((p) => p.special).length },
      { label: "حوامل", count: persons.filter((p) => p.preg).length },
    ],
    status: [
      { label: "مقبول", count: statusCount("approved") },
      { label: "قيد المراجعة", count: statusCount("pending") },
      { label: "مرفوض", count: statusCount("rejected") },
    ],
    students: persons.filter((p) => p.student).length,
    widows: ds.apps.filter((a) => { const h: any = pById.get(a.user_id); return h && (h.marital_status === "widowed" || h.marital_status === "widow"); }).length,
    martyrs: ds.apps.filter((a) => a.has_martyr).length,
  };
}

function header(ws: ExcelJS.Worksheet, title: string, headers: string[]) {
  ws.views = [{ rightToLeft: true, showGridLines: false, state: "frozen", ySplit: 3 } as any];
  ws.mergeCells(1, 1, 1, headers.length);
  const t = ws.getCell(1, 1);
  t.value = `مخيم بركة 2 — ${title}`;
  t.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 34;
  ws.mergeCells(2, 1, 2, headers.length);
  const s = ws.getCell(2, 1);
  s.value = `تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}`;
  s.font = { name: "Arial", size: 10, italic: true, color: { argb: DARK } };
  s.alignment = { horizontal: "center" };
  const hr = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  hr.height = 28;
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };
}

function body(ws: ExcelJS.Worksheet, rows: any[][], cols: number) {
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.height = 20;
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 ? "FFFFFFFF" : "FFFFF7ED" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFFED7AA" } } };
    }
  });
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell, rn) => { if (rn > 2) max = Math.max(max, String(cell.value ?? "").length); });
    col.width = Math.min(max + 3, 38);
  });
}

function statBlock(ws: ExcelJS.Worksheet, startRow: number, title: string, items: { label: string; count: number }[]) {
  ws.mergeCells(startRow, 1, startRow, 3);
  const t = ws.getCell(startRow, 1);
  t.value = title;
  t.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  t.alignment = { horizontal: "center" };
  const hdr = ws.getRow(startRow + 1);
  ["البند", "العدد", "النسبة"].forEach((h, i) => {
    const c = hdr.getCell(i + 1); c.value = h;
    c.font = { name: "Arial", bold: true, color: { argb: DARK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" } };
    c.alignment = { horizontal: "center" };
  });
  const first = startRow + 2;
  const last = first + items.length - 1;
  items.forEach((it, i) => {
    const r = ws.getRow(first + i);
    r.getCell(1).value = it.label;
    r.getCell(2).value = it.count;
    r.getCell(3).value = { formula: `IF(SUM($B$${first}:$B$${last})=0,0,B${first + i}/SUM($B$${first}:$B$${last}))` } as any;
    r.getCell(3).numFmt = "0.0%";
    [1, 2, 3].forEach((c) => { r.getCell(c).font = { name: "Arial" }; r.getCell(c).alignment = { horizontal: "center" }; });
  });
  // رسم بياني داخل الخلايا (أشرطة بيانات)
  ws.addConditionalFormatting({
    ref: `B${first}:B${last}`,
    rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: ORANGE } } as any],
  });
  return last + 2;
}

export async function exportMultiSheet(opts: { approvedOnly?: boolean } = {}) {
  const full = await fetchDataset();
  const ds: Dataset = opts.approvedOnly
    ? { ...full, apps: full.apps.filter((a) => a.status === "approved") }
    : full;
  const appIds = new Set(ds.apps.map((a) => a.id));
  ds.members = full.members.filter((m) => appIds.has(m.application_id));
  const pById = new Map(ds.profiles.map((p) => [p.id, p]));
  const st = computeStats(ds);

  const wb = new ExcelJS.Workbook();
  wb.creator = "مخيم بركة 2";
  wb.created = new Date();

  // 1) الملخص والإحصائيات
  const s = wb.addWorksheet("الملخص والإحصائيات", { views: [{ rightToLeft: true, showGridLines: false }] });
  s.mergeCells(1, 1, 1, 3);
  const t = s.getCell(1, 1);
  t.value = "مخيم بركة 2 — التقرير الإحصائي الشامل";
  t.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  s.getRow(1).height = 36;
  let r = 3;
  r = statBlock(s, r, "الأرقام الرئيسية", [
    { label: "عدد الأسر", count: st.families }, { label: "عدد الأفراد", count: st.persons },
    { label: "ذكور", count: st.males }, { label: "إناث", count: st.females },
    { label: "طلاب جامعيون", count: st.students }, { label: "أسر أرامل", count: st.widows }, { label: "أسر شهداء", count: st.martyrs },
  ]);
  r = statBlock(s, r, "الفئات العمرية", st.ageBands);
  r = statBlock(s, r, "الحالة الصحية", st.health);
  statBlock(s, r, "حالة الطلبات", st.status);
  s.getColumn(1).width = 26; s.getColumn(2).width = 14; s.getColumn(3).width = 12;

  // 2) الأسر
  const fh = ["رقم الأسرة", "اسم رب الأسرة", "رقم الهوية", "الجنس", "العمر", "الحالة الاجتماعية", "الجوال", "الجوال البديل", "عدد الأفراد", "السكن الأصلي", "المخيم", "المعلم القريب", "شهيد", "حالة الطلب"];
  const fw = wb.addWorksheet("الأسر");
  header(fw, "كشف الأسر", fh);
  const famRows = ds.apps
    .slice().sort((a, b) => (a.family_no ?? 1e9) - (b.family_no ?? 1e9))
    .map((a) => {
      const h: any = pById.get(a.user_id) || {};
      const cnt = ds.members.filter((m) => m.application_id === a.id && !m.is_head).length + 1;
      return [a.family_no ?? NA, v(h.full_name), v(h.national_id), G(h.gender), ageParts(h.birth_date)?.years ?? NA, v(h.marital_status),
        v(h.phone), v(h.alt_phone), cnt, v(a.original_residence), "بركة 2", v(a.current_landmark), yn(a.has_martyr), STATUS[a.status] || a.status];
    });
  body(fw, famRows, fh.length);
  fw.addRow([]);
  const tot = fw.addRow(["الإجمالي", `${famRows.length} أسرة`, "", "", "", "", "", "", { formula: `SUM(I4:I${3 + famRows.length})` }]);
  tot.font = { name: "Arial", bold: true, color: { argb: DARK } };

  // 3) الأفراد
  const mh = ["رقم الأسرة", "اسم الفرد", "رقم الهوية", "صلة القرابة", "الجنس", "تاريخ الميلاد", "العمر", "مصاب حرب", "مرض مزمن", "ذوي همم", "طالب جامعي", "رب الأسرة", "رقم هوية رب الأسرة"];
  const mw = wb.addWorksheet("الأفراد");
  header(mw, "كشف الأفراد", mh);
  const memRows: any[][] = [];
  for (const a of ds.apps) {
    const h: any = pById.get(a.user_id) || {};
    memRows.push([a.family_no ?? NA, v(h.full_name), v(h.national_id), "رب الأسرة", G(h.gender), v(h.birth_date), ageParts(h.birth_date)?.years ?? NA,
      yn(h.is_war_injured), hasChronic(h.chronic_diseases) ? h.chronic_diseases : NA, yn(h.is_special_needs), yn(h.is_university_student), v(h.full_name), v(h.national_id)]);
    for (const m of ds.members as any[]) if (m.application_id === a.id && !m.is_head)
      memRows.push([a.family_no ?? NA, v(m.full_name), v(m.national_id), REL[m.relationship] || v(m.relationship), G(m.gender), v(m.birth_date), ageParts(m.birth_date)?.years ?? NA,
        yn(m.is_war_injured), hasChronic(m.chronic_diseases) ? m.chronic_diseases : NA, yn(m.is_special_needs), yn(m.is_university_student), v(h.full_name), v(h.national_id)]);
  }
  body(mw, memRows, mh.length);

  // 4) الشكاوى والطلبات
  const { data: reqs } = await supabase.from("public_requests").select("*").order("created_at", { ascending: false });
  const rh = ["رقم التذكرة", "النوع", "الاسم", "رقم الهوية", "العنوان", "التفاصيل", "الأولوية", "الحالة", "رد الإدارة", "التاريخ"];
  const rw = wb.addWorksheet("الشكاوى والطلبات");
  header(rw, "الشكاوى وطلبات المساعدة", rh);
  const RS: Record<string, string> = { new: "جديد", in_progress: "قيد المعالجة", accepted: "مقبول", rejected: "مرفوض", closed: "مغلق" };
  body(rw, (reqs || []).map((q: any) => [q.ticket_no, q.kind === "help" ? "طلب مساعدة" : "شكوى", v(q.head_name), q.national_id, q.subject, q.body,
    q.priority, RS[q.status] || q.status, v(q.admin_reply), new Date(q.created_at).toLocaleDateString("ar-EG")]), rh.length);
  if (!reqs?.length) rw.addRow(["لا يوجد"]);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `تقرير_بركة2_الشامل_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { families: famRows.length, persons: memRows.length };
}

/* ---------- جدولة التصدير التلقائي ---------- */
export type ScheduleFreq = "off" | "daily" | "weekly" | "monthly";
const KEY = "baraka2:export-schedule";
export interface Schedule { freq: ScheduleFreq; approvedOnly: boolean; lastRun?: string }

export function getSchedule(): Schedule {
  try { return { freq: "off", approvedOnly: true, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { freq: "off", approvedOnly: true }; }
}
export function setSchedule(s: Schedule) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function markRun() { setSchedule({ ...getSchedule(), lastRun: new Date().toISOString() }); }

const DAYS: Record<ScheduleFreq, number> = { off: Infinity, daily: 1, weekly: 7, monthly: 30 };
export function isDue(s: Schedule, now = new Date()): boolean {
  if (s.freq === "off") return false;
  if (!s.lastRun) return true;
  return now.getTime() - new Date(s.lastRun).getTime() >= DAYS[s.freq] * 86400000;
}
