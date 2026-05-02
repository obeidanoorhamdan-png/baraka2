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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";

const idRe = /^\d{9}$/;
const phoneRe = /^\d{8,15}$/;

const Auth = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const initial = params.get("mode") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState<"signin" | "signup">(initial);

  useEffect(() => {
    if (!loading && user) {
      navigate(isAdmin ? "/admin" : "/my-application", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  // signin
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siBusy, setSiBusy] = useState(false);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword });
    setSiBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("toast.signin_success"));
  };

  // signup
  const [su, setSu] = useState({
    national_id: "",
    full_name: "",
    email: "",
    password: "",
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
  const age = calculateAge(su.birth_date);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z.object({
      national_id: z.string().regex(idRe, t("form.invalid_id")),
      full_name: z.string().trim().min(3, t("form.required")).max(120),
      email: z.string().trim().email(t("form.invalid_email")).max(255),
      password: z.string().min(6, t("form.password_min")).max(72),
      phone: z.string().regex(phoneRe, t("form.invalid_phone")),
      alt_phone: z.string().regex(phoneRe).optional().or(z.literal("")),
      birth_date: z.string().min(1, t("form.required")),
      marital_status_other: su.marital_status === "other" ? z.string().trim().min(1, t("form.required")) : z.string().optional(),
    });
    const parsed = schema.safeParse(su);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSuBusy(true);
    const { error } = await supabase.auth.signUp({
      email: su.email,
      password: su.password,
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
      if (error.message.toLowerCase().includes("already")) toast.error(t("toast.email_exists"));
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
                  <Label>{t("auth.email")}</Label>
                  <Input type="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                </div>
                <div>
                  <Label>{t("auth.password")}</Label>
                  <Input type="password" required value={siPassword} onChange={(e) => setSiPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={siBusy} className="w-full brand-gradient text-primary-foreground">
                  {t("auth.signin_btn")}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.no_account")}{" "}
                  <button type="button" onClick={() => setTab("signup")} className="text-accent font-semibold underline-offset-4 hover:underline">
                    {t("auth.signup_link")}
                  </button>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>{t("form.national_id")}</Label>
                    <Input inputMode="numeric" maxLength={9} required value={su.national_id}
                      onChange={(e) => setSu({ ...su, national_id: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div>
                    <Label>{t("form.full_name")}</Label>
                    <Input required value={su.full_name} onChange={(e) => setSu({ ...su, full_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("auth.email")}</Label>
                    <Input type="email" required value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("auth.password")}</Label>
                    <Input type="password" required value={su.password} onChange={(e) => setSu({ ...su, password: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("form.birth_date")}</Label>
                    <Input type="date" required value={su.birth_date} onChange={(e) => setSu({ ...su, birth_date: e.target.value })} />
                    {su.birth_date && <div className="text-xs text-muted-foreground mt-1">{t("form.age")}: {age} {t("form.years")}</div>}
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
                    <Label>{t("form.phone")}</Label>
                    <Input inputMode="numeric" required value={su.phone}
                      onChange={(e) => setSu({ ...su, phone: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div>
                    <Label>{t("form.alt_phone")}</Label>
                    <Input inputMode="numeric" value={su.alt_phone}
                      onChange={(e) => setSu({ ...su, alt_phone: e.target.value.replace(/\D/g, "") })} />
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
                      <Input className="mt-2" placeholder={t("form.specify")} value={su.marital_status_other}
                        onChange={(e) => setSu({ ...su, marital_status_other: e.target.value })} />
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
            </TabsContent>
          </Tabs>

          <div className="text-center mt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">{t("auth.back")}</Link>
          </div>
        </Card>
      </section>
    </Layout>
  );
};

export default Auth;
