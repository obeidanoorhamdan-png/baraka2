import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { CheckCircle2, XCircle, Eye, Download, Search, Users, Heart, Baby, Activity, FileSpreadsheet } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";

type Row = any;

const Admin = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

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

  const approve = async (r: Row) => {
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

  const exportData = (format: "csv" | "xlsx") => {
    const wsData: any[] = [];
    rows.forEach((r) => {
      const p = profiles[r.user_id] || {};
      const fm = members[r.id] || [];
      // head row
      wsData.push({
        Type: "Head",
        ApplicationStatus: r.status,
        SubmittedAt: r.submitted_at,
        FullName: p.full_name,
        NationalID: p.national_id,
        Email: p.email,
        Phone: p.phone,
        AltPhone: p.alt_phone,
        BirthDate: p.birth_date,
        Age: calculateAge(p.birth_date),
        Gender: p.gender,
        MaritalStatus: p.marital_status,
        MaritalOther: p.marital_status_other,
        Relationship: "head",
        OriginalResidence: r.original_residence,
        OriginalLandmark: r.original_landmark,
        CurrentLandmark: r.current_landmark,
        FamilySize: r.family_size,
        HasMartyr: r.has_martyr,
        MartyrName: r.martyr_name,
        MartyrRelationship: r.martyr_relationship,
        WarInjured: p.is_war_injured,
        ChronicDiseases: p.chronic_diseases,
        HealthNotes: p.health_notes,
      });
      fm.forEach((m: any) => {
        wsData.push({
          Type: "Member",
          ApplicationStatus: r.status,
          SubmittedAt: r.submitted_at,
          FullName: m.full_name,
          NationalID: m.national_id,
          Email: "",
          Phone: "",
          AltPhone: "",
          BirthDate: m.birth_date,
          Age: calculateAge(m.birth_date),
          Gender: m.gender,
          MaritalStatus: "",
          MaritalOther: "",
          Relationship: m.relationship_other || m.relationship,
          OriginalResidence: r.original_residence,
          OriginalLandmark: r.original_landmark,
          CurrentLandmark: r.current_landmark,
          FamilySize: r.family_size,
          HasMartyr: r.has_martyr,
          MartyrName: r.martyr_name,
          MartyrRelationship: r.martyr_relationship,
          WarInjured: m.is_war_injured,
          ChronicDiseases: m.chronic_diseases,
          HealthNotes: m.health_notes,
          IsPregnant: m.is_pregnant,
          IsBreastfeeding: m.is_breastfeeding,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    const fname = `baraka2-registrations-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") XLSX.writeFile(wb, `${fname}.xlsx`);
    else XLSX.writeFile(wb, `${fname}.csv`, { bookType: "csv" });
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
          <h1 className="text-2xl md:text-3xl text-primary">{t("admin.title")}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportData("csv")} className="gap-1.5">
              <Download className="h-4 w-4" /> {t("admin.export_csv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportData("xlsx")} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> {t("admin.export_xlsx")}
            </Button>
          </div>
        </div>

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
                      <TableCell className="font-semibold">{p.full_name || "—"}</TableCell>
                      <TableCell dir="ltr">{p.national_id}</TableCell>
                      <TableCell dir="ltr">{p.phone}</TableCell>
                      <TableCell>{r.family_size}</TableCell>
                      <TableCell className="text-xs text-muted-foreground" dir="ltr">{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
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
                <Card className="p-4 bg-accent-soft/40">
                  <h3 className="font-bold text-primary mb-2">{t("admin.head_of_family")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>{t("form.full_name")}:</strong> {p.full_name}</div>
                    <div><strong>{t("form.national_id")}:</strong> <span dir="ltr">{p.national_id}</span></div>
                    <div><strong>{t("auth.email")}:</strong> <span dir="ltr">{p.email}</span></div>
                    <div><strong>{t("form.phone")}:</strong> <span dir="ltr">{p.phone}</span></div>
                    {p.alt_phone && <div><strong>{t("form.alt_phone")}:</strong> <span dir="ltr">{p.alt_phone}</span></div>}
                    <div><strong>{t("form.birth_date")}:</strong> {p.birth_date} ({calculateAge(p.birth_date)} {t("form.years")})</div>
                    <div><strong>{t("form.gender")}:</strong> {t(`form.${p.gender}`)}</div>
                    <div><strong>{t("form.marital_status")}:</strong> {t(`form.${p.marital_status}`)} {p.marital_status_other && `(${p.marital_status_other})`}</div>
                  </div>
                  {(p.is_war_injured || p.chronic_diseases || p.health_notes) && (
                    <div className="mt-2 pt-2 border-t">
                      {p.is_war_injured && <div className="text-destructive font-semibold">{t("health.is_war_injured")}: {t("health.yes")}</div>}
                      {reportUrls[`head-${p.id}`] && <a href={reportUrls[`head-${p.id}`]} target="_blank" rel="noreferrer" className="text-accent underline text-xs">{t("health.upload_report")}</a>}
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
                          {m.birth_date} ({calculateAge(m.birth_date)} {t("form.years")}) • {t(`form.${m.gender}`)}
                        </div>
                        {(m.is_war_injured || m.chronic_diseases || m.is_pregnant || m.is_breastfeeding || m.health_notes) && (
                          <div className="text-xs mt-1 space-y-0.5">
                            {m.is_war_injured && <div className="text-destructive">⚠ {t("health.is_war_injured")} {reportUrls[m.id] && <a href={reportUrls[m.id]} target="_blank" rel="noreferrer" className="text-accent underline ms-2">[{t("health.upload_report")}]</a>}</div>}
                            {m.chronic_diseases && <div>{t("health.chronic")}: {m.chronic_diseases}</div>}
                            {m.is_pregnant && <div>• {t("health.is_pregnant")}</div>}
                            {m.is_breastfeeding && <div>• {t("health.is_breastfeeding")}</div>}
                            {m.health_notes && <div>{t("health.notes")}: {m.health_notes}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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

export default Admin;
