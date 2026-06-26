import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, SendHorizonal, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDateShort } from "@/lib/formatDate";
import { FamilyEditDialog } from "@/components/admin/FamilyEditDialog";

const Incomplete = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const confirmAsk = useConfirm();

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editApp, setEditApp] = useState<any>(null);
  const [editHead, setEditHead] = useState<any>(null);
  const [editMembers, setEditMembers] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_incomplete_accounts");
    setLoading(false);
    if (!error) setRows((data as any[]) || []);
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (row: any) => {
    if (!(await confirmAsk({
      title: "حذف الحساب غير المكتمل",
      description: `سيتم حذف ${row.full_name || row.national_id} نهائياً.`,
      confirmText: "حذف نهائي",
      variant: "danger",
    }))) return;
    const { data, error } = await supabase.functions.invoke("forget-account", {
      body: { national_id: row.national_id, phone: row.phone },
    });
    if (error || !(data as any)?.ok) {
      toast.error((data as any)?.error || error?.message || "خطأ");
      return;
    }
    await supabase.rpc("log_admin_action", {
      _action: "delete_incomplete",
      _target_type: "profile",
      _target_id: row.user_id,
      _target_label: row.full_name || row.national_id,
    });
    toast.success("تم حذف الحساب");
    load();
  };

  const onComplete = async (row: any) => {
    // Load profile (head), application and members for the edit dialog
    const { data: prof } = await supabase
      .from("profiles").select("*").eq("id", row.user_id).maybeSingle();
    let app = null as any;
    let members: any[] = [];
    if (row.application_id) {
      const { data: a } = await supabase
        .from("applications").select("*").eq("id", row.application_id).maybeSingle();
      app = a;
      const { data: m } = await supabase
        .from("family_members").select("*").eq("application_id", row.application_id)
        .order("is_head", { ascending: false });
      members = (m as any[]) || [];
    }
    if (!app) {
      toast.error("لا يوجد طلب لهذا الحساب", {
        description: "هذا الحساب لم يُنشئ طلباً بعد، يجب أن يكمل صاحب الحساب التسجيل أولاً أو يُحذف الحساب.",
        duration: 7000,
      });
      return;
    }
    setEditHead(prof);
    setEditApp(app);
    // exclude the head from the members editor (head edited in its own section)
    setEditMembers(members.filter((x) => !x.is_head));
    setEditOpen(true);
  };

  const onPromote = async (row: any) => {
    if (!(await confirmAsk({
      title: "إرسال الطلب للمراجعة",
      description: `سيتم إبراز طلب «${row.full_name || row.national_id}» في قائمة الطلبات قيد المراجعة ليطّلع عليه المراجع.`,
      confirmText: "إرسال للمراجعة",
    }))) return;
    const { error } = await supabase.rpc("admin_promote_to_review", { _user_id: row.user_id });
    if (error) {
      const msg = error.message.includes("empty_application")
        ? "لا يمكن الإرسال: الطلب لا يحتوي أفراداً بعد. أكمل البيانات أولاً."
        : error.message.includes("no_application")
        ? "لا يوجد طلب لهذا الحساب بعد."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("تم إرسال الطلب إلى قائمة المراجعة");
    load();
  };

  return (
    <AdminLayout title="الحسابات غير المكتملة">
      <div className="container py-6 max-w-6xl space-y-4">
        <Card className="p-4 shadow-card">
          <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
            حسابات سُجّلت ولم تُكمل بياناتها. يوضح عمود «الناقص» بالتحديد ما هو المفقود. يمكنك إكمال البيانات مباشرةً، أو إرسال الطلب للمراجعة بعد اكتماله، أو حذف الحساب لتحرير رقم الهوية.
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهوية</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>الناقص</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead className="text-end">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{loading ? "جارٍ التحميل..." : "لا يوجد حسابات غير مكتملة 🎉"}</TableCell></TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-semibold">{row.full_name || "—"}</TableCell>
                    <TableCell dir="ltr">{row.national_id}</TableCell>
                    <TableCell dir="ltr">{row.phone}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row.reason === "no_application" ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning-foreground"
                        }`}>
                          {row.reason === "no_application" ? "بدون طلب" : "طلب فارغ"}
                        </span>
                        {(row.missing || []).map((mi: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-normal">{mi}</Badge>
                        ))}
                        {row.application_id && (
                          <Badge variant="secondary" className="text-[10px]">{row.member_count || 0} فرد</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateShort(row.created_at)}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {row.application_id && (
                          <Button size="sm" variant="ghost" onClick={() => onComplete(row)} className="text-primary hover:bg-primary/10 gap-1">
                            <Pencil className="h-4 w-4" /> إكمال
                          </Button>
                        )}
                        {row.application_id && (row.member_count || 0) > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => onPromote(row)} className="text-accent-foreground hover:bg-accent/15 gap-1">
                            <SendHorizonal className="h-4 w-4" /> للمراجعة
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => onDelete(row)} className="text-destructive hover:bg-destructive/10 gap-1">
                          <Trash2 className="h-4 w-4" /> حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <FamilyEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        app={editApp}
        head={editHead}
        members={editMembers}
        onSaved={load}
      />
    </AdminLayout>
  );
};

export default Incomplete;
