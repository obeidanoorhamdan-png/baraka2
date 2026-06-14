import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KeyRound, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";

const Settings = () => {
  const { user } = useAuth();
  const confirmAsk = useConfirm();
  const [regOpen, setRegOpen] = useState(true);
  const [closedReason, setClosedReason] = useState("");
  const [campLock, setCampLock] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      setRegOpen(data.registration_open);
      setClosedReason(data.closed_reason || "");
      setCampLock(!!(data as any).camp_lock_enabled);
    }
  };
  useEffect(() => { load(); }, []);

  const saveCampLock = async (enabled: boolean) => {
    const { error } = await supabase.from("app_settings").update({
      camp_lock_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user!.id,
    } as any).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setCampLock(enabled);
    await supabase.rpc("log_admin_action", { _action: "update_settings", _target_type: "settings", _target_label: enabled ? "تفعيل قفل المخيم" : "إلغاء قفل المخيم" });
    toast.success("تم الحفظ");
  };

  const saveSettings = async (open: boolean) => {
    const { error } = await supabase.from("app_settings").update({
      registration_open: open,
      closed_reason: open ? null : closedReason,
      updated_at: new Date().toISOString(),
      updated_by: user!.id,
    }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setRegOpen(open);
    await supabase.rpc("log_admin_action", { _action: "update_settings", _target_type: "settings", _target_label: open ? "فتح التسجيل" : "إغلاق التسجيل" });
    toast.success("تم الحفظ");
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(next)) { toast.error("PIN غير صالح"); return; }
    if (next !== next2) { toast.error("لا تتطابق التأكيدات"); return; }
    const { data } = await supabase.from("admin_secrets").select("admin_pin").eq("id", 1).maybeSingle();
    const actual = (data as any)?.admin_pin || "1234";
    if (current !== actual) { toast.error("الرمز الحالي غير صحيح"); return; }
    if (next === actual) { toast.error("الرمز الجديد مطابق للحالي"); return; }
    if (!(await confirmAsk({ title: "تغيير رمز الإدارة", description: "متابعة؟", confirmText: "تأكيد", variant: "warning" }))) return;
    setBusy(true);
    const { error } = await supabase.from("admin_secrets").update({ admin_pin: next, updated_at: new Date().toISOString(), updated_by: user?.id }).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", { _action: "change_pin", _target_type: "settings" });
    toast.success("تم تحديث الرمز");
    setCurrent(""); setNext(""); setNext2("");
  };

  return (
    <AdminLayout title="الإعدادات">
      <div className="container py-6 max-w-4xl space-y-4">
        <Card className={`p-4 shadow-card border-2 ${regOpen ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex items-center gap-2 text-primary font-bold mb-3">
            <SettingsIcon className="h-5 w-5" /> التحكم بالتسجيل
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`text-sm font-semibold ${regOpen ? "text-success" : "text-destructive"}`}>
              {regOpen ? "التسجيل مفتوح للعائلات" : "التسجيل مغلق حالياً"}
            </div>
            {regOpen ? (
              <Button onClick={() => saveSettings(false)} variant="destructive" size="sm">إغلاق التسجيل</Button>
            ) : (
              <Button onClick={() => saveSettings(true)} className="bg-success text-success-foreground hover:bg-success/90" size="sm">فتح التسجيل</Button>
            )}
          </div>
          {!regOpen && (
            <div className="mt-3">
              <Label className="text-xs">سبب الإغلاق (يظهر للعائلات)</Label>
              <div className="flex gap-2 mt-1">
                <Textarea rows={2} value={closedReason} onChange={(e) => setClosedReason(e.target.value)} />
                <Button onClick={() => saveSettings(false)} variant="outline" size="sm">حفظ</Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary font-bold mb-3">
            <KeyRound className="h-5 w-5" /> تغيير رمز دخول الإدارة (PIN)
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">الرمز الحالي</Label>
              <Input type="password" inputMode="numeric" maxLength={4} value={current}
                onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
            <div>
              <Label className="text-xs">الرمز الجديد</Label>
              <Input type="password" inputMode="numeric" maxLength={4} value={next}
                onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
            <div>
              <Label className="text-xs">تأكيد الجديد</Label>
              <Input type="password" inputMode="numeric" maxLength={4} value={next2}
                onChange={(e) => setNext2(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={savePin} disabled={busy} className="brand-gradient text-primary-foreground gap-2">
              <KeyRound className="h-4 w-4" /> {busy ? "..." : "حفظ الرمز"}
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Settings;
