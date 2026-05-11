import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, ShieldOff, Users2, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatDateShort } from "@/lib/formatDate";

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  super_admin: { label: "مدير أعلى", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  admin: { label: "مدير", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  reviewer: { label: "مراجع", cls: "bg-primary/15 text-primary border-primary/40" },
  aid_distributor: { label: "موزع مساعدات", cls: "bg-success/15 text-success border-success/40" },
  viewer: { label: "مشاهد", cls: "bg-muted text-muted-foreground border-border" },
};

const Managers = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [nid, setNid] = useState("");
  const [role, setRole] = useState<string>("reviewer");
  const [busy, setBusy] = useState(false);
  const { user, isSuperAdmin } = useAuth();
  const confirmAsk = useConfirm();

  const load = async () => {
    const { data } = await supabase.rpc("list_admins");
    setRows((data as any[]) || []);
    if (isSuperAdmin) {
      const { data: s } = await supabase.from("admin_sessions")
        .select("*, profiles!inner(full_name, national_id)" as any)
        .order("started_at", { ascending: false }).limit(50);
      setSessions((s as any[]) || []);
      const { data: a } = await supabase.from("admin_login_attempts")
        .select("*").order("attempted_at", { ascending: false }).limit(50);
      setAttempts((a as any[]) || []);
    }
  };
  useEffect(() => { load(); }, [isSuperAdmin]);

  const onAdd = async () => {
    if (!/^\d{9}$/.test(nid)) { toast.error("أدخل رقم هوية صالح (9 أرقام)"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("grant_role_by_nid", { _nid: nid, _role: role });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("لا يوجد حساب بهذا الرقم. اطلب منه التسجيل أولاً."); return; }
    await supabase.rpc("log_admin_action", {
      _action: "grant_role", _target_type: "profile", _target_id: nid,
      _target_label: nid, _details: { role } as any,
    });
    toast.success(`تم منح الدور: ${ROLE_LABELS[role]?.label}`);
    setNid("");
    load();
  };

  const onChangeRole = async (row: any, newRole: string) => {
    if (newRole === row.role) return;
    if (!(await confirmAsk({
      title: "تغيير الدور",
      description: `تغيير دور ${row.full_name} إلى ${ROLE_LABELS[newRole]?.label}؟`,
      confirmText: "تأكيد", variant: "warning",
    }))) return;
    const { error } = await supabase.rpc("grant_role_by_nid", { _nid: row.national_id, _role: newRole });
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", {
      _action: "change_role", _target_type: "profile", _target_id: row.user_id,
      _target_label: row.full_name, _details: { from: row.role, to: newRole } as any,
    });
    toast.success("تم تغيير الدور");
    load();
  };

  const onRemove = async (row: any) => {
    if (row.user_id === user?.id) { toast.error("لا يمكنك إزالة نفسك"); return; }
    if (!(await confirmAsk({
      title: "إزالة الصلاحية",
      description: `إزالة ${row.full_name || row.national_id} من فريق الإدارة؟`,
      confirmText: "إزالة", variant: "danger",
    }))) return;
    const { error } = await supabase.rpc("revoke_admin", { _uid: row.user_id });
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", {
      _action: "remove_admin", _target_type: "profile", _target_id: row.user_id, _target_label: row.full_name,
    });
    toast.success("تمت إزالة الصلاحية");
    load();
  };

  const onRevokeSession = async (s: any) => {
    if (!(await confirmAsk({ title: "إنهاء الجلسة", description: "إنهاء هذه الجلسة؟", confirmText: "إنهاء", variant: "danger" }))) return;
    await supabase.from("admin_sessions").update({ revoked: true, ended_at: new Date().toISOString() }).eq("id", s.id);
    toast.success("تم إنهاء الجلسة");
    load();
  };

  return (
    <AdminLayout title="المشرفون والصلاحيات">
      <div className="container py-6 max-w-6xl space-y-4">
        <Tabs defaultValue="team">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="team" className="gap-1.5"><Users2 className="h-4 w-4" />الفريق</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="sessions" className="gap-1.5"><Activity className="h-4 w-4" />الجلسات</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="attempts" className="gap-1.5"><AlertTriangle className="h-4 w-4" />محاولات الدخول</TabsTrigger>}
          </TabsList>

          <TabsContent value="team" className="space-y-4 mt-4">
            {isSuperAdmin && (
              <Card className="p-4 shadow-card">
                <div className="flex items-center gap-2 text-primary font-bold mb-3">
                  <UserPlus className="h-5 w-5" /> إضافة عضو فريق
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  يجب أن يكون لدى الشخص حساب مسجَّل أولاً، ثم أضف رقم هويته هنا واختر الدور.
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] items-end">
                  <div>
                    <Label className="text-xs">رقم الهوية (9 أرقام)</Label>
                    <Input dir="ltr" inputMode="numeric" maxLength={9} value={nid}
                      onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      placeholder="000000000" />
                  </div>
                  <div>
                    <Label className="text-xs">الدور</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={onAdd} disabled={busy} className="brand-gradient text-primary-foreground gap-2">
                    <UserPlus className="h-4 w-4" /> إضافة
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-4 shadow-card">
              <div className="flex items-center gap-2 text-primary font-bold mb-3">
                <Users2 className="h-5 w-5" /> فريق الإدارة ({rows.length})
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهوية</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>2FA</TableHead>
                      <TableHead>أُضيف في</TableHead>
                      <TableHead className="text-end"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = ROLE_LABELS[r.role] || ROLE_LABELS.viewer;
                      return (
                        <TableRow key={r.user_id}>
                          <TableCell className="font-semibold">
                            {r.full_name || "—"} {r.user_id === user?.id && <span className="text-xs text-accent">(أنت)</span>}
                          </TableCell>
                          <TableCell dir="ltr">{r.national_id}</TableCell>
                          <TableCell>
                            {isSuperAdmin && r.user_id !== user?.id ? (
                              <Select value={r.role} onValueChange={(v) => onChangeRole(r, v)}>
                                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.two_fa_enabled ? <ShieldCheck className="h-4 w-4 text-success" /> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateShort(r.created_at)}</TableCell>
                          <TableCell className="text-end">
                            {isSuperAdmin && r.user_id !== user?.id && (
                              <Button size="sm" variant="ghost" onClick={() => onRemove(r)} className="text-destructive hover:bg-destructive/10 gap-1">
                                <ShieldOff className="h-4 w-4" /> إزالة
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="sessions" className="mt-4">
              <Card className="p-4 shadow-card">
                <div className="flex items-center gap-2 text-primary font-bold mb-3">
                  <Activity className="h-5 w-5" /> آخر جلسات الإدارة ({sessions.length})
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>الجهاز</TableHead>
                        <TableHead>بدأت</TableHead>
                        <TableHead>آخر نشاط</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead className="text-end"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s: any) => {
                        const active = !s.ended_at && !s.revoked;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs">{s.profiles?.full_name || s.user_id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs">{s.device_label} <span className="text-muted-foreground block truncate max-w-[200px]">{s.user_agent}</span></TableCell>
                            <TableCell className="text-xs">{formatDateShort(s.started_at)}</TableCell>
                            <TableCell className="text-xs">{formatDateShort(s.last_seen_at)}</TableCell>
                            <TableCell>
                              {s.revoked ? <Badge variant="outline" className="bg-destructive/10 text-destructive">منتهية</Badge>
                                : active ? <Badge variant="outline" className="bg-success/10 text-success">نشطة</Badge>
                                : <Badge variant="outline">منتهية</Badge>}
                            </TableCell>
                            <TableCell className="text-end">
                              {active && (
                                <Button size="sm" variant="ghost" onClick={() => onRevokeSession(s)} className="text-destructive">إنهاء</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="attempts" className="mt-4">
              <Card className="p-4 shadow-card">
                <div className="flex items-center gap-2 text-primary font-bold mb-3">
                  <AlertTriangle className="h-5 w-5" /> آخر محاولات الدخول ({attempts.length})
                </div>
                <p className="text-xs text-muted-foreground mb-3">يتم قفل الدخول تلقائياً بعد 5 محاولات فاشلة خلال 15 دقيقة.</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الوقت</TableHead>
                        <TableHead>الهوية</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>السبب</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{formatDateShort(a.attempted_at)}</TableCell>
                          <TableCell dir="ltr" className="text-xs">{a.national_id || "—"}</TableCell>
                          <TableCell>
                            {a.success ? <Badge variant="outline" className="bg-success/10 text-success">نجح</Badge>
                              : <Badge variant="outline" className="bg-destructive/10 text-destructive">فشل</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.reason || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Managers;
