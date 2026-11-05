import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ID_RE, idToEmail } from "@/lib/validators";
import { FAMILY_CODE_RE, toAuthPassword } from "@/lib/authPassword";
import { Eye, EyeOff, ArrowLeft, ArrowRight, Loader2, LockKeyhole, Search, UserPlus, ShieldAlert, MessageCircle } from "lucide-react";
import { waLink, SUPPORT_WHATSAPP } from "@/lib/contact";

type Step = "id" | "password" | "register" | "blocked";

export const FamilySignIn = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("id");
  const [nid, setNid] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reg, setReg] = useState({ full_name: "", birth_date: "", phone: "", gender: "male" });

  const call = (body: Record<string, unknown>) =>
    supabase.functions.invoke("family-register", { body });

  const signIn = async (code: string) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email: idToEmail(nid), password: toAuthPassword(code) });
    return e;
  };

  const checkId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ID_RE.test(nid)) return setError("أدخل رقم هوية مكوّناً من 9 أرقام");
    setBusy(true);
    try {
      const { data, error: err } = await call({ action: "check", national_id: nid });
      if (err || !data?.status) return setError("تعذّر الاتصال، حاول مجدداً");
      setStep(data.status === "account" ? "password" : data.status === "register" ? "register" : "blocked");
    } finally { setBusy(false); }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!FAMILY_CODE_RE.test(password)) return setError("أدخل كلمة المرور المكوّنة من 4 أرقام");
    setBusy(true);
    try {
      const err = await signIn(password);
      if (err) return setError(err.status === 429 ? "محاولات كثيرة، انتظر قليلاً" : "كلمة المرور غير صحيحة");
      navigate("/dashboard", { replace: true });
    } finally { setBusy(false); }
  };

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data, error: err } = await call({ action: "register", national_id: nid, ...reg });
      if (err || !data?.ok) {
        let msg = "تعذّر التسجيل";
        try { msg = (await (err as any)?.context?.json())?.error || data?.error || msg; } catch { /* ignore */ }
        return setError(msg);
      }
      const loginErr = await signIn(reg.birth_date.slice(0, 4));
      if (loginErr) return setError("تم إنشاء الحساب، ادخل بكلمة المرور (سنة الميلاد)");
      navigate("/my-application", { replace: true });
    } finally { setBusy(false); }
  };

  const back = () => { setStep("id"); setError(""); setPassword(""); };
  const steps = ["رقم الهوية", step === "register" ? "التسجيل" : "كلمة المرور"];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-card" dir="rtl">
      <div className="bg-gradient-to-l from-accent to-primary p-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-6 w-6" />
          <h2 className="text-lg font-bold">الدخول إلى لوحة الأسرة</h2>
        </div>
        <div className="mt-4 flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i === 0 || step !== "id" ? "bg-primary-foreground" : "bg-primary-foreground/30"}`} />
              <p className="mt-1 text-[11px] opacity-90">{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6 animate-fade-in" key={step}>
        {step === "id" && (
          <form onSubmit={checkId} className="space-y-4">
            <Label htmlFor="nid">رقم هوية رب الأسرة</Label>
            <Input id="nid" dir="ltr" inputMode="numeric" autoComplete="username" maxLength={9} value={nid}
              onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className="h-14 text-center text-xl tracking-[0.3em]" placeholder="•••••••••" autoFocus />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-12 w-full gap-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} متابعة
            </Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={doLogin} className="space-y-4">
            <IdChip nid={nid} onBack={back} />
            <Label htmlFor="pw">كلمة المرور</Label>
            <div className="relative">
              <Input id="pw" type={visible ? "text" : "password"} dir="ltr" inputMode="numeric" autoComplete="current-password"
                maxLength={4} value={password} autoFocus
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-14 px-12 text-center text-xl tracking-[0.5em]" />
              <Button type="button" size="icon" variant="ghost" className="absolute end-1 top-2 h-10 w-10"
                aria-label="عرض كلمة المرور" onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">الافتراضية: سنة ميلاد رب الأسرة (4 أرقام).</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-12 w-full gap-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} دخول
            </Button>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={doRegister} className="space-y-4">
            <IdChip nid={nid} onBack={back} />
            <div className="flex items-center gap-2 rounded-xl bg-accent-soft p-3 text-sm text-accent">
              <UserPlus className="h-4 w-4 shrink-0" /> هويتك معتمدة في المخيم — سجّل لأول مرة.
            </div>
            <div className="space-y-1.5">
              <Label>الاسم الرباعي لرب الأسرة</Label>
              <Input required value={reg.full_name} onChange={(e) => setReg({ ...reg, full_name: e.target.value })} className="h-12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>تاريخ الميلاد</Label>
                <Input required type="date" value={reg.birth_date} onChange={(e) => setReg({ ...reg, birth_date: e.target.value })} className="h-12" />
              </div>
              <div className="space-y-1.5">
                <Label>الجنس</Label>
                <div className="grid h-12 grid-cols-2 gap-1 rounded-md border border-input p-1">
                  {[["male", "ذكر"], ["female", "أنثى"]].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setReg({ ...reg, gender: v })}
                      className={`rounded text-sm font-semibold transition ${reg.gender === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>رقم التواصل</Label>
              <Input required dir="ltr" inputMode="tel" value={reg.phone} placeholder="059xxxxxxx"
                onChange={(e) => setReg({ ...reg, phone: e.target.value.replace(/\D/g, "").slice(0, 12) })} className="h-12 text-center" />
            </div>
            <p className="text-xs text-muted-foreground">كلمة المرور ستكون سنة ميلادك، ويمكنك تغييرها لاحقاً.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-12 w-full gap-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} إنشاء الحساب والمتابعة
            </Button>
          </form>
        )}

        {step === "blocked" && (
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="text-lg font-bold">رقم الهوية غير معتمد في المخيم</h3>
            <p className="text-sm text-muted-foreground">لا يمكن التسجيل إلا للأسر المعتمدة في سجل مخيم بركة 2. تواصل مع الإدارة لإضافتك.</p>
            <Button asChild className="h-12 w-full gap-2">
              <a href={waLink(SUPPORT_WHATSAPP, `السلام عليكم، أرغب بإضافة أسرتي لسجل مخيم بركة 2. رقم الهوية: ${nid}`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> تواصل عبر واتساب
              </a>
            </Button>
            <Button variant="ghost" onClick={back} className="gap-2"><ArrowRight className="h-4 w-4" /> رجوع</Button>
          </div>
        )}
      </div>
    </div>
  );
};

const IdChip = ({ nid, onBack }: { nid: string; onBack: () => void }) => (
  <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
    <span dir="ltr" className="font-mono font-bold tracking-widest">{nid}</span>
    <button type="button" onClick={onBack} className="text-xs font-semibold text-accent">تغيير</button>
  </div>
);
