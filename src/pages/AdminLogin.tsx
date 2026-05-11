import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ADMIN_NID, PIN_RE, idToEmail } from "@/lib/validators";

const AdminLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PIN_RE.test(pin)) {
      toast.error(t("form.invalid_pin"));
      return;
    }
    setBusy(true);
    try {
      // Check lockout first
      const { data: locked } = await supabase.rpc("is_admin_locked", { _nid: ADMIN_NID });
      if (locked) {
        setBusy(false);
        toast.error("تم قفل الدخول مؤقتاً بسبب محاولات فاشلة متكررة. حاول بعد 15 دقيقة.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("passwordless-signin", {
        body: { national_id: ADMIN_NID, answer: { kind: "admin_pin" as const, value: pin } },
      });
      if (error || !(data as any)?.ok) {
        await supabase.from("admin_login_attempts").insert({
          national_id: ADMIN_NID, success: false, reason: "wrong_pin",
        });
        toast.error((data as any)?.error || error?.message || t("toast.wrong_answer"));
        setBusy(false);
        return;
      }
      const password = (data as any).password as string;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: idToEmail(ADMIN_NID),
        password,
      });
      if (signInErr) {
        await supabase.from("admin_login_attempts").insert({
          national_id: ADMIN_NID, success: false, reason: "auth_failed",
        });
        setBusy(false);
        toast.error(t("toast.invalid_credentials"));
        return;
      }
      // success — record attempt
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("admin_login_attempts").insert({
        national_id: ADMIN_NID, user_id: u.user?.id, success: true,
      });
      setBusy(false);
      toast.success(t("toast.signin_success"));
    } catch (e: any) {
      setBusy(false);
      toast.error(e?.message || t("toast.error"));
    }
  };

  return (
    <Layout>
      <section className="container py-10 max-w-md">
        <Card className="p-6 md:p-8 shadow-elegant">
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs text-accent font-bold">
              <ShieldCheck className="h-3.5 w-3.5" /> دخول الإدارة
            </div>
            <h1 className="text-2xl font-extrabold text-primary">لوحة الإدارة</h1>
            <p className="text-sm text-muted-foreground">
              هذه الصفحة مخصصة للمشرفين فقط
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-accent" /> رمز الإدارة (PIN)
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="text-center text-lg tracking-[0.5em] font-bold"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full brand-gradient text-primary-foreground">
              {busy ? "..." : "دخول"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate("/auth")}
            >
              لست مشرفاً؟ دخول العائلات
            </Button>
          </form>
        </Card>
      </section>
    </Layout>
  );
};

export default AdminLogin;
