import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, UserRound, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { idToEmail } from "@/lib/validators";
import { ADMIN_PW_RE } from "@/lib/authPassword";

const AdminLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg("");
    const NID = username.trim();
    if (!/^\d{4,9}$/.test(NID) || !ADMIN_PW_RE.test(pin)) {
      setErrMsg("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    if (!ADMIN_PW_RE.test(pin)) {
      setErrMsg("كلمة المرور غير صالحة — 4 أحرف على الأقل (أرقام أو حروف أو رموز)");
      toast.error("كلمة مرور غير صالحة", { duration: 5000 });
      return;
    }
    setBusy(true);
    try {
      const { data: locked } = await supabase.rpc("is_admin_locked", { _nid: NID });
      if (locked) {
        setBusy(false);
        const m = "تم قفل الدخول مؤقتاً بسبب محاولات فاشلة متكررة. حاول بعد 15 دقيقة.";
        setErrMsg(m); toast.error(m, { duration: 6000 });
        return;
      }
      const { data, error } = await supabase.functions.invoke("passwordless-signin", {
        body: { national_id: NID, answer: { kind: "admin_pin" as const, value: pin } },
      });
      if (error || !(data as any)?.ok) {
        await supabase.from("admin_login_attempts").insert({
          national_id: NID, success: false, reason: "wrong_pin",
        });
        const m = "اسم المستخدم أو كلمة المرور غير صحيحة";
        setErrMsg(m); toast.error(m, { duration: 5000 });
        setBusy(false);
        return;
      }
      const password = (data as any).password as string;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: idToEmail(NID),
        password,
      });
      if (signInErr) {
        await supabase.from("admin_login_attempts").insert({
          national_id: NID, success: false, reason: "auth_failed",
        });
        setBusy(false);
        const m = "بيانات الدخول غير صحيحة";
        setErrMsg(m); toast.error(m, { duration: 5000 });
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("admin_login_attempts").insert({
        national_id: NID, user_id: u.user?.id, success: true,
      });
      setBusy(false);
      toast.success(t("toast.signin_success"));
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || "خطأ — حاول مجدداً";
      setErrMsg(m); toast.error(m, { duration: 5000 });
    }
  };

  return (
    <Layout>
      <section className="container py-10 md:py-16 max-w-md">
        <Card className="overflow-hidden shadow-elegant border-primary/10">
          <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-7 text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-background/15 grid place-items-center ring-1 ring-background/30">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold">لوحة إدارة المخيم</h1>
            <p className="text-sm opacity-85">دخول آمن ومخصص للمشرفين فقط</p>
          </div>
          <form onSubmit={submit} className="p-6 md:p-8 space-y-5" autoComplete="off">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><UserRound className="h-4 w-4 text-accent" /> اسم المستخدم</Label>
              <Input dir="ltr" inputMode="numeric" autoFocus autoComplete="username" value={username}
                onChange={(e) => { setErrMsg(""); setUsername(e.target.value.replace(/\D/g, "").slice(0, 9)); }}
                placeholder="رقم الهوية" className="text-center text-lg font-bold tracking-widest" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-accent" /> كلمة المرور</Label>
              <div className="relative">
                <Input type={show ? "text" : "password"} dir="ltr" autoComplete="current-password" value={pin}
                  onChange={(e) => { setErrMsg(""); setPin(e.target.value.slice(0, 64)); }}
                  placeholder="••••" className={`text-center text-lg font-bold tracking-[0.5em] pe-10 ${errMsg ? "border-destructive" : ""}`} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label="إظهار كلمة المرور"
                  className="absolute inset-y-0 end-2 grid place-items-center text-muted-foreground hover:text-primary">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {errMsg && <div className="rounded-xl bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive font-semibold text-center">{errMsg}</div>}
            <Button type="submit" size="lg" disabled={busy} className="w-full brand-gradient text-primary-foreground gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} دخول
            </Button>
            <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> يُقفل الدخول مؤقتاً بعد محاولات خاطئة متكررة
            </p>
          </form>
        </Card>
      </section>
    </Layout>
  );
};

export default AdminLogin;
