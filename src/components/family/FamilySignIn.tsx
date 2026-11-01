import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ID_RE, idToEmail } from "@/lib/validators";
import { FAMILY_CODE_RE, toAuthPassword } from "@/lib/authPassword";
import { Eye, EyeOff, ArrowLeft, Loader2, LockKeyhole } from "lucide-react";

export const FamilySignIn = () => {
  const navigate = useNavigate();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!ID_RE.test(nationalId)) return setError("أدخل رقم هوية رب الأسرة المكوّن من 9 أرقام");
    if (!FAMILY_CODE_RE.test(password)) return setError("أدخل كلمة المرور المكوّنة من 4 أرقام");
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: idToEmail(nationalId), password: toAuthPassword(password),
      });
      if (signInError) {
        setError(signInError.status === 429 ? "محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً" : "تعذّر الدخول؛ تحقق من رقم الهوية وكلمة المرور");
        return;
      }
      setPassword("");
      navigate("/dashboard", { replace: true });
    } catch { setError("تعذّر الاتصال، حاول مجدداً"); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-background p-5 text-foreground shadow-card sm:p-6" dir="rtl">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <LockKeyhole className="h-6 w-6 shrink-0 text-accent" />
        <h2 className="text-lg font-bold">الدخول إلى لوحة الأسرة</h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="family-national-id">رقم هوية رب الأسرة</Label>
        <Input id="family-national-id" dir="ltr" inputMode="numeric" autoComplete="username" maxLength={9} value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-12 text-center" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="family-password">كلمة المرور</Label>
        <div className="relative">
          <Input id="family-password" type={visible ? "text" : "password"} dir="ltr" inputMode="numeric" autoComplete="current-password" maxLength={4} value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-12 px-12 text-center" required />
          <Button type="button" size="icon" variant="ghost" className="absolute end-1 top-1 h-10 w-10" aria-label={visible ? "إخفاء كلمة المرور" : "عرض كلمة المرور"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        </div>
        <p className="text-xs text-muted-foreground">الافتراضية سنة ميلاد رب الأسرة؛ إذا غيّرتها، أدخل كلمة المرور الجديدة.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-12 w-full gap-2" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} {busy ? "جارٍ الدخول…" : "دخول"}</Button>
    </form>
  );
};