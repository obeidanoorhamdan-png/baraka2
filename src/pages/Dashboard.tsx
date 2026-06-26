import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home, FileText, PackageCheck, MessageCircle, ShieldCheck, HelpCircle, Phone,
  Users, CheckCircle2, Clock, XCircle, UserCog, MapPin, HeartPulse, Bell,
  CalendarDays, IdCard, Sparkles, Plus, Trash2, Crown, Tent, Navigation,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InlineEdit } from "@/components/dashboard/InlineEdit";
import { formatBirthDate, formatDateShort } from "@/lib/formatDate";
import {
  ADMIN_WHATSAPP, ADMIN_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY, waLink,
} from "@/lib/contact";

const GENDERS = [{ v: "male", l: "ذكر" }, { v: "female", l: "أنثى" }];
const MARITAL = [
  { v: "married", l: "متزوج/ة" }, { v: "single", l: "أعزب/عزباء" },
  { v: "widowed", l: "أرمل/ة" }, { v: "divorced", l: "مطلق/ة" }, { v: "other", l: "أخرى" },
];
const RELATIONS = [
  { v: "wife", l: "زوجة" }, { v: "husband", l: "زوج" }, { v: "son", l: "ابن" },
  { v: "daughter", l: "ابنة" }, { v: "father", l: "والد" }, { v: "mother", l: "والدة" },
  { v: "brother", l: "أخ" }, { v: "sister", l: "أخت" }, { v: "other", l: "أخرى" },
];

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [aids, setAids] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setPageLoading(true);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(prof);
      const { data: a } = await supabase.from("applications").select("*").eq("user_id", user.id).maybeSingle();
      setApp(a);
      if (a) {
        const { data: fm } = await supabase.from("family_members").select("*").eq("application_id", a.id).order("created_at");
        setMembers(fm || []);
        const { data: ad } = await supabase
          .from("aid_distributions").select("*").eq("application_id", a.id)
          .order("delivered_at", { ascending: false });
        setAids(ad || []);
      }
      const { data: notifs } = await supabase
        .from("notifications").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(8);
      setNotifications(notifs || []);
      setPageLoading(false);
    })();
  }, [user]);

  // ---- Direct save helpers (instant persistence) ----
  const saveProfile = (key: string) => async (val: any) => {
    const { error } = await supabase.from("profiles").update({ [key]: val } as any).eq("id", user!.id);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    setProfile((p: any) => ({ ...p, [key]: val }));
    toast.success("تم الحفظ");
    return true;
  };
  const saveApp = (key: string) => async (val: any) => {
    if (!app) return false;
    const { error } = await supabase.from("applications").update({ [key]: val } as any).eq("id", app.id);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    setApp((a: any) => ({ ...a, [key]: val }));
    toast.success("تم الحفظ");
    return true;
  };
  const saveMember = (id: string, key: string) => async (val: any) => {
    const { error } = await supabase.from("family_members").update({ [key]: val } as any).eq("id", id);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, [key]: val } : m)));
    toast.success("تم الحفظ");
    return true;
  };

  // ---- Add / remove family members ----
  const addMember = async () => {
    if (!app) return;
    const { data, error } = await supabase
      .from("family_members")
      .insert({
        application_id: app.id,
        full_name: "",
        birth_date: new Date().toISOString().slice(0, 10),
        gender: "male",
        relationship: "son",
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message || "تعذّر إضافة فرد"); return; }
    setMembers((ms) => [...ms, data]);
    const newSize = (members.filter((m) => !m.is_head).length + 1) + 1; // members + new + head
    await supabase.from("applications").update({ family_size: newSize } as any).eq("id", app.id);
    setApp((a: any) => ({ ...a, family_size: newSize }));
    toast.success("تمت إضافة فرد جديد — يمكنك تعبئة بياناته الآن");
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) { toast.error(error.message || "تعذّر الحذف"); return; }
    const remaining = members.filter((m) => m.id !== id);
    setMembers(remaining);
    if (app) {
      const newSize = Math.max(1, remaining.filter((m) => !m.is_head).length + 1);
      await supabase.from("applications").update({ family_size: newSize } as any).eq("id", app.id);
      setApp((a: any) => ({ ...a, family_size: newSize }));
    }
    toast.success("تم حذف الفرد");
  };

  if (pageLoading) {
    return <Layout><div className="container py-20 text-center text-muted-foreground">جارٍ التحميل…</div></Layout>;
  }

  // ---- Completion calculation ----
  const reqProfile = ["full_name", "national_id", "phone", "birth_date", "gender", "marital_status"];
  const reqApp = ["original_residence", "current_camp", "family_size"];
  const filled =
    reqProfile.filter((k) => profile?.[k] != null && profile[k] !== "").length +
    (app ? reqApp.filter((k) => app?.[k] != null && app[k] !== "").length : 0);
  const totalFields = reqProfile.length + (app ? reqApp.length : 0);
  const completion = totalFields ? Math.round((filled / totalFields) * 100) : 0;

  const statusBadge = () => {
    if (!app) return null;
    const map: Record<string, { cls: string; Icon: any; label: string }> = {
      approved: { cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2, label: t("status.approved") },
      rejected: { cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle, label: t("status.rejected") },
      pending: { cls: "bg-warning/20 text-warning-foreground border-warning/40", Icon: Clock, label: t("status.pending") },
    };
    const v = map[app.status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${v.cls}`}>
        <v.Icon className="h-4 w-4" /> {v.label}
      </span>
    );
  };

  const unread = notifications.filter((n) => !n.read_at && !n.is_read).length;
  const visibleMembers = members.filter((m) => !m.is_head);

  return (
    <Layout>
      <section className="container py-8 max-w-4xl space-y-6">
        {/* Hero greeting — warm sand */}
        <Card className="overflow-hidden border-accent/30 shadow-elegant">
          <div className="bg-gradient-to-bl from-accent-soft via-secondary to-background p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1 inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> {t("dashboard.welcome")}
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-primary truncate">
                  {profile?.full_name || "—"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5" /> {t("app.name")} (Baraka 2)
                </p>
              </div>
              {statusBadge()}
            </div>

            {/* Completion bar */}
            <div className="mt-6 rounded-xl bg-card/70 backdrop-blur-sm border border-accent/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-primary inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> اكتمال بيانات الأسرة
                </span>
                <span className="text-sm font-extrabold text-accent tabular-nums">{completion}%</span>
              </div>
              <Progress value={completion} className="h-2.5" />
              {completion < 100 && (
                <p className="text-xs text-muted-foreground mt-2">
                  أكمل الحقول الناقصة المظللة لرفع نسبة اكتمال بياناتك.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="p-5 shadow-card border-accent/20">
            <h2 className="font-bold text-primary mb-3 inline-flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" /> التنبيهات والإشعارات
              {unread > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
                  {unread} جديد
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    !n.read_at && !n.is_read ? "border-accent/40 bg-accent-soft/30" : "border-border bg-muted/30"
                  }`}
                >
                  <div className="rounded-full bg-accent/15 p-1.5 mt-0.5">
                    <Bell className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-primary">{n.title || "إشعار"}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                    <div className="text-[11px] text-muted-foreground/70 mt-1">{formatDateShort(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Top stats */}
        {app && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={Users} value={app.family_size ?? "—"} label={t("dashboard.family_count")} tone="accent" />
            <StatCard icon={PackageCheck} value={aids.length} label={t("dashboard.aids_received")} tone="success" />
            <StatCard icon={MapPin} value={app.current_camp || "—"} label={t("residence.current_camp")} tone="primary" small />
          </div>
        )}

        {/* No application prompt */}
        {!app && (
          <Card className="p-6 border-warning/40 bg-warning/5 text-center">
            <FileText className="h-10 w-10 text-warning-foreground mx-auto mb-2" />
            <h2 className="text-lg font-bold text-primary mb-1">{t("dashboard.no_app_title")}</h2>
            <p className="text-sm text-muted-foreground mb-3">{t("dashboard.no_app_subtitle")}</p>
            <Link to="/my-application" className="text-accent font-bold underline underline-offset-4">
              {t("my_app.submit_now")}
            </Link>
          </Card>
        )}

        {/* Head of family — editable (he is one of the family members, marked as head) */}
        <SectionCard icon={Crown} title="بيانات رب الأسرة" badge="رب الأسرة"
          hint="اضغط على أي قيمة لتعديلها مباشرة">
          <FieldRow icon={UserCog} label="الاسم الكامل">
            <InlineEdit value={profile?.full_name} onSave={saveProfile("full_name")} />
          </FieldRow>
          <FieldRow icon={IdCard} label="رقم الهوية">
            <InlineEdit value={profile?.national_id} numeric maxLength={9} dir="ltr" onSave={saveProfile("national_id")} />
          </FieldRow>
          <FieldRow icon={Phone} label="رقم الجوال">
            <InlineEdit value={profile?.phone} type="tel" numeric dir="ltr" onSave={saveProfile("phone")} />
          </FieldRow>
          <FieldRow icon={Phone} label="جوال بديل">
            <InlineEdit value={profile?.alt_phone} type="tel" numeric dir="ltr" onSave={saveProfile("alt_phone")} />
          </FieldRow>
          <FieldRow icon={CalendarDays} label="تاريخ الميلاد">
            <InlineEdit value={profile?.birth_date} type="date" dir="ltr"
              display={(v) => formatBirthDate(v)} onSave={saveProfile("birth_date")} />
          </FieldRow>
          <FieldRow icon={Users} label="الجنس">
            <InlineEdit value={profile?.gender} type="select" options={GENDERS} onSave={saveProfile("gender")} />
          </FieldRow>
          <FieldRow icon={Users} label="الحالة الاجتماعية">
            <InlineEdit value={profile?.marital_status} type="select" options={MARITAL} onSave={saveProfile("marital_status")} />
          </FieldRow>
          <FieldRow icon={HeartPulse} label="أمراض مزمنة">
            <InlineEdit value={profile?.chronic_diseases} onSave={saveProfile("chronic_diseases")} />
          </FieldRow>
        </SectionCard>

        {/* Residence — redesigned: original vs current */}
        {app && (
          <SectionCard icon={MapPin} title="بيانات السكن">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Original residence */}
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                  <span className="rounded-lg bg-primary/10 p-1.5"><Home className="h-4 w-4 text-primary" /></span>
                  السكن الأصلي
                </div>
                <div className="divide-y divide-border/50">
                  <FieldRow icon={MapPin} label="مكان السكن">
                    <InlineEdit value={app.original_residence} onSave={saveApp("original_residence")} />
                  </FieldRow>
                  <FieldRow icon={Navigation} label="أقرب معلم">
                    <InlineEdit value={app.original_landmark} onSave={saveApp("original_landmark")} />
                  </FieldRow>
                </div>
              </div>
              {/* Current shelter */}
              <div className="rounded-2xl border border-accent/25 bg-accent-soft/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent-foreground">
                  <span className="rounded-lg bg-accent/15 p-1.5"><Tent className="h-4 w-4 text-accent" /></span>
                  السكن الحالي / الإيواء
                </div>
                <div className="divide-y divide-border/50">
                  <FieldRow icon={Tent} label="المخيم / الإيواء">
                    <InlineEdit value={app.current_camp} onSave={saveApp("current_camp")} />
                  </FieldRow>
                  <FieldRow icon={Navigation} label="أقرب معلم">
                    <InlineEdit value={app.current_landmark} onSave={saveApp("current_landmark")} />
                  </FieldRow>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-bold text-primary">
                <Users className="h-4 w-4 text-accent" /> إجمالي عدد الأفراد
              </span>
              <span className="text-base font-extrabold text-accent tabular-nums">
                {visibleMembers.length + 1}
              </span>
            </div>
          </SectionCard>
        )}

        {/* Family members — editable, head excluded (shown above) */}
        {app && (
          <SectionCard icon={Users} title={`أفراد الأسرة (${visibleMembers.length})`}>
            <p className="mb-3 text-xs text-muted-foreground">
              لا يظهر رب الأسرة هنا لأنه مُسجَّل في الأعلى كرب أسرة — لتجنّب التكرار.
            </p>
            {visibleMembers.length === 0 && (
              <p className="text-sm text-muted-foreground px-1 mb-3">لا يوجد أفراد إضافيون مسجلون بعد.</p>
            )}
            <div className="space-y-3">
              {visibleMembers.map((m, i) => (
                <div key={m.id} className="rounded-xl border border-accent/20 bg-accent-soft/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-accent">فرد رقم {i + 1}</div>
                    <Button variant="ghost" size="sm"
                      className="h-7 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </Button>
                  </div>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <FieldRow icon={UserCog} label="الاسم">
                      <InlineEdit value={m.full_name} onSave={saveMember(m.id, "full_name")} />
                    </FieldRow>
                    <FieldRow icon={IdCard} label="رقم الهوية">
                      <InlineEdit value={m.national_id} numeric maxLength={9} dir="ltr" onSave={saveMember(m.id, "national_id")} />
                    </FieldRow>
                    <FieldRow icon={CalendarDays} label="تاريخ الميلاد">
                      <InlineEdit value={m.birth_date} type="date" dir="ltr"
                        display={(v) => formatBirthDate(v)} onSave={saveMember(m.id, "birth_date")} />
                    </FieldRow>
                    <FieldRow icon={Users} label="الجنس">
                      <InlineEdit value={m.gender} type="select" options={GENDERS} onSave={saveMember(m.id, "gender")} />
                    </FieldRow>
                    <FieldRow icon={Users} label="صلة القرابة">
                      <InlineEdit value={m.relationship} type="select" options={RELATIONS} onSave={saveMember(m.id, "relationship")} />
                    </FieldRow>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addMember} variant="outline"
              className="mt-4 w-full gap-2 border-dashed border-accent/40 text-accent hover:bg-accent-soft hover:text-accent">
              <Plus className="h-4 w-4" /> إضافة فرد جديد
            </Button>
          </SectionCard>
        )}

        {/* Last aids */}
        {app && (
          <SectionCard icon={PackageCheck} title="آخر المساعدات المستلمة">
            {aids.length === 0 && <p className="text-sm text-muted-foreground px-1">{t("aid.empty_user")}</p>}
            <div className="space-y-2">
              {aids.slice(0, 5).map((aid) => (
                <div key={aid.id} className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 p-3">
                  <div className="rounded-full bg-success/15 p-2"><PackageCheck className="h-4 w-4 text-success" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-primary truncate">{aid.title || "مساعدة"}</div>
                    {aid.notes && <div className="text-xs text-muted-foreground truncate">{aid.notes}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{formatDateShort(aid.delivered_at)}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Quick contact */}
        <Card className="p-5 shadow-card border-accent/20">
          <h2 className="font-bold text-primary mb-3 inline-flex items-center gap-2">
            <Phone className="h-4 w-4 text-accent" /> {t("contact.quick_title")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <a href={waLink(ADMIN_WHATSAPP, t("contact.prefill_admin"))} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-3 hover:bg-accent-soft transition-colors">
              <div className="rounded-full bg-accent/20 p-2"><ShieldCheck className="h-4 w-4 text-accent" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-primary">{t("contact.admin_label")}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{ADMIN_WHATSAPP_DISPLAY}</div>
              </div>
              <MessageCircle className="h-4 w-4 text-success" />
            </a>
            <a href={waLink(SUPPORT_WHATSAPP, t("contact.prefill_support"))} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3 hover:bg-success/10 transition-colors">
              <div className="rounded-full bg-success/15 p-2"><HelpCircle className="h-4 w-4 text-success" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-primary">{t("contact.support_label")}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{SUPPORT_WHATSAPP_DISPLAY}</div>
              </div>
              <MessageCircle className="h-4 w-4 text-success" />
            </a>
          </div>
        </Card>
      </section>
    </Layout>
  );
};

const StatCard = ({ icon: Icon, value, label, tone, small }: any) => (
  <Card className="p-4 shadow-card flex items-center gap-3 border-accent/15">
    <div className={`rounded-full p-2.5 ${tone === "accent" ? "bg-accent/15 text-accent" : tone === "success" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className={`font-extrabold text-primary ${small ? "text-base truncate" : "text-2xl tabular-nums"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  </Card>
);

const SectionCard = ({ icon: Icon, title, hint, badge, children }: any) => (
  <Card className="p-4 sm:p-5 shadow-card border-accent/20">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold text-primary inline-flex items-center gap-2 min-w-0">
        <span className="rounded-lg bg-accent/10 p-1.5 shrink-0"><Icon className="h-4 w-4 text-accent" /></span>
        <span className="truncate">{title}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent border border-accent/30">
            {badge}
          </span>
        )}
      </h2>
      {hint && <span className="hidden sm:inline text-[11px] text-muted-foreground">{hint}</span>}
    </div>
    <div className="divide-y divide-border/60">{children}</div>
  </Card>
);

const FieldRow = ({ icon: Icon, label, children }: any) => (
  <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-1.5">
    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground sm:min-w-[7.5rem]">
      {Icon && <Icon className="h-3.5 w-3.5 text-accent/70" />} {label}
    </span>
    <div className="min-w-0 w-full sm:flex-1 sm:max-w-[60%]">{children}</div>
  </div>
);

export default Dashboard;
