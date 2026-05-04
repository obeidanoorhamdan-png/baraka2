import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Lock, Send, ArrowLeft, ArrowRight, CheckCircle2, Users, Eye } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MemberCard, emptyMember, type Member } from "@/components/MemberCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ID_RE, isFullName } from "@/lib/validators";
import { useAppSettings } from "@/hooks/useAppSettings";
import { RegistrationClosedNotice } from "@/pages/RegistrationClosed";
import { useConfirm } from "@/components/ConfirmDialog";
import { AidPreview } from "@/pages/MyAid";

const MyApplication = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const ArrowBack = isRtl ? ArrowRight : ArrowLeft;
  const confirmAsk = useConfirm();

  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [memberErrors, setMemberErrors] = useState<Record<number, Record<string, string>>>({});
  const [editMode, setEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<string>("");
  const [familySizeInput, setFamilySizeInput] = useState<string>("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [collapsedMembers, setCollapsedMembers] = useState<Record<number, boolean>>({});

  const currentSig = () => JSON.stringify({ residence, members });
  const isDirty = editMode && !!appId && snapshot && snapshot !== currentSig();

  const guardDiscard = async (): Promise<boolean> => {
    if (!isDirty) return true;
    return await confirmAsk({
      title: t("confirm.discard_changes_title"),
      description: t("confirm.discard_changes"),
      confirmText: t("confirm.discard_confirm"),
      variant: "warning",
    });
  };

  // Warn on tab/window close while dirty
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  const [residence, setResidence] = useState({
    original_residence: "",
    original_landmark: "",
    current_landmark: "",
    family_size: 1,
    has_martyr: false,
    martyr_name: "",
    martyr_relationship: "",
  });

  const [members, setMembers] = useState<Member[]>([]);

  const validateMemberField = (m: Member, key: string): string => {
    switch (key) {
      case "full_name":
        if (!m.full_name?.trim()) return t("field_errors.name_required");
        if (!isFullName(m.full_name)) return t("field_errors.name_format");
        return "";
      case "national_id":
        if (m.national_id && !ID_RE.test(m.national_id)) return t("field_errors.id_format");
        return "";
      case "birth_date":
        if (!m.birth_date) return t("field_errors.birth_required");
        if (new Date(m.birth_date) > new Date()) return t("field_errors.birth_future");
        return "";
      case "relationship_other":
        if (m.relationship === "other" && !m.relationship_other?.trim()) return t("field_errors.rel_other_required");
        return "";
      case "injury_report_url":
        if (m.is_war_injured && !m.injury_report_url) return t("health.report_required");
        return "";
      case "pregnancy_report_url":
        if (m.is_pregnant && !m.pregnancy_report_url) return t("health_extra.pregnancy_required");
        return "";
    }
    return "";
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: app } = await supabase.from("applications").select("*").eq("user_id", user.id).maybeSingle();
      if (app) {
        setAppId(app.id);
        setAppStatus(app.status);
        setRejection(app.rejection_reason);
        setResidence({
          original_residence: app.original_residence,
          original_landmark: app.original_landmark,
          current_landmark: app.current_landmark,
          family_size: app.family_size,
          has_martyr: app.has_martyr,
          martyr_name: app.martyr_name || "",
          martyr_relationship: app.martyr_relationship || "",
          });
          setFamilySizeInput(String(app.family_size));
        const { data: fm } = await supabase.from("family_members").select("*").eq("application_id", app.id);
        if (fm && fm.length) setMembers(fm.map((m) => ({ ...m, chronic_diseases: m.chronic_diseases || "", health_notes: m.health_notes || "", relationship_other: m.relationship_other || "" } as any)));
      }
      setPageLoading(false);
    })();
  }, [user]);

  // Trim members if user reduces family size below current members count.
  // Do NOT auto-add members — user adds them manually with the "Add member" button.
  useEffect(() => {
    const expected = Math.max(0, residence.family_size - 1);
    setMembers((prev) => (prev.length > expected ? prev.slice(0, expected) : prev));
  }, [residence.family_size]);

  const validateMembers = async () => {
    const seen = new Set<string>();
    const allErrors: Record<number, Record<string, string>> = {};
    let firstErrorIdx = -1;
    const fields = ["full_name","national_id","birth_date","relationship_other","injury_report_url","pregnancy_report_url"];
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const errs: Record<string, string> = {};
      for (const f of fields) {
        const msg = validateMemberField(m, f);
        if (msg) errs[f] = msg;
      }
      if (m.national_id && !errs.national_id) {
        if (seen.has(m.national_id)) errs.national_id = t("toast.id_exists_with_data", { id: m.national_id });
        else seen.add(m.national_id);
      }
      if (Object.keys(errs).length) {
        allErrors[i] = errs;
        if (firstErrorIdx < 0) firstErrorIdx = i;
      }
    }
    setMemberErrors(allErrors);
    if (firstErrorIdx >= 0) {
      toast.error(`${t("family.person")} #${firstErrorIdx + 1}: ${t("toast.fix_errors")}`);
      return false;
    }
    if (residence.has_martyr && (!residence.martyr_name.trim() || !residence.martyr_relationship.trim())) {
      toast.error(t("form.required"));
      return false;
    }
    // Check duplicates against the rest of the camp
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.national_id) continue;
      const { data } = await supabase.rpc("national_id_used_by_others", {
        _nid: m.national_id, _exclude_user: user!.id, _exclude_member: m.id ?? null,
      });
      if (data === true) {
        setMemberErrors((p) => ({ ...p, [i]: { ...(p[i] || {}), national_id: t("field_errors.id_duplicate") } }));
        toast.error(t("toast.id_exists_with_data", { id: m.national_id }));
        return false;
      }
    }
    return true;
  };

  // Open the review summary dialog after running validations.
  const openReview = async () => {
    if (!user) return;
    if (!appId && !settings.registration_open) {
      toast.error(t("toast.registration_closed_now"));
      return;
    }
    if (!(await validateMembers())) return;
    setSummaryOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    setSummaryOpen(false);
    if (!(await confirmAsk({
      title: appId ? t("confirm.save_changes_title") : t("confirm.submit_app_title"),
      description: appId ? t("confirm.save_changes") : t("confirm.submit_app"),
      confirmText: appId ? t("form.save") : t("form.submit"),
      variant: "default",
    }))) return;
    setBusy(true);
    try {
      let currentAppId = appId;
      const appPayload = {
        user_id: user.id,
        original_residence: residence.original_residence,
        original_landmark: residence.original_landmark,
        current_camp: "Baraka 2",
        current_landmark: residence.current_landmark,
        family_size: residence.family_size,
        has_martyr: residence.has_martyr,
        martyr_name: residence.has_martyr ? residence.martyr_name : null,
        martyr_relationship: residence.has_martyr ? residence.martyr_relationship : null,
        status: "pending" as const,
        rejection_reason: null,
      };
      if (currentAppId) {
        const { error } = await supabase.from("applications").update(appPayload).eq("id", currentAppId);
        if (error) throw error;
        await supabase.from("family_members").delete().eq("application_id", currentAppId);
      } else {
        const { data, error } = await supabase.from("applications").insert(appPayload).select("id").single();
        if (error) throw error;
        currentAppId = data.id;
        setAppId(data.id);
      }
      if (members.length) {
        const rows = members.map((m) => ({
          application_id: currentAppId!,
          full_name: m.full_name,
          national_id: m.national_id || null,
          birth_date: m.birth_date,
          gender: m.gender,
          relationship: m.relationship,
          relationship_other: m.relationship_other || null,
          is_war_injured: m.is_war_injured,
          injury_report_url: m.injury_report_url || null,
          chronic_diseases: m.chronic_diseases || null,
          is_pregnant: m.is_pregnant,
          is_breastfeeding: m.is_breastfeeding,
          pregnancy_report_url: m.is_pregnant ? (m.pregnancy_report_url || null) : null,
          health_notes: m.health_notes || null,
        }));
        const { error: fmErr } = await supabase.from("family_members").insert(rows);
        if (fmErr) throw fmErr;
      }
      const wasUpdate = !!appId;
      setAppStatus("pending");
      setRejection(null);
      setEditMode(false);
      setSnapshot("");
      setStep(1);
      // Notify the family that data was updated/submitted
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: wasUpdate ? t("notify.app_updated_title") : t("notify.app_submitted_title"),
        body: wasUpdate ? t("notify.app_updated_body") : t("notify.app_submitted_body"),
        link: "/my-application",
        kind: "info",
      });
      toast.success(wasUpdate ? t("toast.updated") : t("toast.submitted"));
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("family_members_national_id_unique") || msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(t("toast.id_exists"));
      } else {
        toast.error(e?.message || t("toast.error"));
      }
    }
    setBusy(false);
  };

  if (pageLoading) return <Layout><div className="container py-20 text-center text-muted-foreground">...</div></Layout>;

  return (
    <Layout>
      <section className="container py-8 max-w-4xl">
        {!appId && !settings.registration_open && !settingsLoading && (
          <RegistrationClosedNotice reason={settings.closed_reason} />
        )}
        {(appId || settings.registration_open || settingsLoading) && (
        <>
        <h1 className="text-2xl md:text-3xl text-primary mb-2">{t("my_app.title")}</h1>

        {appId && !settings.registration_open && !settingsLoading && (
          <Card className="p-4 mb-4 border-warning/40 bg-warning/10">
            <div className="font-bold text-warning-foreground">{t("my_app.update_only_title")}</div>
            <p className="text-sm text-warning-foreground/90">{t("my_app.update_only_subtitle")}</p>
            {settings.closed_reason && (
              <p className="text-xs mt-1"><strong>{t("closed.reason_label")}:</strong> {settings.closed_reason}</p>
            )}
          </Card>
        )}

        {appStatus && (
          <Card className="p-4 mb-6 shadow-card flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">{t("admin.applications")}:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              appStatus === "approved" ? "bg-success/15 text-success" :
              appStatus === "rejected" ? "bg-destructive/15 text-destructive" :
              "bg-warning/20 text-warning-foreground"
            }`}>{t(`status.${appStatus}`)}</span>
            {rejection && (
              <div className="w-full text-sm text-destructive mt-2"><strong>{t("my_app.rejection_reason")}:</strong> {rejection}</div>
            )}
          </Card>
        )}

        {appId && !editMode ? (
          <ApplicationSummary
            residence={residence}
            members={members}
            onEditResidence={() => { setSnapshot(currentSig()); setEditMode(true); setStep(1); }}
            onEditMembers={() => { setSnapshot(currentSig()); setEditMode(true); setStep(2); }}
          />
        ) : (
        <>
        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 gap-2">
          {[1, 2].map((n) => (
            <button key={n} onClick={() => setStep(n)} className={`flex-1 h-2 rounded-full transition-colors ${step >= n ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <Card className="p-5 md:p-6 shadow-elegant space-y-4">
            <h2 className="text-xl font-bold text-primary">{t("form.step2")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{t("residence.original_residence")}</Label>
                <Input value={residence.original_residence}
                  onChange={(e) => setResidence({ ...residence, original_residence: e.target.value })} />
              </div>
              <div>
                <Label>{t("residence.original_landmark")}</Label>
                <Input value={residence.original_landmark}
                  onChange={(e) => setResidence({ ...residence, original_landmark: e.target.value })} />
              </div>
              <div>
                <Label>{t("residence.current_camp")}</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/50 text-sm font-semibold text-primary">
                  <Lock className="h-3.5 w-3.5 text-accent" /> {t("app.name")} (Baraka 2)
                </div>
              </div>
              <div>
                <Label>{t("residence.current_landmark")}</Label>
                <Input value={residence.current_landmark}
                  onChange={(e) => setResidence({ ...residence, current_landmark: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>{t("residence.family_size")} <span className="text-muted-foreground text-xs">(شامل رب الأسرة)</span></Label>
                <Select
                  value={familySizeInput}
                  onValueChange={(v) => {
                    setFamilySizeInput(v);
                    const n = parseInt(v, 10);
                    setResidence((r) => ({ ...r, family_size: n }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عدد الأفراد" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {familySizeInput && (
                  <p className="text-xs text-muted-foreground mt-1">
                    رب الأسرة محسوب — سيتم طلب بيانات {Math.max(0, residence.family_size - 1)} فرد إضافي
                  </p>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <Label>{t("family.martyr_title")}</Label>
              <RadioGroup className="flex gap-4 mt-1" value={residence.has_martyr ? "yes" : "no"}
                onValueChange={(v) => setResidence({ ...residence, has_martyr: v === "yes" })}>
                <label className="flex items-center gap-2"><RadioGroupItem value="yes" />{t("health.yes")}</label>
                <label className="flex items-center gap-2"><RadioGroupItem value="no" />{t("health.no")}</label>
              </RadioGroup>
              {residence.has_martyr && (
                <div className="grid gap-3 md:grid-cols-2 mt-3">
                  <div>
                    <Label>{t("family.martyr_name")}</Label>
                    <Input value={residence.martyr_name}
                      onChange={(e) => setResidence({ ...residence, martyr_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("family.martyr_relationship")}</Label>
                    <Input value={residence.martyr_relationship}
                      onChange={(e) => setResidence({ ...residence, martyr_relationship: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => {
                if (!residence.original_residence || !residence.original_landmark || !residence.current_landmark) {
                  toast.error(t("form.required")); return;
                }
                setStep(2);
              }} className="brand-gradient text-primary-foreground gap-2">
                {t("form.next")} <Arrow className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-5 shadow-elegant">
              <h2 className="text-xl font-bold text-primary mb-1">{t("form.step3")}</h2>
              <p className="text-sm text-muted-foreground">{t("family.title")}</p>
            </Card>

            {members.map((m, i) => (
              <MemberCard
                key={i}
                index={i}
                member={m}
                userId={user!.id}
                errors={memberErrors[i] || {}}
                onFieldBlur={(field) => {
                  const msg = validateMemberField(m, field);
                  setMemberErrors((p) => ({ ...p, [i]: { ...(p[i] || {}), [field]: msg } }));
                }}
                onChange={(nm) => {
                  setMembers((prev) => prev.map((p, idx) => (idx === i ? nm : p)));
                  // re-validate fields that may now be fixed
                  if (memberErrors[i]) {
                    const next: Record<string, string> = {};
                    Object.keys(memberErrors[i]).forEach((k) => {
                      next[k] = validateMemberField(nm, k);
                    });
                    setMemberErrors((p) => ({ ...p, [i]: next }));
                  }
                }}
                onRemove={appStatus === "approved" ? undefined : () => {
                  setMembers((prev) => prev.filter((_, idx) => idx !== i));
                  setMemberErrors((p) => { const c = { ...p }; delete c[i]; return c; });
                }}
              />
            ))}

            {appStatus !== "approved" && (() => {
              const maxMembers = Math.max(0, residence.family_size - 1);
              const remaining = maxMembers - members.length;
              const reachedMax = remaining <= 0;
              return (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={reachedMax || !familySizeInput}
                    onClick={() => {
                      if (members.length >= maxMembers) {
                        toast.error(`لا يمكن إضافة أكثر من ${maxMembers} فرد. عدّل عدد أفراد الأسرة من الخطوة السابقة.`);
                        return;
                      }
                      setMembers([...members, emptyMember()]);
                    }}
                    className="w-full gap-2 border-dashed border-accent text-accent hover:bg-accent-soft disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> {t("family.add")}
                    {familySizeInput && !reachedMax && (
                      <span className="text-xs text-muted-foreground">
                        ({members.length} / {maxMembers})
                      </span>
                    )}
                  </Button>
                  {!familySizeInput && (
                    <p className="text-xs text-center text-muted-foreground">حدّد عدد أفراد الأسرة في الخطوة السابقة أولاً</p>
                  )}
                  {reachedMax && familySizeInput && (
                    <p className="text-xs text-center text-success">✓ اكتمل العدد المطلوب ({maxMembers} فرد)</p>
                  )}
                </div>
              );
            })()}
            {appStatus === "approved" && (
              <Card className="p-3 text-sm text-center text-success bg-success/5 border-success/30">
                {t("my_app.approved_locked_add")}
              </Card>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={async () => {
                if (appId) {
                  if (!(await guardDiscard())) return;
                  // restore snapshot
                  if (snapshot) {
                    try { const s = JSON.parse(snapshot); setResidence(s.residence); setMembers(s.members); } catch {}
                  }
                  setEditMode(false);
                  setSnapshot("");
                } else {
                  setStep(1);
                }
              }} className="gap-2">
                <ArrowBack className="h-4 w-4" /> {appId ? t("form.cancel") : t("form.prev")}
              </Button>
              <Button onClick={submit} disabled={busy} className="gold-gradient text-accent-foreground shadow-gold gap-2">
                <Send className="h-4 w-4" /> {appId ? t("form.save") : t("form.submit")}
              </Button>
            </div>
          </div>
        )}
        </>
        )}
        </>
        )}

        {appId && <AidPreview applicationId={appId} />}
      </section>
    </Layout>
  );
};

// ----------------- Application Summary (read-only view) -----------------
const ApplicationSummary = ({
  residence,
  members,
  onEditResidence,
  onEditMembers,
}: {
  residence: any;
  members: Member[];
  onEditResidence: () => void;
  onEditMembers: () => void;
}) => {
  const { t } = useTranslation();
  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
  const relLabel = (r: string) => {
    const key = `family.rel_${r}`;
    const v = t(key);
    return v === key ? r : v;
  };
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-5 shadow-elegant">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xl font-bold text-primary">{t("form.step2")}</h2>
          <Button onClick={onEditResidence} className="gold-gradient text-accent-foreground shadow-gold gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("residence.original_residence")} value={residence.original_residence} />
          <Field label={t("residence.original_landmark")} value={residence.original_landmark} />
          <Field label={t("residence.current_camp")} value={`${t("app.name")} (Baraka 2)`} />
          <Field label={t("residence.current_landmark")} value={residence.current_landmark} />
          <Field label={t("residence.family_size")} value={residence.family_size} />
          {residence.has_martyr && (
            <>
              <Field label={t("family.martyr_name")} value={residence.martyr_name} />
              <Field label={t("family.martyr_relationship")} value={residence.martyr_relationship} />
            </>
          )}
        </div>
      </Card>

      <Card className="p-5 shadow-elegant">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-primary">{t("admin.members")} ({members.length})</h2>
          <Button onClick={onEditMembers} className="gold-gradient text-accent-foreground shadow-gold gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
        <div className="space-y-3">
          {members.map((m, i) => (
            <Card key={i} className="p-4 bg-muted/30 border-accent/20">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="font-bold text-primary">#{i + 1} — {m.full_name}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {m.is_war_injured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{t("health.injured")}</span>}
                  {m.is_pregnant && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-bold">{t("health_extra.pregnant")}</span>}
                  {m.is_breastfeeding && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-bold">{t("health_extra.breastfeeding")}</span>}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <Field label={t("form.national_id")} value={m.national_id} />
                <Field label={t("form.birth_date")} value={m.birth_date} />
                <Field label={t("form.gender")} value={t(`form.${m.gender}`)} />
                <Field label={t("family.relationship")} value={m.relationship === "other" ? m.relationship_other : relLabel(m.relationship)} />
                {m.chronic_diseases && <Field label={t("health.chronic")} value={m.chronic_diseases} />}
                {m.health_notes && <Field label={t("health.notes")} value={m.health_notes} />}
              </div>
              {(m.injury_report_url || m.pregnancy_report_url) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {m.injury_report_url && (
                    <a href={m.injury_report_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
                      {t("health.report")} (إصابة)
                    </a>
                  )}
                  {m.pregnancy_report_url && (
                    <a href={m.pregnancy_report_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1 rounded-md bg-accent/10 text-accent-foreground hover:bg-accent/20">
                      {t("health_extra.pregnancy_report")}
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={onEditMembers} variant="outline" className="gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
      </Card>
    </div>
  );
};


export default MyApplication;
