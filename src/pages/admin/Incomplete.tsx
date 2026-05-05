import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDateShort } from "@/lib/formatDate";

const Incomplete = () => {
  const [rows, setRows] = useState<any[]>([]);
  const confirmAsk = useConfirm();

  const load = async () => {
    const { data, error } = await supabase.rpc("list_incomplete_accounts");
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

  return (
    <AdminLayout title="الحسابات غير المكتملة">
      <div className="container py-6 max-w-6xl space-y-4">
        <Card className="p-4 shadow-card">
          <div className="mb-3 text-sm text-muted-foreground">
            حسابات سُجّلت ولم تُكمل البيانات (لا يوجد طلب أو الطلب بدون أفراد). يمكن حذفها لتحرير رقم الهوية.
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهوية</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead className="text-end"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا يوجد حسابات غير مكتملة 🎉</TableCell></TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-semibold">{row.full_name || "—"}</TableCell>
                    <TableCell dir="ltr">{row.national_id}</TableCell>
                    <TableCell dir="ltr">{row.phone}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        row.reason === "no_application" ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning-foreground"
                      }`}>
                        {row.reason === "no_application" ? "بدون طلب" : "طلب فارغ"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateShort(row.created_at)}</TableCell>
                    <TableCell className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => onDelete(row)} className="text-destructive hover:bg-destructive/10 gap-1">
                        <Trash2 className="h-4 w-4" /> حذف
                      </Button>
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

export default Incomplete;
