import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";
import { ID_RE, PHONE_RE, isFullName, idToEmail, ADMIN_NID, PIN_RE, SIGNIN_ID_RE } from "@/lib/validators";
import { pinToAuthPassword } from "@/lib/authPin";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAppSettings } from "@/hooks/useAppSettings";
import { KeyRound } from "lucide-react";

const Auth = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const initial = params.get("mode") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState<"signin" | "signup">(initial);
  const [forgotOpen, setForgotOpen] = useState(false);
  const confirmAsk = useConfirm();

  useEffect(() => {
    if (!loading && user) {
      navigate(isAdmin ? "/admin" : "/my-application", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  // ---------------- Sign in (national_id + password) ----------------
  const [siNid, setSiNid] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siBusy, setSiBusy] = useState(false);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SIGNIN_ID_RE.test(siNid)) { toast.error(t("form.invalid_id")); return; }
    if (!PIN_RE.test(siPassword)) { toast.error(t("form.invalid_pin")); return; }
    setSiBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: idToEmail(siNid),
      password: pinToAuthPassword(siPassword),
    });
    const finalError = error
      ? (await supabase.auth.signInWithPassword({ email: idToEmail(siNid), password: siPassword })).error
      : null;
    setSiBusy(false);
    if (finalError) {
      toast.error(t("toast.invalid_credentials"));
      return;
    }
    toast.success(t("toast.signin_success"));
  };

  // ---------------- Sign up ----------------
  const [su, setSu] = useState({
    national_id: "",
    full_name: "",
    password: "",
    password_confirm: "",
    phone: "",
    alt_phone: "",
    birth_date: "",
    gender: "male" as "male" | "female",
    marital_status: "single" as "married" | "single" | "widowed" | "divorced" | "other",
    marital_status_other: "",
    is_war_injured: false,
    chronic_diseases: "",
    health_notes: "",
  });
  const [suBusy, setSuBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const age = calculateAge(su.birth_date);

  const validateField = (key: string, value: any, full = su): string => {
    switch (key) {
      case "national_id":
        if (!value) return t("field_errors.id_required");
        if (!ID_RE.test(value)) return t("field_errors.id_format");
        return "";
      case "full_name":
        if (!value?.trim()) return t("field_errors.name_required");
        if (!isFullName(value)) return t("field_errors.name_format");
        return "";
      case "password":
        if (!value) return t("field_errors.pin_required");
        if (!PIN_RE.test(value)) return t("field_errors.pin_format");
        return "";
      case "password_confirm":
        if (!value) return t("field_errors.pin_confirm_required");
        if (value !== full.password) return t("field_errors.pin_mismatch");
        return "";
      case "birth_date":
        if (!value) return t("field_errors.birth_required");
        if (new Date(value) > new Date()) return t("field_errors.birth_future");
        return "";
      case "phone":
        if (!value) return t("field_errors.phone_required");
        if (!PHONE_RE.test(value)) return t("field_errors.phone_format");
        return "";
      case "alt_phone":
        if (value && !PHONE_RE.test(value)) return t("field_errors.phone_format");
        return "";
      case "marital_status_other":
        if (full.marital_status === "other" && !value?.trim()) return t("field_errors.marital_other_required");
        return "";
    }
    return "";
  };

  const setField = (key: keyof typeof su, value: any) => {
    const next = { ...su, [key]: value };
    setSu(next);
    if (errors[key] !== undefined) {
      setErrors((p) => ({ ...p, [key]: validateField(key, value, next) }));
    }
    if (key === "password" && errors.password_confirm !== undefined) {
      setErrors((p) => ({ ...p, password_confirm: validateField("password_confirm", next.password_confirm, next) }));
    }
  };

  const validateAll = (): boolean => {
    const keys = ["national_id","full_name","password","password_confirm","birth_date","phone","alt_phone","marital_status_other"];
    const next: Record<string, string> = {};
    let ok = true;
    for (const k of keys) {
      const msg = validateField(k, (su as any)[k]);
      if (msg) { next[k] = msg; ok = false; } else next[k] = "";
    }
    setErrors(next);
    return ok;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.registration_open && su.national_id !== ADMIN_NID) {
      toast.error(t("toast.registration_closed_now"));
      return;
    }
    if (!validateAll()) { toast.error(t("toast.fix_errors")); return; }

    if (!(await confirmAsk({
      title: t("confirm.create_account_title"),
      description: t("confirm.create_account"),
      confirmText: t("auth.signup_btn"),
      variant: "default",
    }))) return;
    setSuBusy(true);
    const { data: dup } = await supabase.rpc("national_id_exists", { _nid: su.national_id });
    if (dup === true) {
      setSuBusy(false);
      setErrors((p) => ({ ...p, national_id: t("field_errors.id_duplicate") }));
      toast.error(t("toast.id_exists_with_data", { id: su.national_id }));
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: idToEmail(su.national_id),
      password: pinToAuthPassword(su.password),
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          national_id: su.national_id,
          full_name: su.full_name,
          phone: su.phone,
          alt_phone: su.alt_phone || null,
          birth_date: su.birth_date,
          gender: su.gender,
          marital_status: su.marital_status,
          marital_status_other: su.marital_status_other || null,
          is_war_injured: su.is_war_injured,
          chronic_diseases: su.chronic_diseases || null,
          health_notes: su.health_notes || null,
        },
      },
    });
    setSuBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        setErrors((p) => ({ ...p, national_id: t("field_errors.id_duplicate") }));
        toast.error(t("toast.id_exists"));
      }
      else toast.error(error.message);
      return;
    }
    toast.success(t("toast.signup_success"));
  };

  return (
    <Layout>
      <section className="container py-10 max-w-2xl">
        <Card className="p-6 md:p-8 shadow-elegant">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signup">{t("auth.signup_title")}</TabsTrigger>
              <TabsTrigger value="signin">{t("auth.signin_title")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignin} className="space-y-4">
                <div>
                  <Label>{t("form.national_id")}</Label>
                  <Input inputMode="numeric" maxLength={9} required value={siNid}
                    placeholder={t("form.id_or_admin_placeholder")}
                    onChange={(e) => setSiNid(e.target.value.replace(/\D/g, "").slice(0, 9))} />
                </div>
                <div>
                  <Label>{t("auth.password")} <span className="text-xs text-muted-foreground">({t("form.pin_hint")})</span></Label>
                  <Input type="password" inputMode="numeric" maxLength={4} required
                    placeholder="••••"
                    value={siPassword}
                    onChange={(e) => setSiPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
                <Button type="submit" disabled={siBusy} className="w-full brand-gradient text-primary-foreground">
                  {t("auth.signin_btn")}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => setForgotOpen(true)}
                    className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" /> {t("auth.forgot")}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.no_account")}{" "}
                  <button type="button" onClick={() => setTab("signup")} className="text-accent font-semibold underline-offset-4 hover:underline">
                    {t("auth.signup_link")}
                  </button>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              {!settingsLoading && !settings.registration_open ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center space-y-2">
                  <div className="font-bold text-destructive">{t("closed.title")}</div>
                  <p className="text-sm text-muted-foreground">{t("closed.subtitle")}</p>
                  {settings.closed_reason && (
                    <div className="text-sm bg-background rounded p-3 text-start mt-2">
                      <strong>{t("closed.reason_label")}:</strong> {settings.closed_reason}
                    </div>
                  )}
                </div>
              ) : (
              <form onSubmit={handleSignup} className="space-y-4" noValidate>
                <p className="text-xs text-muted-foreground bg-accent-soft/40 p-2 rounded border border-accent/20">
                  {t("auth_extra.after_signup_hint")}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>{t("form.national_id")} <span className="text-destructive">*</span></Label>
                    <Input inputMode="numeric" maxLength={9} value={su.national_id}
                      placeholder="9 أرقام" aria-invalid={!!errors.national_id}
                      className={errors.national_id ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, national_id: validateField("national_id", su.national_id) }))}
                      onChange={(e) => setField("national_id", e.target.value.replace(/\D/g, "").slice(0, 9))} />
                    {errors.national_id && <p className="text-xs text-destructive mt-1">{errors.national_id}</p>}
                  </div>
                  <div>
                    <Label>{t("form.full_name")} <span className="text-destructive">*</span></Label>
                    <Input value={su.full_name} placeholder="الاسم الأول الأب الجد العائلة"
                      aria-invalid={!!errors.full_name}
                      className={errors.full_name ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, full_name: validateField("full_name", su.full_name) }))}
                      onChange={(e) => setField("full_name", e.target.value)} />
                    {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                  </div>
                  <div>
                    <Label>{t("auth.password")} <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground">({t("form.pin_hint")})</span></Label>
                    <Input type="password" inputMode="numeric" maxLength={4}
                      placeholder="••••" value={su.password}
                      aria-invalid={!!errors.password}
                      className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, password: validateField("password", su.password) }))}
                      onChange={(e) => setField("password", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <Label>{t("auth_extra.password_confirm")} <span className="text-destructive">*</span></Label>
                    <Input type="password" inputMode="numeric" maxLength={4}
                      placeholder="••••" value={su.password_confirm}
                      aria-invalid={!!errors.password_confirm}
                      className={errors.password_confirm ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, password_confirm: validateField("password_confirm", su.password_confirm) }))}
                      onChange={(e) => setField("password_confirm", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    {errors.password_confirm && <p className="text-xs text-destructive mt-1">{errors.password_confirm}</p>}
                  </div>
                  <div>
                    <Label>{t("form.birth_date")} <span className="text-destructive">*</span></Label>
                    <Input type="date" value={su.birth_date}
                      max={new Date().toISOString().split("T")[0]}
                      aria-invalid={!!errors.birth_date}
                      className={errors.birth_date ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, birth_date: validateField("birth_date", su.birth_date) }))}
                      onChange={(e) => setField("birth_date", e.target.value)} />
                    {errors.birth_date && <p className="text-xs text-destructive mt-1">{errors.birth_date}</p>}
                    {su.birth_date && !errors.birth_date && <div className="text-xs text-muted-foreground mt-1">{t("form.age")}: {age} {t("form.years")}</div>}
                  </div>
                  <div>
                    <Label>{t("form.gender")}</Label>
                    <Select value={su.gender} onValueChange={(v) => setSu({ ...su, gender: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t("form.male")}</SelectItem>
                        <SelectItem value="female">{t("form.female")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("form.phone")} <span className="text-destructive">*</span></Label>
                    <Input inputMode="numeric" maxLength={10} value={su.phone} placeholder="059xxxxxxx"
                      aria-invalid={!!errors.phone}
                      className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, phone: validateField("phone", su.phone) }))}
                      onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <Label>{t("form.alt_phone")}</Label>
                    <Input inputMode="numeric" maxLength={10} value={su.alt_phone} placeholder="059xxxxxxx"
                      aria-invalid={!!errors.alt_phone}
                      className={errors.alt_phone ? "border-destructive focus-visible:ring-destructive" : ""}
                      onBlur={() => setErrors((p) => ({ ...p, alt_phone: validateField("alt_phone", su.alt_phone) }))}
                      onChange={(e) => setField("alt_phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                    {errors.alt_phone && <p className="text-xs text-destructive mt-1">{errors.alt_phone}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t("form.marital_status")}</Label>
                    <Select value={su.marital_status} onValueChange={(v) => setSu({ ...su, marital_status: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="married">{t("form.married")}</SelectItem>
                        <SelectItem value="single">{t("form.single")}</SelectItem>
                        <SelectItem value="widowed">{t("form.widowed")}</SelectItem>
                        <SelectItem value="divorced">{t("form.divorced")}</SelectItem>
                        <SelectItem value="other">{t("form.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {su.marital_status === "other" && (
                      <>
                        <Input className={`mt-2 ${errors.marital_status_other ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          placeholder={t("form.specify")} value={su.marital_status_other}
                          onBlur={() => setErrors((p) => ({ ...p, marital_status_other: validateField("marital_status_other", su.marital_status_other) }))}
                          onChange={(e) => setField("marital_status_other", e.target.value)} />
                        {errors.marital_status_other && <p className="text-xs text-destructive mt-1">{errors.marital_status_other}</p>}
                      </>
                    )}
                  </div>
                </div>

                <Card className="p-4 bg-accent-soft/50 border-accent/30">
                  <h3 className="font-semibold text-primary mb-3">{t("health.title")}</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>{t("health.is_war_injured")}</Label>
                      <RadioGroup className="flex gap-4 mt-1" value={su.is_war_injured ? "yes" : "no"}
                        onValueChange={(v) => setSu({ ...su, is_war_injured: v === "yes" })}>
                        <label className="flex items-center gap-2"><RadioGroupItem value="yes" />{t("health.yes")}</label>
                        <label className="flex items-center gap-2"><RadioGroupItem value="no" />{t("health.no")}</label>
                      </RadioGroup>
                      {su.is_war_injured && (
                        <p className="text-xs text-warning-foreground bg-warning/20 p-2 rounded mt-2">
                          {t("health.report_required")} — يمكن رفعه بعد إنشاء الحساب من صفحة الطلب.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>{t("health.chronic")}</Label>
                      <Textarea rows={2} value={su.chronic_diseases} onChange={(e) => setSu({ ...su, chronic_diseases: e.target.value })} />
                    </div>
                    <div>
                      <Label>{t("health.notes")}</Label>
                      <Textarea rows={2} value={su.health_notes} onChange={(e) => setSu({ ...su, health_notes: e.target.value })} />
                    </div>
                  </div>
                </Card>

                <Button type="submit" disabled={suBusy} className="w-full brand-gradient text-primary-foreground">
                  {t("auth.signup_btn")}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.have_account")}{" "}
                  <button type="button" onClick={() => setTab("signin")} className="text-accent font-semibold underline-offset-4 hover:underline">
                    {t("auth.signin_link")}
                  </button>
                </p>
              </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-center mt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">{t("auth.back")}</Link>
          </div>
        </Card>

        <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
      </section>
    </Layout>
  );
};

export default Auth;

// ===================================================================
// Forgot Password — answer 2 random family questions, then reset
// ===================================================================
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type SecQ = { question_id: string; kind: "national_id" | "birth_date"; label: string };

const ForgotPasswordDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [stage, setStage] = useState<"id" | "questions" | "reset">("id");
  const [nid, setNid] = useState("");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<SecQ[]>([]);
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const reset = () => {
    setStage("id"); setNid(""); setQuestions([]); setAnswers(["", ""]); setNewPw(""); setNewPw2("");
  };

  const startQuestions = async () => {
    if (!ID_RE.test(nid)) { toast.error(t("form.invalid_id")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("get_security_questions", { _nid: nid });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length < 2) {
      toast.error(t("toast.no_questions_available"));
      return;
    }
    setQuestions(data as SecQ[]);
    setStage("questions");
  };

  const verifyAnswers = async () => {
    if (!answers[0] || !answers[1]) { toast.error(t("form.required")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_security_answers", {
      _nid: nid,
      _q1: questions[0].question_id, _k1: questions[0].kind, _v1: answers[0].trim(),
      _q2: questions[1].question_id, _k2: questions[1].kind, _v2: answers[1].trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data !== true) { toast.error(t("toast.wrong_answers")); return; }
    setStage("reset");
  };

  const performReset = async () => {
    if (!PIN_RE.test(newPw)) { toast.error(t("form.invalid_pin")); return; }
    if (newPw !== newPw2) { toast.error(t("toast.password_mismatch")); return; }
    if (!(await confirmAsk({
      title: t("confirm.reset_password_title"),
      description: t("confirm.reset_password"),
      confirmText: t("forgot.save_password"),
      variant: "warning",
    }))) return;
    setBusy(true);
    // Sign in with a temporary recovery using the verify RPC outcome:
    // we call an edge function or rely on supabase.auth.updateUser? updateUser requires session.
    // Strategy: sign in is impossible without password. So we must use a server-side reset via Edge Function.
    // For simplicity & per spec, we use a publicly callable edge function `reset-password`.
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: {
        national_id: nid,
        new_password: newPw,
        q1: { id: questions[0].question_id, kind: questions[0].kind, value: answers[0].trim() },
        q2: { id: questions[1].question_id, kind: questions[1].kind, value: answers[1].trim() },
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || t("toast.error"));
      return;
    }
    toast.success(t("toast.password_reset_success"));
    reset(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("auth.forgot")}</DialogTitle></DialogHeader>

        {stage === "id" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("forgot.intro")}</p>
            <Label>{t("form.national_id")}</Label>
            <Input inputMode="numeric" maxLength={9} value={nid}
              onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))} />
            <DialogFooter>
              <Button onClick={startQuestions} disabled={busy} className="brand-gradient text-primary-foreground">
                {t("forgot.next")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "questions" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("forgot.answer_intro")}</p>
            {questions.map((q, i) => (
              <div key={q.question_id + i}>
                <Label>
                  {q.kind === "national_id" ? t("forgot.q_nid", { name: q.label }) : t("forgot.q_birth", { name: q.label })}
                </Label>
                <Input
                  type={q.kind === "birth_date" ? "date" : "text"}
                  inputMode={q.kind === "national_id" ? "numeric" : undefined}
                  maxLength={q.kind === "national_id" ? 9 : undefined}
                  value={answers[i]}
                  onChange={(e) => {
                    const v = q.kind === "national_id" ? e.target.value.replace(/\D/g, "").slice(0, 9) : e.target.value;
                    setAnswers((a) => a.map((x, idx) => (idx === i ? v : x)));
                  }}
                />
              </div>
            ))}
            <DialogFooter>
              <Button onClick={verifyAnswers} disabled={busy} className="brand-gradient text-primary-foreground">
                {t("forgot.verify")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "reset" && (
          <div className="space-y-3">
            <p className="text-sm text-success font-semibold">{t("forgot.verified")}</p>
            <Label>{t("forgot.new_password")} <span className="text-xs text-muted-foreground">({t("form.pin_hint")})</span></Label>
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={newPw} onChange={(e) => setNewPw(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <Label>{t("forgot.new_password_confirm")}</Label>
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={newPw2} onChange={(e) => setNewPw2(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <DialogFooter>
              <Button onClick={performReset} disabled={busy} className="brand-gradient text-primary-foreground">
                {t("forgot.save_password")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
