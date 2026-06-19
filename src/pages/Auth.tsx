import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";
import { ID_RE, PHONE_RE, isFullName, idToEmail, ADMIN_NID, PIN_RE, SIGNIN_ID_RE } from "@/lib/validators";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAppSettings } from "@/hooks/useAppSettings";
import { DatePickerField } from "@/components/DatePickerField";
import { ShieldCheck, KeyRound, Sparkles, RefreshCw, ArrowRight, Search, UserPlus } from "lucide-react";

// A deterministic, server-generated initial password for new users.
// The user never sees or types it. After signup, they sign in via the
// passwordless-signin edge function which rotates this to a fresh value.
const initialSignupPassword = (nid: string) =>
  `Baraka2-Init-${nid}-${nid.split("").reverse().join("")}-2026`;

type Stage = "id" | "question" | "signup";

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const confirmAsk = useConfirm();

  useEffect(() => {
    if (!loading && user) {
      if (isAdmin) {
        navigate("/admin", { replace: true });
        return;
      }
      // If the head of family has not yet submitted family data, route
      // them to the application form so they can complete the missing info
      // (family size + members). Otherwise show the dashboard.
      (async () => {
        const { data: app } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        navigate(app ? "/dashboard" : "/my-application", { replace: true });
      })();
    }
  }, [user, isAdmin, loading, navigate]);

  // ============== Unified ID-first flow ==============
  const [nid, setNid] = useState("");
  const [stage, setStage] = useState<Stage>("id");
  const [busy, setBusy] = useState(false);
  const [nidErr, setNidErr] = useState("");
  const [answerErr, setAnswerErr] = useState("");

  // Question state (existing user)
  const [question, setQuestion] = useState<{
    question_id: string;
    kind: "national_id" | "birth_date" | "self_birth_date";
    label: string;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotHint, setForgotHint] = useState<string>("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const isAdminFlow = nid === ADMIN_NID;

  const openForgot = async () => {
    setForgotPhone("");
    setForgotOpen(true);
    const { data } = await supabase.rpc("get_phone_hint", { _nid: nid });
    setForgotHint((data as string) || "");
  };

  const performForget = async () => {
    if (!PHONE_RE.test(forgotPhone)) {
      toast.error(t("forgot_data.invalid_phone"));
      return;
    }
    if (!(await confirmAsk({
      title: t("forgot_data.confirm_title"),
      description: t("forgot_data.confirm_desc"),
      confirmText: t("forgot_data.confirm_btn"),
      variant: "danger",
    }))) return;
    setForgotBusy(true);
    const { data, error } = await supabase.functions.invoke("forget-account", {
      body: { national_id: nid, phone: forgotPhone },
    });
    setForgotBusy(false);
    if (error || !(data as any)?.ok) {
      toast.error((data as any)?.error || error?.message || t("toast.error"));
      return;
    }
    toast.success(t("forgot_data.deleted"));
    setForgotOpen(false);
    resetFlow();
    // Auto-route to signup with the same NID
    setSu((p) => ({ ...p, national_id: nid }));
    setStage("signup");
  };


  const fetchQuestion = async (excludeId?: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("get_random_security_question", {
      _nid: nid,
      _exclude_id: excludeId || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return null;
    }
    if (!data || (data as any[]).length === 0) {
      toast.error(t("toast.no_questions_available"));
      return null;
    }
    const q = (data as any[])[0];
    return {
      question_id: q.question_id,
      kind: q.kind as "national_id" | "birth_date" | "self_birth_date",
      label: q.label,
    };
  };

  const handleLookup = async () => {
    setNidErr("");
    if (!SIGNIN_ID_RE.test(nid)) {
      const m = nid.length === 0
        ? "يرجى إدخال رقم الهوية"
        : `رقم الهوية يجب أن يكون 9 أرقام بالضبط (أدخلت ${nid.length} رقم)`;
      setNidErr(m);
      toast.error(m, { duration: 5000 });
      return;
    }
    setBusy(true);

    // Admin path is no longer accessible from family auth — redirect to dedicated entry.
    if (isAdminFlow) {
      setBusy(false);
      toast.info("دخول الإدارة عبر الصفحة المخصصة");
      navigate("/admin-login", { replace: true });
      return;
    }

    // Check if a head-of-family account exists for this NID.
    const { data: exists, error } = await supabase.rpc("head_account_exists", { _nid: nid });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }

    if (exists === true) {
      // Existing user — try to fetch a security question. If no questions
      // available yet (e.g. no family members registered), inform user.
      const q = await fetchQuestion();
      if (!q) return;
      setQuestion(q);
      setAnswer("");
      setStage("question");
    } else {
      // New user — check camp approval BEFORE letting them into signup.
      if (!settingsLoading && !settings.registration_open) {
        toast.error(t("toast.registration_closed_now"));
        setBusy(false);
        return;
      }
      const { data: allowed } = await supabase.rpc("camp_id_allowed", { _nid: nid });
      if (allowed === false) {
        setBusy(false);
        setNidErr("رقم الهوية غير مُعتمد داخل المخيم");
        toast.error("عذراً، أنت غير معتمد داخل المخيم", {
          description: "رقم الهوية غير مُدرج ضمن قائمة الأسر المعتمدة. يُرجى التوجّه إلى إدارة المخيم لاعتماد أسرتك. وشكراً لتفهمكم.",
          duration: 8000,
        });
        return;
      }
      setSu((p) => ({ ...p, national_id: nid }));
      setStage("signup");
      setBusy(false);
    }
  };

  const askAnotherQuestion = async () => {
    const q = await fetchQuestion(question?.question_id);
    if (!q) return;
    setQuestion(q);
    setAnswer("");
    toast.info(t("toast.new_question_loaded"));
  };

  const performSignin = async () => {
    setBusy(true);
    try {
      if (isAdminFlow && !PIN_RE.test(adminPin)) {
        toast.error(t("form.invalid_pin"));
        setBusy(false);
        return;
      }
      if (!isAdminFlow && !answer.trim()) {
        toast.error(t("form.required"));
        setBusy(false);
        return;
      }
      const payload = isAdminFlow
        ? { national_id: nid, answer: { kind: "admin_pin" as const, value: adminPin } }
        : {
            national_id: nid,
            answer: {
              kind: question!.kind,
              question_id: question!.question_id,
              value: answer.trim(),
            },
          };
      const { data, error } = await supabase.functions.invoke("passwordless-signin", { body: payload });
      if (error || !(data as any)?.ok) {
        const reason = (data as any)?.error || error?.message;
        const m = reason || "كلمة المرور / الإجابة غير صحيحة";
        setAnswerErr(m);
        toast.error(m, {
          duration: 5000,
          description: !isAdminFlow ? t("toast.try_another_question") : undefined,
        });
        setBusy(false);
        return;
      }
      setAnswerErr("");
      toast.success(t("toast.answer_verified"));
      const password = (data as any).password as string;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: idToEmail(nid),
        password,
      });
      setBusy(false);
      if (signInErr) {
        const m = "بيانات الدخول غير صحيحة — تحقق وحاول مرة أخرى";
        setAnswerErr(m);
        toast.error(m, { duration: 5000 });
        return;
      }
      toast.success(t("toast.signin_success"));
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || t("toast.error");
      setAnswerErr(m);
      toast.error(m, { duration: 5000 });
    }
  };

  const resetFlow = () => {
    setStage("id");
    setQuestion(null);
    setAnswer("");
    setAdminPin("");
  };

  // ============== Sign-up state ==============
  const [su, setSu] = useState({
    national_id: "",
    full_name: "",
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
  };

  const validateAll = (): boolean => {
    const keys = ["national_id", "full_name", "birth_date", "phone", "alt_phone", "marital_status_other"];
    const next: Record<string, string> = {};
    let ok = true;
    for (const k of keys) {
      const msg = validateField(k, (su as any)[k]);
      if (msg) {
        next[k] = msg;
        ok = false;
      } else next[k] = "";
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
    if (!validateAll()) {
      toast.error(t("toast.fix_errors"));
      return;
    }
    if (
      !(await confirmAsk({
        title: t("confirm.create_account_title"),
        description: t("confirm.create_account"),
        confirmText: t("auth.signup_btn"),
        variant: "default",
      }))
    )
      return;
    setSuBusy(true);
    const { data: dup } = await supabase.rpc("national_id_exists", { _nid: su.national_id });
    if (dup === true) {
      setSuBusy(false);
      setErrors((p) => ({ ...p, national_id: t("field_errors.id_duplicate") }));
      toast.error(t("toast.id_exists_with_data", { id: su.national_id }));
      return;
    }
    // Camp lock — check approval BEFORE creating the account so the user
    // sees the "not approved" message right after entering the national ID,
    // not after filling the whole application.
    if (su.national_id !== ADMIN_NID) {
      const { data: allowed } = await supabase.rpc("camp_id_allowed", { _nid: su.national_id });
      if (allowed === false) {
        setSuBusy(false);
        setErrors((p) => ({ ...p, national_id: "رقم الهوية غير مُعتمد داخل المخيم" }));
        toast.error("عذراً، أنت غير معتمد داخل المخيم", {
          description: "رقم الهوية غير مُدرج ضمن قائمة الأسر المعتمدة. يُرجى التوجّه إلى إدارة المخيم لاعتماد أسرتك. وشكراً لتفهمكم.",
          duration: 8000,
        });
        return;
      }
    }
    const { error } = await supabase.auth.signUp({
      email: idToEmail(su.national_id),
      password: initialSignupPassword(su.national_id),
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
      } else toast.error(error.message);
      return;
    }
    toast.success(t("toast.signup_success"));
    // Take the new head-of-family directly to the application form so they
    // can enter family size, residence, and each member's data immediately.
    setTimeout(() => navigate("/my-application", { replace: true }), 200);
  };

  // ============================================================
  return (
    <Layout>
      <section className="container py-10 max-w-2xl">
        <Card className="p-6 md:p-8 shadow-elegant">
          {/* Branded header */}
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs text-accent font-bold">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("auth.unified_title")}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary">
              {stage === "id" && t("auth.signin_title")}
              {stage === "question" && t("auth.passwordless_title")}
              {stage === "signup" && t("auth.signup_title")}
            </h1>
            {stage === "id" && (
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("auth.unified_intro")}</p>
            )}
          </div>

          {/* ============== STAGE 1: ID lookup ============== */}
          {stage === "id" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="space-y-4 animate-fade-in"
            >
              <div>
                <Label className="font-semibold">{t("form.national_id")}</Label>
                <div className="relative mt-1">
                  <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    inputMode="numeric"
                    maxLength={9}
                    required
                    autoFocus
                    value={nid}
                    placeholder={t("form.id_or_admin_placeholder")}
                    className={`ps-9 text-lg tracking-wider ${nidErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    onChange={(e) => { setNidErr(""); setNid(e.target.value.replace(/\D/g, "").slice(0, 9)); }}
                  />
                </div>
                {nidErr && (
                  <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/40 p-2 text-sm text-destructive font-semibold">
                    {nidErr}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {t("auth.unified_intro")}
                </p>
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full brand-gradient text-primary-foreground gap-2 h-11 text-base"
              >
                {busy ? t("auth.lookup_busy") : (
                  <>
                    <ArrowRight className="h-4 w-4" /> {t("auth.lookup_btn")}
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ============== STAGE 2: Security question (or admin PIN) ============== */}
          {stage === "question" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                performSignin();
              }}
              className="space-y-4 animate-fade-in"
            >
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-start gap-3">
                <div className="rounded-full bg-success/15 p-2 shrink-0">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
                <div className="text-sm">
                  <div className="font-bold text-primary">{t("auth.existing_user_hint")}</div>
                  <div className="text-xs text-muted-foreground mt-1" dir="ltr">
                    {t("form.national_id")}: <strong>{nid}</strong>
                  </div>
                </div>
              </div>

              {isAdminFlow ? (
                <div>
                  <Label className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-accent" />
                    {t("auth.admin_pin_label")}
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    autoFocus
                    placeholder="••••"
                    value={adminPin}
                    onChange={(e) => { setAnswerErr(""); setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4)); }}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-accent" />
                      {question?.kind === "national_id"
                        ? t("forgot.q_nid", { name: question?.label })
                        : question?.kind === "self_birth_date"
                        ? t("forgot.q_self_birth", { name: question?.label })
                        : t("forgot.q_birth", { name: question?.label })}
                    </Label>
                    {question?.kind === "national_id" ? (
                      <Input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={answer}
                        onChange={(e) => { setAnswerErr(""); setAnswer(e.target.value.replace(/\D/g, "").slice(0, 9)); }}
                      />
                    ) : (
                      <>
                        <DatePickerField
                          value={answer}
                          disableFuture
                          minYear={1900}
                          autoOpen
                          onChange={setAnswer}
                          placeholder="اضغط هنا لفتح التقويم واختيار تاريخ الميلاد"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          اختر التاريخ من التقويم — اختر السنة ثم الشهر ثم اليوم.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={askAnotherQuestion}
                      disabled={busy}
                      className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> {t("auth.another_question")}
                    </button>
                    <button
                      type="button"
                      onClick={openForgot}
                      disabled={busy}
                      className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                    >
                      {t("forgot_data.btn")}
                    </button>
                  </div>
                </>
              )}

              {answerErr && (
                <div className="rounded-md bg-destructive/10 border border-destructive/40 p-2 text-sm text-destructive font-semibold text-center">
                  {answerErr}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFlow}
                  className="flex-shrink-0"
                >
                  {t("auth.change_id")}
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="flex-1 brand-gradient text-primary-foreground gap-2"
                >
                  {busy ? "..." : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> {t("auth.verify_signin")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ============== STAGE 3: Signup (no head account exists) ============== */}
          {stage === "signup" && (
            <>
              {!settingsLoading && !settings.registration_open ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center space-y-2">
                  <div className="font-bold text-destructive">{t("closed.title")}</div>
                  <p className="text-sm text-muted-foreground">{t("closed.subtitle")}</p>
                  {settings.closed_reason && (
                    <div className="text-sm bg-background rounded p-3 text-start mt-2">
                      <strong>{t("closed.reason_label")}:</strong> {settings.closed_reason}
                    </div>
                  )}
                  <Button variant="outline" className="mt-3" onClick={resetFlow}>
                    {t("auth.change_id")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4 animate-fade-in" noValidate>
                  <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent-soft/40 to-background p-4 flex items-start gap-3">
                    <div className="rounded-full bg-accent/20 p-2 shrink-0">
                      <UserPlus className="h-5 w-5 text-accent" />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold text-primary">{t("auth.new_user_hint")}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        لا تحتاج إلى كلمة مرور — سنحمي حسابك تلقائياً عبر بياناتك الشخصية وبيانات أفراد عائلتك.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>{t("form.national_id")} <span className="text-destructive">*</span></Label>
                      <Input
                        inputMode="numeric"
                        maxLength={9}
                        value={su.national_id}
                        placeholder="9 أرقام"
                        aria-invalid={!!errors.national_id}
                        className={errors.national_id ? "border-destructive focus-visible:ring-destructive" : ""}
                        onBlur={() =>
                          setErrors((p) => ({ ...p, national_id: validateField("national_id", su.national_id) }))
                        }
                        onChange={(e) => setField("national_id", e.target.value.replace(/\D/g, "").slice(0, 9))}
                      />
                      {errors.national_id && <p className="text-xs text-destructive mt-1">{errors.national_id}</p>}
                    </div>
                    <div>
                      <Label>{t("form.full_name")} <span className="text-destructive">*</span></Label>
                      <Input
                        value={su.full_name}
                        placeholder="الاسم الأول الأب الجد العائلة"
                        aria-invalid={!!errors.full_name}
                        className={errors.full_name ? "border-destructive focus-visible:ring-destructive" : ""}
                        onBlur={() =>
                          setErrors((p) => ({ ...p, full_name: validateField("full_name", su.full_name) }))
                        }
                        onChange={(e) => setField("full_name", e.target.value)}
                      />
                      {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                    </div>
                    <div>
                      <Label>{t("form.birth_date")} <span className="text-destructive">*</span></Label>
                      <DatePickerField
                        value={su.birth_date}
                        disableFuture
                        invalid={!!errors.birth_date}
                        onBlur={() =>
                          setErrors((p) => ({ ...p, birth_date: validateField("birth_date", su.birth_date) }))
                        }
                        onChange={(v) => setField("birth_date", v)}
                      />
                      {errors.birth_date && <p className="text-xs text-destructive mt-1">{errors.birth_date}</p>}
                      {su.birth_date && !errors.birth_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("form.age")}: {age} {t("form.years")}
                        </div>
                      )}
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
                      <Input
                        inputMode="numeric"
                        maxLength={10}
                        value={su.phone}
                        placeholder="059xxxxxxx"
                        aria-invalid={!!errors.phone}
                        className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                        onBlur={() => setErrors((p) => ({ ...p, phone: validateField("phone", su.phone) }))}
                        onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      />
                      {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                      <Label>{t("form.alt_phone")}</Label>
                      <Input
                        inputMode="numeric"
                        maxLength={10}
                        value={su.alt_phone}
                        placeholder="059xxxxxxx"
                        aria-invalid={!!errors.alt_phone}
                        className={errors.alt_phone ? "border-destructive focus-visible:ring-destructive" : ""}
                        onBlur={() =>
                          setErrors((p) => ({ ...p, alt_phone: validateField("alt_phone", su.alt_phone) }))
                        }
                        onChange={(e) => setField("alt_phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      />
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
                          <Input
                            className={`mt-2 ${errors.marital_status_other ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            placeholder={t("form.specify")}
                            value={su.marital_status_other}
                            onBlur={() =>
                              setErrors((p) => ({
                                ...p,
                                marital_status_other: validateField("marital_status_other", su.marital_status_other),
                              }))
                            }
                            onChange={(e) => setField("marital_status_other", e.target.value)}
                          />
                          {errors.marital_status_other && (
                            <p className="text-xs text-destructive mt-1">{errors.marital_status_other}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <Card className="p-4 bg-accent-soft/50 border-accent/30">
                    <h3 className="font-semibold text-primary mb-3">{t("health.title")}</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>{t("health.is_war_injured")}</Label>
                        <RadioGroup
                          className="flex gap-4 mt-1"
                          value={su.is_war_injured ? "yes" : "no"}
                          onValueChange={(v) => setSu({ ...su, is_war_injured: v === "yes" })}
                        >
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

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={resetFlow}>
                      {t("auth.change_id")}
                    </Button>
                    <Button type="submit" disabled={suBusy} className="flex-1 brand-gradient text-primary-foreground gap-2">
                      <Sparkles className="h-4 w-4" /> {t("auth.signup_btn")}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          <div className="text-center mt-6 pt-4 border-t border-border/40">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
              {t("auth.back")}
            </Link>
          </div>
        </Card>
      </section>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t("forgot_data.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("forgot_data.warning")}</p>
            <div>
              <Label>{t("form.phone")}</Label>
              <Input
                inputMode="numeric"
                maxLength={10}
                placeholder="059xxxxxxx"
                value={forgotPhone}
                onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              {forgotHint && (
                <p className="text-[11px] text-muted-foreground mt-1" dir="ltr">
                  {t("forgot_data.hint")}: <strong>{forgotHint}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>{t("form.cancel")}</Button>
            <Button variant="destructive" onClick={performForget} disabled={forgotBusy}>
              {forgotBusy ? "..." : t("forgot_data.confirm_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Auth;
