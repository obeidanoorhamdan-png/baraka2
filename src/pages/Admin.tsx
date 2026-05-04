import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { CheckCircle2, XCircle, Eye, Download, Search, Users, Heart, Baby, Activity, FileSpreadsheet, Filter, Image as ImageIcon, KeyRound } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";
import { formatBirthDate, formatDateShort } from "@/lib/formatDate";
import { useConfirm } from "@/components/ConfirmDialog";
import { AidManager } from "@/components/AidManager";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import { BulkAidDistributor } from "@/components/BulkAidDistributor";
import { PackageCheck, Trash2 } from "lucide-react";

type Row = any;

const Admin = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const confirmAsk = useConfirm();

  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [reportUrls, setReportUrls] = useState<Record<string, string>>({});
  const [regOpen, setRegOpen] = useState(true);
  const [closedReason, setClosedReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewDownloadName, setPreviewDownloadName] = useState<string>("");
  // People filter state
  const [pCategory, setPCategory] = useState<string>("all");
  const [pAgeMin, setPAgeMin] = useState<string>("");
  const [pAgeMax, setPAgeMax] = useState<string>("");
  const [pSearch, setPSearch] = useState<string>("");
  const [familyOpen, setFamilyOpen] = useState<Row | null>(null);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (data) { setRegOpen(data.registration_open); setClosedReason(data.closed_reason || ""); }
  };
  useEffect(() => { if (isAdmin) loadSettings(); }, [isAdmin]);

  const saveSettings = async (open: boolean) => {
    const { error } = await supabase.from("app_settings").update({
      registration_open: open,
      closed_reason: open ? null : closedReason,
      updated_at: new Date().toISOString(),
      updated_by: user!.id,
    }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setRegOpen(open);
    toast.success(t("toast.settings_updated"));
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, loading, navigate]);

  const load = async () => {
    const { data: apps } = await supabase.from("applications").select("*").order("submitted_at", { ascending: false });
    setRows(apps || []);
    if (apps?.length) {
      const ids = apps.map((a) => a.id);
      const userIds = apps.map((a) => a.user_id);
      const [{ data: fm }, { data: profs }] = await Promise.all([
        supabase.from("family_members").select("*").in("application_id", ids),
        supabase.from("profiles").select("*").in("id", userIds),
      ]);
      const grouped: Record<string, any[]> = {};
      (fm || []).forEach((m) => { (grouped[m.application_id] ||= []).push(m); });
      setMembers(grouped);
      const pmap: Record<string, any> = {};
      (profs || []).forEach((p) => { pmap[p.id] = p; });
      setProfiles(pmap);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const allMembers = Object.values(members).flat();
    const headInjured = Object.values(profiles).filter((p: any) => p.is_war_injured).length;
    const memberInjured = allMembers.filter((m: any) => m.is_war_injured).length;
    const martyrFamilies = rows.filter((r) => r.has_martyr).length;
    const pregnant = allMembers.filter((m: any) => m.is_pregnant).length;
    const totalMembers = rows.reduce((s, r) => s + (r.family_size || 0), 0);
    return { total, pending, approved, rejected, totalMembers, injured: headInjured + memberInjured, martyrFamilies, pregnant };
  }, [rows, members, profiles]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const p = profiles[r.user_id];
        const q = search.trim().toLowerCase();
        return (
          p?.full_name?.toLowerCase().includes(q) ||
          p?.national_id?.includes(q) ||
          p?.phone?.includes(q)
        );
      }
      return true;
    });
    // Sort alphabetically by head-of-family full name (Arabic-aware)
    return [...list].sort((a, b) => {
      const an = profiles[a.user_id]?.full_name || "";
      const bn = profiles[b.user_id]?.full_name || "";
      return an.localeCompare(bn, "ar", { sensitivity: "base" });
    });
  }, [rows, search, statusFilter, profiles]);

  // Unified people list (heads + family members) with their family context
  type Person = {
    kind: "head" | "member";
    id: string;
    application_id: string;
    head_name: string;
    full_name: string;
    national_id?: string;
    birth_date?: string;
    age: number;
    gender?: string;
    relationship: string;
    marital_status?: string;
    is_war_injured?: boolean;
    is_pregnant?: boolean;
    is_breastfeeding?: boolean;
    chronic_diseases?: string;
    health_notes?: string;
    injury_report_url?: string | null;
    pregnancy_report_url?: string | null;
    raw: any;
  };

  const allPeople: Person[] = useMemo(() => {
    const list: Person[] = [];
    rows.forEach((r) => {
      const p = profiles[r.user_id] || {};
      const headName = p.full_name || "";
      list.push({
        kind: "head", id: p.id || r.user_id, application_id: r.id,
        head_name: headName, full_name: p.full_name || "",
        national_id: p.national_id, birth_date: p.birth_date,
        age: calculateAge(p.birth_date), gender: p.gender,
        relationship: "head", marital_status: p.marital_status,
        is_war_injured: p.is_war_injured, chronic_diseases: p.chronic_diseases,
        health_notes: p.health_notes, injury_report_url: p.injury_report_url, raw: p,
      });
      (members[r.id] || []).forEach((m: any) => {
        list.push({
          kind: "member", id: m.id, application_id: r.id, head_name: headName,
          full_name: m.full_name, national_id: m.national_id, birth_date: m.birth_date,
          age: calculateAge(m.birth_date), gender: m.gender, relationship: m.relationship,
          is_war_injured: m.is_war_injured, is_pregnant: m.is_pregnant,
          is_breastfeeding: m.is_breastfeeding, chronic_diseases: m.chronic_diseases,
          health_notes: m.health_notes, injury_report_url: m.injury_report_url,
          pregnancy_report_url: m.pregnancy_report_url, raw: m,
        });
      });
    });
    return list;
  }, [rows, members, profiles]);

  const filteredPeople = useMemo(() => {
    const min = pAgeMin === "" ? -Infinity : parseInt(pAgeMin);
    const max = pAgeMax === "" ? Infinity : parseInt(pAgeMax);
    const q = pSearch.trim().toLowerCase();
    return allPeople.filter((p) => {
      if (p.age < min || p.age > max) return false;
      if (q && !(
        p.full_name?.toLowerCase().includes(q) ||
        p.national_id?.includes(q) ||
        p.head_name?.toLowerCase().includes(q)
      )) return false;
      switch (pCategory) {
        case "all": return true;
        case "injured": return !!p.is_war_injured;
        case "pregnant": return !!p.is_pregnant;
        case "breastfeeding": return !!p.is_breastfeeding;
        case "widowed": return p.marital_status === "widowed";
        case "divorced": return p.marital_status === "divorced";
        case "married": return p.marital_status === "married";
        case "single": return p.marital_status === "single";
        case "male": return p.gender === "male";
        case "female": return p.gender === "female";
        case "children": return p.age < 12;
        case "infants": return p.age < 1;
        case "elderly": return p.age >= 60;
      }
      return true;
    }).sort((a, b) =>
      (a.head_name || "").localeCompare(b.head_name || "", "ar", { sensitivity: "base" }) ||
      a.full_name.localeCompare(b.full_name, "ar", { sensitivity: "base" })
    );
  }, [allPeople, pCategory, pAgeMin, pAgeMax, pSearch]);

  const openImagePreview = async (path: string, title: string, downloadName?: string) => {
    if (!path) return;
    const { data } = await supabase.storage.from("medical-reports").createSignedUrl(path, 3600);
    if (!data?.signedUrl) { toast.error(t("toast.error")); return; }
    setPreviewUrl(data.signedUrl);
    setPreviewTitle(title);
    setPreviewDownloadName(downloadName || title);
  };

  const deleteReportImage = async (
    path: string,
    kind: "head_injury" | "member_injury" | "member_pregnancy",
    refId: string,
  ) => {
    if (!path) return;
    if (!(await confirmAsk({
      title: t("preview.delete_image_title"),
      description: t("preview.delete_image_desc"),
      confirmText: t("common.delete"),
      variant: "danger",
    }))) return;
    await supabase.storage.from("medical-reports").remove([path]);
    if (kind === "head_injury") {
      await supabase.from("profiles").update({ injury_report_url: null }).eq("id", refId);
    } else if (kind === "member_injury") {
      await supabase.from("family_members").update({ injury_report_url: null }).eq("id", refId);
    } else {
      await supabase.from("family_members").update({ pregnancy_report_url: null }).eq("id", refId);
    }
    toast.success(t("toast.file_removed"));
    if (selected) await openDetails(selected);
    load();
  };

  const approve = async (r: Row) => {
    if (!(await confirmAsk({
      title: t("confirm.approve_title"),
      description: t("confirm.approve"),
      confirmText: t("admin.approve"),
      variant: "success",
    }))) return;
    const { error } = await supabase.from("applications").update({
      status: "approved", rejection_reason: null, reviewed_at: new Date().toISOString(), reviewed_by: user!.id,
    }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("toast.approved"));
    load();
  };

  const reject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const { error } = await supabase.from("applications").update({
      status: "rejected", rejection_reason: rejectReason, reviewed_at: new Date().toISOString(), reviewed_by: user!.id,
    }).eq("id", rejectTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("toast.rejected"));
    setRejectOpen(false); setRejectReason(""); setRejectTarget(null);
    load();
  };

  const openDetails = async (r: Row) => {
    setSelected(r);
    const fm = members[r.id] || [];
    const head = profiles[r.user_id];
    const urls: Record<string, string> = {};
    const all = [
      ...(head?.injury_report_url ? [{ k: `head-${head.id}`, p: head.injury_report_url }] : []),
      ...fm.filter((m: any) => m.injury_report_url).map((m: any) => ({ k: m.id, p: m.injury_report_url })),
    ];
    for (const { k, p } of all) {
      const { data } = await supabase.storage.from("medical-reports").createSignedUrl(p, 3600);
      if (data?.signedUrl) urls[k] = data.signedUrl;
    }
    setReportUrls(urls);
  };

  const STATUS_AR: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
  const GENDER_AR: Record<string, string> = { male: "ذكر", female: "أنثى" };
  const MARITAL_AR: Record<string, string> = { married: "متزوج", single: "أعزب", widowed: "أرمل/ة", divorced: "مطلق/ة", other: "أخرى" };
  const REL_AR: Record<string, string> = {
    wife: "زوجة", husband: "زوج", son: "ابن", daughter: "ابنة",
    father: "والد", mother: "والدة", brother: "أخ", sister: "أخت", other: "أخرى",
    head: "رب الأسرة",
  };
  const yn = (v: any) => (v ? "نعم" : "لا");

  const buildRows = (subset: Row[]) => {
    const wsData: any[] = [];
    subset.forEach((r, idx) => {
      const p = profiles[r.user_id] || {};
      const fm = members[r.id] || [];
      const base = {
        "م": idx + 1,
        "حالة الطلب": STATUS_AR[r.status] ?? r.status,
        "تاريخ التقديم": r.submitted_at ? new Date(r.submitted_at).toLocaleString("ar-EG") : "",
        "السكن الأصلي": r.original_residence || "",
        "أقرب معلم (الأصلي)": r.original_landmark || "",
        "أقرب معلم (الحالي)": r.current_landmark || "",
        "عدد الأفراد": r.family_size || 0,
        "يوجد شهيد": yn(r.has_martyr),
        "اسم الشهيد": r.martyr_name || "",
        "صلة القرابة بالشهيد": r.martyr_relationship || "",
      };
      wsData.push({
        ...base,
        "النوع": "رب الأسرة",
        "الاسم الرباعي": p.full_name || "",
        "رقم الهوية": p.national_id || "",
        "تاريخ الميلاد": p.birth_date || "",
        "العمر": calculateAge(p.birth_date),
        "الجنس": GENDER_AR[p.gender] ?? "",
        "الحالة الاجتماعية": p.marital_status_other || MARITAL_AR[p.marital_status] || "",
        "صلة القرابة": "رب الأسرة",
        "رقم الجوال": p.phone || "",
        "جوال بديل": p.alt_phone || "",
        "مصاب حرب": yn(p.is_war_injured),
        "أمراض مزمنة": p.chronic_diseases || "",
        "ملاحظات صحية": p.health_notes || "",
        "حامل": "",
        "مرضعة": "",
      });
      fm.forEach((m: any) => {
        wsData.push({
          ...base,
          "النوع": "فرد",
          "الاسم الرباعي": m.full_name || "",
          "رقم الهوية": m.national_id || "",
          "تاريخ الميلاد": m.birth_date || "",
          "العمر": calculateAge(m.birth_date),
          "الجنس": GENDER_AR[m.gender] ?? "",
          "الحالة الاجتماعية": "",
          "صلة القرابة": m.relationship_other || REL_AR[m.relationship] || m.relationship,
          "رقم الجوال": "",
          "جوال بديل": "",
          "مصاب حرب": yn(m.is_war_injured),
          "أمراض مزمنة": m.chronic_diseases || "",
          "ملاحظات صحية": m.health_notes || "",
          "حامل": yn(m.is_pregnant),
          "مرضعة": yn(m.is_breastfeeding),
        });
      });
    });
    return wsData;
  };

  const styleSheet = (ws: XLSX.WorkSheet) => {
    // RTL & sensible column widths
    (ws as any)["!sheetView"] = [{ RTL: true }];
    const ref = ws["!ref"]; if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    const widths: number[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let max = 8;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        const v = cell?.v == null ? "" : String(cell.v);
        if (v.length > max) max = Math.min(40, v.length + 2);
      }
      widths.push(max);
    }
    ws["!cols"] = widths.map((w) => ({ wch: w }));
  };

  const buildStatsSheet = () => {
    const totalFamilies = rows.length;
    const totalMembers = rows.reduce((s, r) => s + ((members[r.id]?.length ?? 0) + 1), 0);
    const stats = [
      ["تاريخ التصدير", new Date().toLocaleString("ar-EG")],
      ["عدد العائلات", totalFamilies],
      ["إجمالي الأفراد", totalMembers],
      ["قيد المراجعة", rows.filter((r) => r.status === "pending").length],
      ["مقبولة", rows.filter((r) => r.status === "approved").length],
      ["مرفوضة", rows.filter((r) => r.status === "rejected").length],
    ];
    const ws = XLSX.utils.aoa_to_sheet([["البيان", "القيمة"], ...stats]);
    styleSheet(ws);
    return ws;
  };

  const exportData = (format: "csv" | "xlsx") => {
    // Sort by head full name (Arabic-aware) before export
    const sorted = [...rows].sort((a, b) => {
      const an = profiles[a.user_id]?.full_name || "";
      const bn = profiles[b.user_id]?.full_name || "";
      return an.localeCompare(bn, "ar");
    });
    const wsData = buildRows(sorted);
    const ws = XLSX.utils.json_to_sheet(wsData);
    styleSheet(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العائلات");
    if (format === "xlsx") {
      XLSX.utils.book_append_sheet(wb, buildStatsSheet(), "إحصائيات");
    }
    const fname = `مخيم-بركة2-العائلات-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") XLSX.writeFile(wb, `${fname}.xlsx`);
    else XLSX.writeFile(wb, `${fname}.csv`, { bookType: "csv" });
    toast.success(t("toast.export_done"));
  };

  const exportFamily = (r: Row) => {
    const wsData = buildRows([r]);
    const ws = XLSX.utils.json_to_sheet(wsData);
    styleSheet(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العائلة");
    const p = profiles[r.user_id] || {};
    const safe = (p.full_name || "عائلة").replace(/\s+/g, "_");
    XLSX.writeFile(wb, `بركة2-${safe}.xlsx`);
    toast.success(t("toast.export_done"));
  };

  if (loading || !isAdmin) return <Layout><div className="container py-20 text-center">...</div></Layout>;

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <Card className="p-4 shadow-card">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );

  return (
    <Layout>
      <section className="container py-8 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="space-y-1">
            <a href="/admin" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
              ← {t("admin.back_to_hub")}
            </a>
            <h1 className="text-2xl md:text-3xl text-primary">{t("admin.applications_page_title")}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportData("csv")} className="gap-1.5">
              <Download className="h-4 w-4" /> {t("admin.export_csv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportData("xlsx")} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> {t("admin.export_xlsx")}
            </Button>
          </div>
        </div>

        {/* Registration control */}
        <Card className={`p-4 shadow-card border-2 ${regOpen ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-primary">{t("admin.registration_control")}</div>
              <div className={`text-sm font-semibold ${regOpen ? "text-success" : "text-destructive"}`}>
                {regOpen ? t("admin.registration_open") : t("admin.registration_closed")}
              </div>
            </div>
            {regOpen ? (
              <Button onClick={() => saveSettings(false)} variant="destructive" size="sm">
                {t("admin.close_registration")}
              </Button>
            ) : (
              <Button onClick={() => saveSettings(true)} className="bg-success text-success-foreground hover:bg-success/90" size="sm">
                {t("admin.open_registration")}
              </Button>
            )}
          </div>
          {!regOpen && (
            <div className="mt-3">
              <Label className="text-xs">{t("admin.closed_reason")}</Label>
              <div className="flex gap-2 mt-1">
                <Textarea rows={2} value={closedReason} onChange={(e) => setClosedReason(e.target.value)}
                  placeholder={t("admin.closed_reason_placeholder")} />
                <Button onClick={() => saveSettings(false)} variant="outline" size="sm">{t("form.save")}</Button>
              </div>
            </div>
          )}
        </Card>

        <ChangeAdminPinCard />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label={t("admin.total")} value={stats.total} color="bg-primary/10 text-primary" />
          <StatCard icon={Activity} label={t("admin.pending")} value={stats.pending} color="bg-warning/20 text-warning-foreground" />
          <StatCard icon={CheckCircle2} label={t("admin.approved")} value={stats.approved} color="bg-success/15 text-success" />
          <StatCard icon={XCircle} label={t("admin.rejected")} value={stats.rejected} color="bg-destructive/15 text-destructive" />
          <StatCard icon={Users} label={t("admin.total_members")} value={stats.totalMembers} color="bg-accent/15 text-accent-foreground" />
          <StatCard icon={Heart} label={t("admin.injured")} value={stats.injured} color="bg-destructive/10 text-destructive" />
          <StatCard icon={Heart} label={t("admin.martyrs")} value={stats.martyrFamilies} color="bg-primary/10 text-primary" />
          <StatCard icon={Baby} label={t("admin.pregnant")} value={stats.pregnant} color="bg-accent/15 text-accent-foreground" />
        </div>

        <Tabs defaultValue="families" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-[32rem]">
            <TabsTrigger value="families" className="gap-1.5"><Users className="h-4 w-4" /> {t("admin.tab_families")}</TabsTrigger>
            <TabsTrigger value="people" className="gap-1.5"><Filter className="h-4 w-4" /> {t("admin.tab_people")}</TabsTrigger>
            <TabsTrigger value="aid" className="gap-1.5"><PackageCheck className="h-4 w-4" /> {t("admin.tab_aid")}</TabsTrigger>
          </TabsList>

          <TabsContent value="families" className="mt-4">
            <Card className="p-4 shadow-card">
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs">{t("admin.search")}</Label>
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.search")} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("admin.filter_status")}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.all")}</SelectItem>
                      <SelectItem value="pending">{t("status.pending")}</SelectItem>
                      <SelectItem value="approved">{t("status.approved")}</SelectItem>
                      <SelectItem value="rejected">{t("status.rejected")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.head_of_family")}</TableHead>
                      <TableHead>{t("form.national_id")}</TableHead>
                      <TableHead>{t("form.phone")}</TableHead>
                      <TableHead>{t("admin.family_size")}</TableHead>
                      <TableHead>{t("admin.submitted_at")}</TableHead>
                      <TableHead>{t("admin.filter_status")}</TableHead>
                      <TableHead className="text-end"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t("admin.no_results")}</TableCell></TableRow>
                    )}
                    {filtered.map((r) => {
                      const p = profiles[r.user_id] || {};
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold">
                            <button className="text-start hover:text-accent hover:underline" onClick={() => openDetails(r)}>{p.full_name || "—"}</button>
                          </TableCell>
                          <TableCell dir="ltr">{p.national_id}</TableCell>
                          <TableCell dir="ltr">{p.phone}</TableCell>
                          <TableCell>{r.family_size}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateShort(r.submitted_at)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              r.status === "approved" ? "bg-success/15 text-success" :
                              r.status === "rejected" ? "bg-destructive/15 text-destructive" :
                              "bg-warning/20 text-warning-foreground"
                            }`}>{t(`status.${r.status}`)}</span>
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => openDetails(r)}><Eye className="h-4 w-4" /></Button>
                              {r.status !== "approved" && (
                                <Button size="sm" variant="ghost" onClick={() => approve(r)} className="text-success hover:bg-success/10"><CheckCircle2 className="h-4 w-4" /></Button>
                              )}
                              {r.status !== "rejected" && (
                                <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(r); setRejectOpen(true); }} className="text-destructive hover:bg-destructive/10"><XCircle className="h-4 w-4" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="people" className="mt-4">
            <Card className="p-4 shadow-card">
              <div className="grid gap-3 md:grid-cols-4 mb-4">
                <div className="md:col-span-2">
                  <Label className="text-xs">{t("admin.search_person")}</Label>
                  <Input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder={t("admin.search_person_placeholder")} />
                </div>
                <div>
                  <Label className="text-xs">{t("admin.category")}</Label>
                  <Select value={pCategory} onValueChange={setPCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.all")}</SelectItem>
                      <SelectItem value="injured">{t("admin.cat_injured")}</SelectItem>
                      <SelectItem value="pregnant">{t("admin.cat_pregnant")}</SelectItem>
                      <SelectItem value="breastfeeding">{t("admin.cat_breastfeeding")}</SelectItem>
                      <SelectItem value="widowed">{t("admin.cat_widowed")}</SelectItem>
                      <SelectItem value="divorced">{t("admin.cat_divorced")}</SelectItem>
                      <SelectItem value="married">{t("admin.cat_married")}</SelectItem>
                      <SelectItem value="single">{t("admin.cat_single")}</SelectItem>
                      <SelectItem value="male">{t("admin.cat_male")}</SelectItem>
                      <SelectItem value="female">{t("admin.cat_female")}</SelectItem>
                      <SelectItem value="infants">{t("admin.cat_infants")}</SelectItem>
                      <SelectItem value="children">{t("admin.cat_children")}</SelectItem>
                      <SelectItem value="elderly">{t("admin.cat_elderly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t("admin.age_min")}</Label>
                    <Input type="number" min={0} max={120} value={pAgeMin} onChange={(e) => setPAgeMin(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("admin.age_max")}</Label>
                    <Input type="number" min={0} max={120} value={pAgeMax} onChange={(e) => setPAgeMax(e.target.value)} placeholder="120" />
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mb-2">{t("admin.results_count")}: <strong className="text-primary">{filteredPeople.length}</strong></div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.head_of_family")}</TableHead>
                      <TableHead>{t("form.full_name")}</TableHead>
                      <TableHead>{t("family.relationship")}</TableHead>
                      <TableHead>{t("form.age")}</TableHead>
                      <TableHead>{t("form.gender")}</TableHead>
                      <TableHead>{t("form.national_id")}</TableHead>
                      <TableHead>{t("admin.tags")}</TableHead>
                      <TableHead className="text-end"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPeople.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("admin.no_results")}</TableCell></TableRow>
                    )}
                    {filteredPeople.map((p) => {
                      const r = rows.find((x) => x.id === p.application_id);
                      return (
                        <TableRow key={`${p.kind}-${p.id}`}>
                          <TableCell className="font-semibold">
                            <button className="text-start hover:text-accent hover:underline" onClick={() => r && openDetails(r)}>{p.head_name || "—"}</button>
                          </TableCell>
                          <TableCell>{p.full_name}</TableCell>
                          <TableCell className="text-xs">{p.relationship === "head" ? t("family.rel_head") : t(`family.rel_${p.relationship}`)}</TableCell>
                          <TableCell>{p.age}</TableCell>
                          <TableCell className="text-xs">{p.gender ? t(`form.${p.gender}`) : "—"}</TableCell>
                          <TableCell dir="ltr" className="text-xs">{p.national_id || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.is_war_injured && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[10px] font-bold">{t("admin.cat_injured")}</span>}
                              {p.is_pregnant && <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground text-[10px] font-bold">{t("admin.cat_pregnant")}</span>}
                              {p.is_breastfeeding && <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-foreground text-[10px] font-bold">{t("admin.cat_breastfeeding")}</span>}
                              {p.marital_status === "widowed" && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold">{t("admin.cat_widowed")}</span>}
                              {p.marital_status === "divorced" && <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground text-[10px] font-bold">{t("admin.cat_divorced")}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-end">
                            <Button size="sm" variant="ghost" onClick={() => r && openDetails(r)}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="aid" className="mt-4">
            <BulkAidDistributor
              currentUserId={user!.id}
              families={rows.map((r) => ({
                application_id: r.id,
                user_id: r.user_id,
                head_name: profiles[r.user_id]?.full_name || "",
                national_id: profiles[r.user_id]?.national_id || "",
                family_size: r.family_size || 0,
                status: r.status,
              }))}
            />
          </TabsContent>
        </Tabs>
      </section>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin.details")}</DialogTitle></DialogHeader>
          {selected && (() => {
            const p = profiles[selected.user_id] || {};
            const fm = members[selected.id] || [];
            return (
              <div className="space-y-5 text-sm">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => exportFamily(selected)} className="gap-1.5">
                    <FileSpreadsheet className="h-4 w-4" /> {t("admin.export_family")}
                  </Button>
                </div>
                <Card className="p-4 bg-accent-soft/40">
                  <h3 className="font-bold text-primary mb-2">{t("admin.head_of_family")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>{t("form.full_name")}:</strong> {p.full_name}</div>
                    <div><strong>{t("form.national_id")}:</strong> <span dir="ltr">{p.national_id}</span></div>
                    <div><strong>{t("form.phone")}:</strong> <span dir="ltr">{p.phone}</span></div>
                    {p.alt_phone && <div><strong>{t("form.alt_phone")}:</strong> <span dir="ltr">{p.alt_phone}</span></div>}
                    <div><strong>{t("form.birth_date")}:</strong> {formatBirthDate(p.birth_date)} ({calculateAge(p.birth_date)} {t("form.years")})</div>
                    <div><strong>{t("form.gender")}:</strong> {t(`form.${p.gender}`)}</div>
                    <div><strong>{t("form.marital_status")}:</strong> {t(`form.${p.marital_status}`)} {p.marital_status_other && `(${p.marital_status_other})`}</div>
                  </div>
                  {(p.is_war_injured || p.chronic_diseases || p.health_notes) && (
                    <div className="mt-2 pt-2 border-t">
                      {p.is_war_injured && <div className="text-destructive font-semibold">{t("health.is_war_injured")}: {t("health.yes")}</div>}
                      {p.injury_report_url && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openImagePreview(p.injury_report_url, t("health.upload_report"), `Injury_${p.full_name}_${p.national_id}`)}>
                            <ImageIcon className="h-3.5 w-3.5" /> {t("preview.view_image")}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => deleteReportImage(p.injury_report_url, "head_injury", p.id)}>
                            <Trash2 className="h-3.5 w-3.5" /> {t("preview.delete_image")}
                          </Button>
                        </div>
                      )}
                      {p.chronic_diseases && <div><strong>{t("health.chronic")}:</strong> {p.chronic_diseases}</div>}
                      {p.health_notes && <div><strong>{t("health.notes")}:</strong> {p.health_notes}</div>}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="font-bold text-primary mb-2">{t("admin.residence")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>{t("residence.original_residence")}:</strong> {selected.original_residence}</div>
                    <div><strong>{t("residence.original_landmark")}:</strong> {selected.original_landmark}</div>
                    <div><strong>{t("residence.current_camp")}:</strong> {selected.current_camp}</div>
                    <div><strong>{t("residence.current_landmark")}:</strong> {selected.current_landmark}</div>
                  </div>
                  {selected.has_martyr && (
                    <div className="mt-2 pt-2 border-t text-destructive">
                      <strong>{t("family.martyr_title")}</strong> — {selected.martyr_name} ({selected.martyr_relationship})
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="font-bold text-primary mb-2">{t("admin.members")} ({fm.length})</h3>
                  <div className="space-y-3">
                    {fm.map((m: any) => (
                      <div key={m.id} className="border-s-2 border-accent ps-3">
                        <div className="font-semibold">{m.full_name} <span className="text-xs text-muted-foreground">— {t(`family.rel_${m.relationship}`)} {m.relationship_other && `(${m.relationship_other})`}</span></div>
                        <div className="text-xs text-muted-foreground">
                          {m.national_id && <span dir="ltr">ID: {m.national_id} • </span>}
                          {formatBirthDate(m.birth_date)} ({calculateAge(m.birth_date)} {t("form.years")}) • {t(`form.${m.gender}`)}
                        </div>
                        {(m.is_war_injured || m.chronic_diseases || m.is_pregnant || m.is_breastfeeding || m.health_notes) && (
                          <div className="text-xs mt-1 space-y-1">
                            {m.is_war_injured && <div className="text-destructive">⚠ {t("health.is_war_injured")}</div>}
                            {m.chronic_diseases && <div>{t("health.chronic")}: {m.chronic_diseases}</div>}
                            {m.is_pregnant && <div>• {t("health.is_pregnant")}</div>}
                            {m.is_breastfeeding && <div>• {t("health.is_breastfeeding")}</div>}
                            {m.health_notes && <div>{t("health.notes")}: {m.health_notes}</div>}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {m.injury_report_url && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => openImagePreview(m.injury_report_url, `${t("health.upload_report")} — ${m.full_name}`, `Injury_${m.full_name}_${m.national_id || ""}`)}>
                                    <ImageIcon className="h-3 w-3" /> {t("preview.view_injury")}
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-destructive hover:bg-destructive/10" onClick={() => deleteReportImage(m.injury_report_url, "member_injury", m.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {m.pregnancy_report_url && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => openImagePreview(m.pregnancy_report_url, `${t("health_extra.pregnancy_report")} — ${m.full_name}`, `Pregnancy_${m.full_name}_${m.national_id || ""}`)}>
                                    <ImageIcon className="h-3 w-3" /> {t("preview.view_pregnancy")}
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-destructive hover:bg-destructive/10" onClick={() => deleteReportImage(m.pregnancy_report_url, "member_pregnancy", m.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <AidManager applicationId={selected.id} currentUserId={user!.id} />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog open={!!previewUrl} onClose={() => setPreviewUrl("")} url={previewUrl} title={previewTitle} downloadName={previewDownloadName} />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.reject_reason_label")}</DialogTitle></DialogHeader>
          <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("admin.all")}</Button>
            <Button onClick={reject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("admin.reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// ============== Change Admin PIN Card ==============
const ChangeAdminPinCard = () => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(next)) {
      toast.error(t("form.invalid_pin")); return;
    }
    if (next !== next2) { toast.error(t("toast.password_mismatch")); return; }

    // Verify current PIN
    const { data } = await supabase.from("app_settings").select("admin_pin").eq("id", 1).maybeSingle();
    const actual = (data as any)?.admin_pin || "1234";
    if (current !== actual) { toast.error(t("toast.wrong_current_pin")); return; }
    if (next === actual) { toast.error(t("toast.pin_same_as_current")); return; }

    if (!(await confirmAsk({
      title: t("auth.change_admin_pin"),
      description: "هل أنت متأكد من تغيير كلمة مرور الإدارة؟",
      confirmText: t("auth.save_admin_pin"),
      variant: "warning",
    }))) return;

    setBusy(true);
    const { error } = await supabase.from("app_settings").update({ admin_pin: next }).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("auth.admin_pin_saved"));
    setCurrent(""); setNext(""); setNext2(""); setOpen(false);
  };

  return (
    <Card className="p-4 shadow-card border-accent/30">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-start">
        <span className="flex items-center gap-2 font-bold text-primary">
          <KeyRound className="h-4 w-4 text-accent" /> {t("auth.change_admin_pin")}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="grid gap-3 md:grid-cols-3 mt-4 animate-fade-in">
          <div>
            <Label className="text-xs">{t("auth.current_admin_pin")}</Label>
            <Input type="password" inputMode="numeric" maxLength={4} value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
          <div>
            <Label className="text-xs">{t("auth.new_admin_pin")}</Label>
            <Input type="password" inputMode="numeric" maxLength={4} value={next}
              onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
          <div>
            <Label className="text-xs">{t("auth.new_admin_pin")} (تأكيد)</Label>
            <Input type="password" inputMode="numeric" maxLength={4} value={next2}
              onChange={(e) => setNext2(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={onSave} disabled={busy} className="brand-gradient text-primary-foreground gap-2">
              <KeyRound className="h-4 w-4" /> {busy ? "..." : t("auth.save_admin_pin")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default Admin;
