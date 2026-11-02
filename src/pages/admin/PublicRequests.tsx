import { useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCw, Search, CheckCircle2, XCircle, Loader2, Phone, AlertTriangle, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatDate";
import { STATUS_META } from "@/components/PublicRequestBox";

const PublicRequests = () => {
  const { user } = useAuth();
  const confirmAsk = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [sel, setSel] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("public_requests").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    progress: rows.filter((r) => r.status === "in_progress").length,
    accepted: rows.filter((r) => r.status === "accepted").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    urgent: rows.filter((r) => r.priority === "urgent" && ["pending", "in_progress"].includes(r.status)).length,
  }), [rows]);

  const list = useMemo(() => rows.filter((r) => {
    if (status === "open" && !["pending", "in_progress"].includes(r.status)) return false;
    if (!["open", "all"].includes(status) && r.status !== status) return false;
    if (kind !== "all" && r.kind !== kind) return false;
    const s = q.trim();
    if (s && ![r.national_id, r.head_name, r.subject, r.ticket_no, r.body].some((v) => (v || "").includes(s))) return false;
    return true;
  }).sort((a, b) => (b.priority === "urgent" ? 1 : 0) - (a.priority === "urgent" ? 1 : 0)), [rows, q, status, kind]);

  const open = (r: any) => { setSel(r); setReply(r.admin_reply || ""); };

  const decide = async (newStatus: string) => {
    if (!sel) return;
    if (newStatus === "rejected" && reply.trim().length < 3) return toast.error("اكتب سبب الرفض في الرد");
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
    const { error } = await supabase.from("public_requests").update({
      status: newStatus, admin_reply: reply.trim() || null, handled_by: user!.id,
      handled_by_name: prof?.full_name || null, handled_at: new Date().toISOString(),
    }).eq("id", sel.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (sel.family_user_id) {
      await supabase.from("notifications").insert({
        user_id: sel.family_user_id, kind: "complaint",
        title: `تحديث على طلبك ${sel.ticket_no}: ${STATUS_META[newStatus].label}`, body: reply.trim() || null,
      }).then(() => {}, () => {});
    }
    await (supabase.rpc as any)("log_admin_action", { _action: `request_${newStatus}`, _target_type: "public_request", _target_id: sel.id, _target_label: sel.ticket_no, _details: {} });
    toast.success("تم الحفظ");
    setSel(null); load();
  };

  const remove = async (r: any) => {
    if (!(await confirmAsk({ title: "حذف الطلب", description: `حذف الطلب ${r.ticket_no} نهائياً؟`, destructive: true } as any))) return;
    const { error } = await supabase.from("public_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setSel(null); load();
  };

  const Stat = ({ label, value, cls }: any) => (
    <Card className="p-4 shadow-card"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-2xl font-extrabold mt-1 ${cls}`}>{value}</div></Card>
  );

  return (
    <AdminLayout title="الشكاوى وطلبات المساعدة">
      <div className="container py-6 max-w-6xl space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="الإجمالي" value={stats.total} cls="text-primary" />
          <Stat label="قيد الانتظار" value={stats.pending} cls="text-accent" />
          <Stat label="قيد المعالجة" value={stats.progress} cls="text-primary" />
          <Stat label="مقبولة" value={stats.accepted} cls="text-success" />
          <Stat label="مرفوضة" value={stats.rejected} cls="text-destructive" />
          <Stat label="عاجلة مفتوحة" value={stats.urgent} cls="text-destructive" />
        </div>

        <Card className="p-4 shadow-card">
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالهوية، الاسم، رقم التذكرة..." />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">المفتوحة</SelectItem><SelectItem value="all">الكل</SelectItem>
                {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الأنواع</SelectItem><SelectItem value="complaint">شكاوى</SelectItem><SelectItem value="help">طلبات مساعدة</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>

          {!loading && list.length === 0 && (
            <div className="text-center py-12 text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />لا توجد طلبات</div>
          )}
          <div className="space-y-2">
            {list.map((r) => {
              const m = STATUS_META[r.status] || STATUS_META.pending;
              return (
                <button key={r.id} onClick={() => open(r)} className="w-full text-right rounded-xl border p-4 hover:border-accent hover:bg-accent/5 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold">
                      {r.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {r.subject}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{r.kind === "help" ? "طلب مساعدة" : "شكوى"}</Badge>
                      <Badge variant="outline" className={m.cls}>{m.label}</Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                    <span>رب الأسرة: <b className="text-foreground">{r.head_name || "—"}</b></span>
                    <span dir="ltr">{r.national_id}</span>
                    <span dir="ltr" className="font-mono">{r.ticket_no}</span>
                    {r.category && <span>{r.category}</span>}
                    <span>{formatDateShort(r.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-xl">
          {sel && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{sel.priority === "urgent" && <AlertTriangle className="h-5 w-5 text-destructive" />}{sel.subject}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3">
                  <div>رب الأسرة: <b>{sel.head_name || "—"}</b></div>
                  <div>الهوية: <b dir="ltr">{sel.national_id}</b></div>
                  <div>التذكرة: <b dir="ltr" className="font-mono">{sel.ticket_no}</b></div>
                  <div>النوع: <b>{sel.kind === "help" ? "طلب مساعدة" : "شكوى"}</b>{sel.category ? ` — ${sel.category}` : ""}</div>
                  {sel.phone && <a className="col-span-2 inline-flex items-center gap-1 text-accent font-semibold" href={`tel:${sel.phone}`} dir="ltr"><Phone className="h-4 w-4" />{sel.phone}</a>}
                </div>
                <div className="whitespace-pre-wrap rounded-lg border p-3 leading-relaxed">{sel.body}</div>
                {sel.handled_at && <div className="text-xs text-muted-foreground">آخر معالجة: {sel.handled_by_name || "مسؤول"} — {formatDateShort(sel.handled_at)}</div>}
                <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب رد الإدارة (يظهر للأسرة)..." maxLength={1000} />
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <Button variant="ghost" className="text-destructive gap-1" onClick={() => remove(sel)}><Trash2 className="h-4 w-4" />حذف</Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => decide("in_progress")} className="gap-1"><Loader2 className="h-4 w-4" />قيد المعالجة</Button>
                  <Button variant="destructive" disabled={saving} onClick={() => decide("rejected")} className="gap-1"><XCircle className="h-4 w-4" />رفض</Button>
                  <Button disabled={saving} onClick={() => decide("accepted")} className="gap-1"><CheckCircle2 className="h-4 w-4" />قبول</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default PublicRequests;
