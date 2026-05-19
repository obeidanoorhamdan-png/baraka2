import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Edit3, Check, X, ClipboardList } from "lucide-react";

type PendingEdit = {
  id: string;
  application_id: string;
  user_id: string;
  target_kind: string;
  target_id: string | null;
  changes: Record<string, { old: any; new: any }>;
  reason: string | null;
  status: string;
  created_at: string;
};

type Supplement = {
  id: string;
  applicant_name: string;
  applicant_national_id: string | null;
  reason: string;
  status: string;
  created_at: string;
  requested_by: string;
};

export default function AdminApprovals() {
  const { canReview } = useAuth();
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const [e, s] = await Promise.all([
      supabase.from("pending_edits").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("aid_supplement_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setEdits((e.data || []) as any);
    setSupplements((s.data || []) as any);
  };
  useEffect(() => { load(); }, []);

  const approveEdit = async (id: string) => {
    const { data, error } = await supabase.rpc("apply_pending_edit", { _edit_id: id, _notes: notes[id] || null });
    if (error) { toast.error(error.message); return; }
    if (data) toast.success("تم تطبيق التعديل"); else toast.error("فشل التطبيق");
    load();
  };

  const rejectEdit = async (id: string) => {
    const { error } = await supabase.rpc("reject_pending_edit", { _edit_id: id, _notes: notes[id] || null });
    if (error) { toast.error(error.message); return; }
    toast.success("تم الرفض");
    load();
  };

  const updateSup = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("aid_supplement_requests").update({
      status, reviewer_notes: notes[id] || null, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "تمت الموافقة" : "تم الرفض");
    load();
  };

  if (!canReview) return <AdminLayout><div className="p-8 text-center">صلاحية المراجع مطلوبة</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-extrabold">الموافقات المنتظرة</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Edit3 className="h-5 w-5 text-warning" /> طلبات تعديل بيانات الأسر</span>
              <Badge variant="outline">{edits.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {edits.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد طلبات تعديل معلقة</p>}
            {edits.map(e => (
              <Card key={e.id} className="border-warning/30">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("ar-EG")} • نوع: <span className="font-bold">{e.target_kind}</span>
                  </div>
                  {e.reason && <p className="text-sm italic">السبب: {e.reason}</p>}
                  <div className="rounded bg-muted/50 p-2 text-xs space-y-1">
                    {Object.entries(e.changes).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-3 gap-2">
                        <span className="font-bold">{k}</span>
                        <span className="text-destructive line-through">{String(v.old ?? "—")}</span>
                        <span className="text-success font-bold">{String(v.new ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                  <Textarea rows={1} placeholder="ملاحظة (اختياري)" value={notes[e.id] || ""}
                    onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveEdit(e.id)} className="gap-1 bg-success hover:bg-success/90">
                      <Check className="h-3.5 w-3.5" /> موافقة وتطبيق
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectEdit(e.id)} className="gap-1">
                      <X className="h-3.5 w-3.5" /> رفض
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>طلبات تكميلية من المندوبين</span>
              <Badge variant="outline">{supplements.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplements.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد طلبات</p>}
            {supplements.map(s => (
              <Card key={s.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("ar-EG")}</div>
                  <div className="font-bold">{s.applicant_name} {s.applicant_national_id && <span className="text-xs text-muted-foreground">({s.applicant_national_id})</span>}</div>
                  <p className="text-sm">{s.reason}</p>
                  <Textarea rows={1} placeholder="ملاحظة (اختياري)" value={notes[s.id] || ""}
                    onChange={(ev) => setNotes({ ...notes, [s.id]: ev.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateSup(s.id, "approved")} className="gap-1 bg-success hover:bg-success/90">
                      <Check className="h-3.5 w-3.5" /> موافقة
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateSup(s.id, "rejected")} className="gap-1">
                      <X className="h-3.5 w-3.5" /> رفض
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
