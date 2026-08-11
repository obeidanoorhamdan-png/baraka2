import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { FamilyEditDialog } from "@/components/admin/FamilyEditDialog";
import { detectFamilyIssues, actualFamilySize, ISSUE_LABELS, type IssueCode } from "@/lib/familyIssues";
import { lookupCivilRecord } from "@/lib/civilRegistry";
import { AlertTriangle, Wrench, RefreshCw, Search, IdCard, CheckCircle2, Pencil } from "lucide-react";

type Row = { app: any; head: any; members: any[]; issues: ReturnType<typeof detectFamilyIssues> };

const FILTERS: { v: "all" | IssueCode; l: string }[] = [
  { v: "all", l: "كل المشاكل" },
  { v: "size_mismatch", l: ISSUE_LABELS.size_mismatch },
  { v: "member_nid", l: ISSUE_LABELS.member_nid },
  { v: "member_dob", l: ISSUE_LABELS.member_dob },
  { v: "head_nid", l: ISSUE_LABELS.head_nid },
  { v: "head_phone", l: ISSUE_LABELS.head_phone },
  { v: "head_dob", l: ISSUE_LABELS.head_dob },
  { v: "camp", l: ISSUE_LABELS.camp },
  { v: "origin", l: ISSUE_LABELS.origin },
];

const FamilyIssues = () => {
  const { canReview } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | IssueCode>("all");
  const [editing, setEditing] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: apps } = await supabase.from("applications").select("*");
    const list = apps || [];
    const [{ data: profs }, { data: mems }] = await Promise.all([
      supabase.from("profiles").select("*").in("id", list.map((a: any) => a.user_id)),
      supabase.from("family_members").select("*").in("application_id", list.map((a: any) => a.id)),
    ]);
    const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
    const mmap = new Map<string, any[]>();
    (mems || []).forEach((m: any) => {
      mmap.set(m.application_id, [...(mmap.get(m.application_id) || []), m]);
    });
    const built: Row[] = list.map((a: any) => {
      const head = pmap.get(a.user_id) || {};
      const members = mmap.get(a.id) || [];
      return { app: a, head, members, issues: detectFamilyIssues(a, head, members) };
    });
    setRows(built.filter((r) => r.issues.length > 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "all" ? true : r.issues.some((i) => i.code === filter)))
      .filter((r) =>
        !q ||
        r.head?.full_name?.toLowerCase().includes(q) ||
        String(r.head?.national_id || "").includes(q))
      .sort((a, b) => b.issues.length - a.issues.length);
  }, [rows, search, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => r.issues.forEach((i) => { c[i.code] = (c[i.code] || 0) + 1; }));
    return c;
  }, [rows]);

  const syncSize = async (r: Row) => {
    setBusy(r.app.id);
    const size = actualFamilySize(r.members);
    const { error } = await supabase.from("applications").update({ family_size: size }).eq("id", r.app.id);
    setBusy(null);
    if (error) { toast.error("تعذّر التحديث"); return; }
    toast.success(`تم ضبط عدد الأفراد إلى ${size}`);
    load();
  };

  const fillFromRegistry = async (r: Row) => {
    const nid = String(r.head?.national_id || "").replace(/\D/g, "");
    if (nid.length !== 9) { toast.error("رقم هوية رب الأسرة غير صحيح — عدّله يدوياً أولاً"); return; }
    setBusy(r.app.id);
    const rec = await lookupCivilRecord(nid);
    if (!rec.success) { setBusy(null); toast.error(rec.message); return; }
    const patch: Record<string, any> = {};
    if (!r.head.birth_date && rec.birth_date) patch.birth_date = rec.birth_date;
    if (!r.head.full_name && rec.full_name) patch.full_name = rec.full_name;
    if (Object.keys(patch).length === 0) { setBusy(null); toast.info("لا يوجد نقص يمكن تعبئته من السجل المدني"); return; }
    const { error } = await supabase.from("profiles").update(patch).eq("id", r.app.user_id);
    setBusy(null);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم التعبئة من السجل المدني");
    load();
  };

  const fixAllSizes = async () => {
    const targets = rows.filter((r) => r.issues.some((i) => i.code === "size_mismatch"));
    if (!targets.length) { toast.info("لا توجد فروقات في عدد الأفراد"); return; }
    setBusy("bulk");
    for (const r of targets) {
      await supabase.from("applications").update({ family_size: actualFamilySize(r.members) }).eq("id", r.app.id);
    }
    setBusy(null);
    toast.success(`تم ضبط عدد الأفراد لـ ${targets.length} أسرة`);
    load();
  };

  if (!canReview) {
    return <AdminLayout title="حل مشاكل الأسر"><div className="p-8 text-center">صلاحية المراجع مطلوبة</div></AdminLayout>;
  }

  return (
    <AdminLayout title="حل مشاكل الأسر">
      <div className="container py-6 max-w-7xl space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <h1 className="text-xl font-extrabold text-primary inline-flex items-center gap-2">
              <Wrench className="h-6 w-6 text-destructive" /> نافذة حل مشاكل الأسر
              <Badge variant="outline" className="border-destructive/40 text-destructive">{rows.length}</Badge>
            </h1>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={load} className="gap-1"><RefreshCw className="h-4 w-4" /> تحديث</Button>
              <Button size="sm" disabled={busy === "bulk"} onClick={fixAllSizes} className="gap-1">
                <CheckCircle2 className="h-4 w-4" /> إصلاح كل فروقات العدد
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهوية" className="ps-9" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "outline"}
                onClick={() => setFilter(f.v)} className="h-7 text-xs">
                {f.l}{f.v !== "all" && counts[f.v] ? ` (${counts[f.v]})` : ""}
              </Button>
            ))}
          </div>
        </Card>

        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">جاري التحميل…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-success font-bold">لا توجد مشاكل 🎉</Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <Card key={r.app.id} className="p-4 border-destructive/25 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-primary truncate">
                      {r.app.family_no ? <span className="text-accent">#{r.app.family_no} </span> : null}
                      {r.head?.full_name || "بدون اسم"}
                    </div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{r.head?.national_id || "—"} • {r.head?.phone || "—"}</div>
                  </div>
                  <Badge variant="outline" className="border-destructive/40 text-destructive shrink-0 gap-1">
                    <AlertTriangle className="h-3 w-3" /> {r.issues.length}
                  </Badge>
                </div>

                <ul className="space-y-1">
                  {r.issues.map((i) => (
                    <li key={i.code} className="text-xs rounded-md bg-destructive/5 border border-destructive/20 px-2 py-1 flex items-center justify-between gap-2">
                      <span>{i.label}</span>
                      {i.autoFix === "sync_size" && (
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-success"
                          disabled={busy === r.app.id} onClick={() => syncSize(r)}>
                          إصلاح تلقائي
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1" onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" /> تعديل البيانات
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" disabled={busy === r.app.id}
                    onClick={() => fillFromRegistry(r)}>
                    <IdCard className="h-4 w-4" /> تعبئة من السجل المدني
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FamilyEditDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        app={editing?.app || null}
        head={editing?.head || null}
        members={editing?.members || []}
        onSaved={() => { setEditing(null); load(); }}
      />
    </AdminLayout>
  );
};

export default FamilyIssues;
