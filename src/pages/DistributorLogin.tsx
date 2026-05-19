import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { idToEmail } from "@/lib/validators";

const DISTRIBUTOR_NID = "2008";

export default function DistributorLogin() {
  const navigate = useNavigate();
  const { user, canDistribute, loading } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!loading && user && canDistribute) navigate("/distributor", { replace: true });
  }, [user, canDistribute, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg("");
    if (!/^\d{4,6}$/.test(pin)) {
      setErrMsg("رمز غير صالح — يجب أن يكون 4 إلى 6 أرقام");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("passwordless-signin", {
        body: { national_id: DISTRIBUTOR_NID, answer: { kind: "admin_pin" as const, value: pin } },
      });
      if (error || !(data as any)?.ok) {
        setErrMsg((data as any)?.error || "كلمة المرور خاطئة");
        setBusy(false);
        return;
      }
      const password = (data as any).password as string;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: idToEmail(DISTRIBUTOR_NID),
        password,
      });
      if (signInErr) {
        setErrMsg("بيانات الدخول غير صحيحة");
        setBusy(false);
        return;
      }
      toast.success("تم الدخول بنجاح");
    } catch (e: any) {
      setErrMsg(e?.message || "خطأ");
      setBusy(false);
    }
  };

  return (
    <Layout>
      <section className="container py-10 max-w-md">
        <Card className="p-6 md:p-8 shadow-elegant">
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 border border-warning/30 px-3 py-1 text-xs text-warning font-bold">
              <Truck className="h-3.5 w-3.5" /> دخول المندوب
            </div>
            <h1 className="text-2xl font-extrabold text-primary">واجهة توزيع المساعدات</h1>
            <p className="text-sm text-muted-foreground">للمندوبين فقط — تسجيل التسليم بالأسماء</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1">
                <KeyRound className="h-4 w-4 text-warning" /> رمز المندوب
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => { setErrMsg(""); setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
                placeholder="••••"
                className={`text-center text-lg tracking-[0.5em] font-bold ${errMsg ? "border-destructive" : ""}`}
              />
              {errMsg && (
                <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/40 p-2 text-sm text-destructive font-semibold text-center">
                  {errMsg}
                </div>
              )}
            </div>
            <Button type="submit" disabled={busy} className="w-full brand-gradient text-primary-foreground">
              {busy ? "..." : "دخول المندوب"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              اسم المستخدم: <span className="font-bold">2008</span> — كلمة المرور: <span className="font-bold">2004</span>
            </p>
          </form>
        </Card>
      </section>
    </Layout>
  );
}
