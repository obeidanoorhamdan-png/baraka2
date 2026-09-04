import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { toAuthPassword, FAMILY_CODE_RE } from "@/lib/authPassword";

export const PasswordCard = () => {
  const [cur, setCur] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    if (!FAMILY_CODE_RE.test(cur)) return setErr("أدخل كلمة المرور الحالية (4 أرقام)");
    if (!FAMILY_CODE_RE.test(a)) return setErr("كلمة المرور الجديدة يجب أن تكون 4 أرقام فقط");
    if (a !== b) return setErr("كلمتا المرور غير متطابقتين");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: toAuthPassword(a),
      current_password: toAuthPassword(cur),
    } as any);
    setBusy(false);
    if (error) return setErr("تعذّر التغيير — تأكد من كلمة المرور الحالية");
    setCur(""); setA(""); setB("");
    toast.success("تم تغيير كلمة المرور بنجاح");
  };

  return (
    <Card className="p-4 sm:p-5 shadow-card border-accent/20">
      <h2 className="mb-3 inline-flex items-center gap-2 font-extrabold text-accent">
        <KeyRound className="h-5 w-5" /> الإعدادات — تغيير كلمة المرور
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        كلمة المرور مكوّنة من 4 أرقام. الافتراضية هي سنة ميلاد رب الأسرة.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { v: cur, set: setCur, p: "الحالية" },
          { v: a, set: setA, p: "الجديدة" },
          { v: b, set: setB, p: "تأكيد الجديدة" },
        ].map((f) => (
          <input
            key={f.p}
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder={f.p}
            className="h-11 rounded-xl border border-input bg-background px-3 text-center tracking-[0.4em]"
            value={f.v}
            onChange={(e) => { setErr(""); f.set(e.target.value.replace(/\D/g, "").slice(0, 4)); }}
          />
        ))}
      </div>
      {err && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-center text-sm font-semibold text-destructive">
          {err}
        </div>
      )}
      <Button onClick={save} disabled={busy} className="mt-3 w-full gap-2">
        <KeyRound className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
      </Button>
    </Card>
  );
};
