import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { ID_RE } from "@/lib/validators";
import { ShieldCheck, Plus, Trash2, RotateCcw, Pencil, Send, UserCheck, UserX } from "lucide-react";

type RosterRow = {
  id: string;
  national_id: string;
  camp: string | null;
  head_name: string | null;
  status: string;
  note: string | null;
  created_at: string;
};

export default function CampRoster() {
  const { user, isAdmin } = useAuth();
  const confirmAsk = useConfirm();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [nid, setNid] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNid, setEditNid] = useState("");
  const [busy, setBusy] = useState(false);

  // Update-request form
  const [reqNid, setReqNid] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  const [reqFields, setReqFields] = useState("");
  const [reqs, setReqs] = useState<any[]>([]);

  const load = async () => {
    const [{ data: r }, { data: ur }] = await Promise.all([
      supabase.from("camp_roster").select("*").order("created_at", { ascending: false }),
      supabase.from("data_update_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setRows((r || []) as any);
    setReqs((ur || []) as any);
  };
  useEffect(() => { load(); }, []);

  const addId = async () => {
    if (!ID_RE.test(nid)) { toast.error("رقم هوية غير صالح"); return; }
    setBusy(true);
    const { error } = await supabase.from("camp_roster").upsert({
      national_id: nid, head_name: name || null, note: note || null,
      status: "approved", added_by: user?.id, camp: "Baraka 2",
    } as any, { onConflict: "national_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت إضافة رقم الهوية للاعتماد");
    setNid(""); setName(""); setNote(""); load();
  };

  // اعتماد جميع الأسر المقبولة دفعة واحدة بشكل نهائي
  const bulkApproveAll = async () => {
    if (!(await confirmAsk({
      title: "اعتماد جميع الأسر المقبولة",
      description: "سيتم اعتماد كل الأسر ذات الطلبات المقبولة نهائياً ضمن قائمة المخيم. متابعة؟",
      confirmText: "اعتماد الجميع", variant: "success",
    }))) return;
    setBusy(true);
    const { data: apps } = await supabase.from("applications").select("user_id").eq("status", "approved");
    const userIds = Array.from(new Set((apps || []).map((a: any) => a.user_id)));
    if (userIds.length === 0) { setBusy(false); toast.info("لا توجد أسر مقبولة"); return; }
    const { data: profs } = await supabase.from("profiles").select("id, national_id, full_name").in("id", userIds);
    const records = (profs || [])
      .filter((p: any) => p.national_id)
      .map((p: any) => ({
        national_id: p.national_id, head_name: p.full_name || null,
        status: "approved", added_by: user?.id, camp: "Baraka 2",
      }));
    const { error } = await supabase.from("camp_roster").upsert(records as any, { onConflict: "national_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم اعتماد ${records.length} أسرة نهائياً`);
    load();
  };

  const saveEditNid = async (row: RosterRow) => {
    if (!ID_RE.test(editNid)) { toast.error("رقم هوية غير صالح"); return; }
    const { error } = await supabase.from("camp_roster").update({ national_id: editNid } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تعديل رقم الهوية");
    setEditId(null); load();
  };

  const setStatus = async (row: RosterRow, status: "approved" | "removed") => {
    if (status === "removed" && !(await confirmAsk({
      title: "حذف الاعتماد", description: "سيُستبعد رقم الهوية من الفورمة والإكسل. متابعة؟",
      confirmText: "حذف الاعتماد", variant: "warning",
    }))) return;
    const { error } = await supabase.from("camp_roster").update({ status } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "تمت إعادة الاعتماد" : "تم حذف الاعتماد");
    load();
  };

  const removeRow = async (row: RosterRow) => {
    if (!(await confirmAsk({ title: "حذف نهائي", description: "حذف السجل نهائياً؟", confirmText: "حذف", variant: "danger" }))) return;
    const { error } = await supabase.from("camp_roster").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); load();
  };

  const sendRequest = async () => {
    if (!ID_RE.test(reqNid)) { toast.error("رقم هوية غير صالح"); return; }
    setBusy(true);
    const { data: uid } = await supabase.rpc("find_user_id_by_nid", { _nid: reqNid });
    const fields = reqFields.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("data_update_requests").insert({
      target_user_id: (uid as any) || null,
      target_national_id: reqNid,
      requested_by: user?.id,
      fields,
      message: reqMsg || null,
      status: "open",
    } as any);
    if (!error && uid) {
      await supabase.from("notifications").insert({
        user_id: uid as any,
        title: "طلب تحديث بيانات",
        body: reqMsg || "الرجاء مراجعة بياناتك وتحديثها.",
        link: "/my-application",
        kind: "warning",
      } as any);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال طلب التعديل");
    setReqNid(""); setReqMsg(""); setReqFields(""); load();
  };

  const resolveReq = async (id: string) => {
    const { error } = await supabase.from("data_update_requests").update({ status: "resolved" } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (!isAdmin) return <AdminLayout title="قائمة الاعتماد"><div className="p-8 text-center">صلاحية الإدارة مطلوبة</div></AdminLayout>;

  const approved = rows.filter((r) => r.status === "approved");
  const removed = rows.filter((r) => r.status === "removed");

  const RosterItem = ({ r }: { r: RosterRow }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
      <div className="min-w-0">
        {editId === r.id ? (
          <div className="flex items-center gap-2">
            <Input value={editNid} onChange={(e) => setEditNid(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-8 w-36" />
            <Button size="sm" className="h-8" onClick={() => saveEditNid(r)}>حفظ</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>إلغاء</Button>
          </div>
        ) : (
          <>
            <div className="font-bold flex items-center gap-2">
              {r.national_id}
              {r.status === "removed" ? (
                <Badge variant="destructive" className="text-[10px]">محذوف</Badge>
              ) : (
                <Badge className="bg-success text-success-foreground text-[10px]">معتمد</Badge>
              )}
            </div>
            {r.head_name && <div className="text-xs text-muted-foreground">{r.head_name}</div>}
            {r.note && <div className="text-[11px] text-muted-foreground italic">{r.note}</div>}
          </>
        )}
      </div>
      {editId !== r.id && (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" title="تعديل رقم الهوية"
            onClick={() => { setEditId(r.id); setEditNid(r.national_id); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          {r.status === "approved" ? (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-warning" title="حذف الاعتماد"
              onClick={() => setStatus(r, "removed")}><UserX className="h-4 w-4" /></Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-success" title="إعادة الاعتماد"
              onClick={() => setStatus(r, "approved")}><RotateCcw className="h-4 w-4" /></Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="حذف نهائي"
            onClick={() => removeRow(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout title="قائمة الاعتماد">
      <div className="container py-6 max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-extrabold">قائمة اعتماد المخيم وطلبات التعديل</h1>
        </div>

        <Tabs defaultValue="roster">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roster">الاعتماد ({approved.length})</TabsTrigger>
            <TabsTrigger value="requests">طلبات التعديل ({reqs.filter((q) => q.status === "open").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-5 w-5" /> إضافة أسرة للاعتماد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">رقم الهوية *</Label>
                    <Input value={nid} inputMode="numeric" onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 أرقام" />
                  </div>
                  <div>
                    <Label className="text-xs">اسم رب الأسرة (اختياري)</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ملاحظة (اختياري)</Label>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={bulkApproveAll} disabled={busy} className="gap-2">
                    <ShieldCheck className="h-4 w-4" /> اعتماد جميع الأسر المقبولة
                  </Button>
                  <Button onClick={addId} disabled={busy} className="gap-2"><Plus className="h-4 w-4" /> اعتماد</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-5 w-5 text-success" /> المعتمدون ({approved.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {approved.length === 0 && <p className="text-center text-sm text-muted-foreground py-3">لا يوجد</p>}
                {approved.map((r) => <RosterItem key={r.id} r={r} />)}
              </CardContent>
            </Card>

            {removed.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserX className="h-5 w-5 text-destructive" /> المعتمدون المحذوفون ({removed.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {removed.map((r) => <RosterItem key={r.id} r={r} />)}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-5 w-5" /> إرسال طلب تعديل بيانات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">رقم هوية رب الأسرة *</Label>
                  <Input value={reqNid} inputMode="numeric" onChange={(e) => setReqNid(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 أرقام" />
                </div>
                <div>
                  <Label className="text-xs">الحقول المطلوب تعديلها (افصل بفاصلة)</Label>
                  <Input value={reqFields} onChange={(e) => setReqFields(e.target.value)} placeholder="رقم الجوال، تاريخ الميلاد" />
                </div>
                <div>
                  <Label className="text-xs">رسالة للأسرة</Label>
                  <Input value={reqMsg} onChange={(e) => setReqMsg(e.target.value)} placeholder="الرجاء تحديث بياناتك" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={sendRequest} disabled={busy} className="gap-2"><Send className="h-4 w-4" /> إرسال</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">الطلبات المرسلة</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {reqs.length === 0 && <p className="text-center text-sm text-muted-foreground py-3">لا يوجد</p>}
                {reqs.map((q) => (
                  <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-2">
                        {q.target_national_id}
                        <Badge variant={q.status === "open" ? "outline" : "secondary"} className="text-[10px]">
                          {q.status === "open" ? "مفتوح" : "مكتمل"}
                        </Badge>
                      </div>
                      {q.fields?.length > 0 && <div className="text-xs text-muted-foreground">الحقول: {q.fields.join("، ")}</div>}
                      {q.message && <div className="text-[11px] text-muted-foreground italic">{q.message}</div>}
                    </div>
                    {q.status === "open" && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => resolveReq(q.id)}>إنهاء</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
