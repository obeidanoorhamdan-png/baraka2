import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateShort } from "@/lib/formatDate";

const ACTION_LABELS: Record<string, string> = {
  approve_application: "قبول طلب",
  reject_application: "رفض طلب",
  delete_incomplete: "حذف حساب غير مكتمل",
  delete_application: "حذف طلب",
  change_pin: "تغيير رمز الإدارة",
  add_admin: "إضافة مشرف",
  remove_admin: "إزالة مشرف",
  distribute_aid: "توزيع مساعدة",
  update_settings: "تحديث الإعدادات",
};

const AuditLog = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="سجل نشاط الإدارة">
      <div className="container py-6 max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold">
            <ScrollText className="h-5 w-5" /> آخر 500 عملية
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        </div>
        <Card className="p-4 shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوقت</TableHead>
                  <TableHead>المشرف</TableHead>
                  <TableHead>العملية</TableHead>
                  <TableHead>العنصر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">...</TableCell></TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">لا يوجد سجلات بعد</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateShort(r.created_at)}</TableCell>
                    <TableCell className="font-semibold">{r.actor_name || r.actor_id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                        {ACTION_LABELS[r.action] || r.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.target_label || r.target_id || "—"}</TableCell>
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

export default AuditLog;
