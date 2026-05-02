import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Lock, Send, ArrowLeft, ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberCard, emptyMember, type Member } from "@/components/MemberCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ID_RE, isFullName } from "@/lib/validators";
import { useAppSettings } from "@/hooks/useAppSettings";
import { RegistrationClosedNotice } from "@/pages/RegistrationClosed";

const MyApplication = () => {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const ArrowBack = isRtl ? ArrowRight : ArrowLeft;

  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [residence, setResidence] = useState({
    original_residence: "",
    original_landmark: "",
    current_landmark: "",
    family_size: 2,
    has_martyr: false,
    martyr_name: "",
    martyr_relationship: "",
  });

  const [members, setMembers] = useState<Member[]>([emptyMember()]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

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
        const { data: fm } = await supabase.from("family_members").select("*").eq("application_id", app.id);
        if (fm && fm.length) setMembers(fm.map((m) => ({ ...m, chronic_diseases: m.chronic_diseases || "", health_notes: m.health_notes || "", relationship_other: m.relationship_other || "" } as any)));
      }
      setPageLoading(false);
    })();
  }, [user]);

  // Sync member count with family_size (size includes head, so members = size - 1)
  useEffect(() => {
    const expected = Math.max(0, residence.family_size - 1);
    if (members.length < expected) {
      setMembers((prev) => [...prev, ...Array.from({ length: expected - prev.length }, emptyMember)]);
    }
  }, [residence.family_size]);

  const validateMembers = async () => {
    const seen = new Set<string>();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.full_name.trim() || !m.birth_date || !m.relationship) {
        toast.error(`${t("family.person")} #${i + 1}: ${t("form.required")}`);
        return false;
      }
      if (!isFullName(m.full_name)) {
        toast.error(`${t("family.person")} #${i + 1}: ${t("form.invalid_full_name")}`);
        return false;
      }
      if (m.national_id) {
        if (!ID_RE.test(m.national_id)) {
          toast.error(`${t("family.person")} #${i + 1}: ${t("form.invalid_id")}`);
          return false;
        }
        if (seen.has(m.national_id)) {
          toast.error(`${t("family.person")} #${i + 1}: ${t("toast.id_exists_with_data", { id: m.national_id })}`);
          return false;
        }
        seen.add(m.national_id);
      }
      if (m.is_war_injured && !m.injury_report_url) {
        toast.error(`${t("family.person")} #${i + 1}: ${t("health.report_required")}`);
        return false;
      }
    }
    if (residence.has_martyr && (!residence.martyr_name.trim() || !residence.martyr_relationship.trim())) {
      toast.error(t("form.required"));
      return false;
    }
    // Check duplicates against the rest of the camp (exclude this user, and exclude same member id when editing)
    for (const m of members) {
      if (!m.national_id) continue;
      const { data } = await supabase.rpc("national_id_used_by_others", {
        _nid: m.national_id,
        _exclude_user: user!.id,
        _exclude_member: m.id ?? null,
      });
      if (data === true) {
        toast.error(t("toast.id_exists_with_data", { id: m.national_id }));
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!user) return;
    // Block new submissions when registration is closed; existing application owners can still update
    if (!appId && !settings.registration_open) {
      toast.error(t("toast.registration_closed_now"));
      return;
    }
    if (!(await validateMembers())) return;
    if (!confirm(appId ? t("confirm.save_changes") : t("confirm.submit_app"))) return;
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
          health_notes: m.health_notes || null,
        }));
        const { error: fmErr } = await supabase.from("family_members").insert(rows);
        if (fmErr) throw fmErr;
      }
      setAppStatus("pending");
      setRejection(null);
      toast.success(t("toast.submitted"));
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
                <Label>{t("residence.family_size")}</Label>
                <Input type="number" min={1} max={30} value={residence.family_size}
                  onChange={(e) => setResidence({ ...residence, family_size: Math.max(1, parseInt(e.target.value) || 1) })} />
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
                onChange={(nm) => setMembers((prev) => prev.map((p, idx) => (idx === i ? nm : p)))}
                onRemove={() => setMembers((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}

            <Button type="button" variant="outline" onClick={() => setMembers([...members, emptyMember()])} className="w-full gap-2 border-dashed border-accent text-accent hover:bg-accent-soft">
              <Plus className="h-4 w-4" /> {t("family.add")}
            </Button>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowBack className="h-4 w-4" /> {t("form.prev")}
              </Button>
              <Button onClick={submit} disabled={busy} className="gold-gradient text-accent-foreground shadow-gold gap-2">
                <Send className="h-4 w-4" /> {appId ? t("form.save") : t("form.submit")}
              </Button>
            </div>
          </div>
        )}
        </>
        )}
      </section>
    </Layout>
  );
};

export default MyApplication;
