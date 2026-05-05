import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, ShieldOff, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatDateShort } from "@/lib/formatDate";

const Managers = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [nid, setNid] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const confirmAsk = useConfirm();

  const load = async () => {
    const { data, error } = await supabase.rpc("list_admins");
    if (!error) setRows((data as any[]) || []);
  };
  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    if (!/^\d{9}$/.test(nid)) { toast.error("أدخل رقم هوية صالح (9 أرقام)"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("grant_admin_by_nid", { _nid: nid });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("لا يوجد حساب بهذا الرقم. اطلب منه التسجيل أولاً."); return; }
    await supabase.rpc("log_admin_action", {
      _action: "add_admin", _target_type: "profile", _target_id: nid, _target_label: nid,
    });
    toast.success("تمت إضافة المشرف");
    setNid("");
    load();
  };

  const onRemove = async (row: any) => {
    if (row.user_id === user?.id) { toast.error("لا يمكنك إزالة نفسك"); return; }
    if (!(await confirmAsk({
      title: "إزالة صلاحية الإشراف",
      description: `إزالة ${row.full_name || row.national_id} من قائمة المشرفين؟`,
      confirmText: "إزالة",
      variant: "danger",
    }))) return;
    const { error } = await supabase.rpc("revoke_admin", { _uid: row.user_id });
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", {
      _action: "remove_admin", _target_type: "profile", _target_id: row.user_id, _target_label: row.full_name,
    });
    toast.success("تمت إزالة الصلاحية");
    load();
  };

  return (
    <AdminLayout title="المشرفون">
      <div className="container py-6 max-w-4xl space-y-4">
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary font-bold mb-3">
            <UserPlus className="h-5 w-5" /> إضافة مشرف جديد
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            يجب أن يكون لدى الشخص حساب مسجَّل (رب أسرة أو حساب موجود) أولاً، ثم أضف رقم هويته هنا لمنحه صلاحيات الإشراف.
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">رقم الهوية (9 أرقام)</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={9}
                value={nid}
                onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="000000000"
              />
            </div>
            <Button onClick={onAdd} disabled={busy} className="brand-gradient text-primary-foreground gap-2">
              <UserPlus className="h-4 w-4" /> إضافة
            </Button>
          </div>
        </Card>

        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary font-bold mb-3">
            <Users2 className="h-5 w-5" /> قائمة المشرفين ({rows.length})
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهوية</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>أُضيف في</TableHead>
                  <TableHead className="text-end"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-semibold">
                      {r.full_name || "—"} {r.user_id === user?.id && <span className="text-xs text-accent">(أنت)</span>}
                    </TableCell>
                    <TableCell dir="ltr">{r.national_id}</TableCell>
                    <TableCell dir="ltr">{r.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateShort(r.created_at)}</TableCell>
                    <TableCell className="text-end">
                      {r.user_id !== user?.id && (
                        <Button size="sm" variant="ghost" onClick={() => onRemove(r)} className="text-destructive hover:bg-destructive/10 gap-1">
                          <ShieldOff className="h-4 w-4" /> إزالة
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Managers;
