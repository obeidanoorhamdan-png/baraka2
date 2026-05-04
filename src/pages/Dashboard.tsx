import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home, FileText, PackageCheck, MessageCircle, Download, ShieldCheck,
  Users, MapPin, CheckCircle2, Clock, XCircle, ArrowLeft, ArrowRight, HelpCircle, Phone,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateApplicationPdf } from "@/lib/applicationPdf";
import { toast } from "sonner";
import {
  ADMIN_WHATSAPP, ADMIN_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY, waLink,
} from "@/lib/contact";

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [aidCount, setAidCount] = useState(0);
  const [latestAid, setLatestAid] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

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
        const { data: fm } = await supabase.from("family_members").select("*").eq("application_id", a.id);
        setMembers(fm || []);
        const { data: aids, count } = await supabase
          .from("aid_distributions")
          .select("*", { count: "exact" })
          .eq("application_id", a.id)
          .order("delivered_at", { ascending: false })
          .limit(1);
        setAidCount(count || 0);
        setLatestAid((aids && aids[0]) || null);
      }
      setPageLoading(false);
    })();
  }, [user]);

  const handleDownloadPdf = () => {
    if (!profile || !app) {
      toast.error(t("dashboard.no_app_yet"));
      return;
    }
    try {
      generateApplicationPdf({
        head: profile,
        residence: app,
        members,
        meta: { status: app.status, submitted_at: app.submitted_at, application_id: app.id },
      });
      toast.success(t("dashboard.pdf_done"));
    } catch (e: any) {
      toast.error(e?.message || t("toast.error"));
    }
  };

  if (pageLoading) {
    return <Layout><div className="container py-20 text-center text-muted-foreground">...</div></Layout>;
  }

  const statusBadge = () => {
    if (!app) return null;
    const map: Record<string, { cls: string; Icon: any; label: string }> = {
      approved: { cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2, label: t("status.approved") },
      rejected: { cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle, label: t("status.rejected") },
      pending: { cls: "bg-warning/20 text-warning-foreground border-warning/30", Icon: Clock, label: t("status.pending") },
    };
    const v = map[app.status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${v.cls}`}>
        <v.Icon className="h-4 w-4" /> {v.label}
      </span>
    );
  };

  return (
    <Layout>
      <section className="container py-8 max-w-5xl">
        {/* Hero greeting */}
        <Card className="p-6 md:p-8 mb-6 shadow-elegant border-accent/20 bg-gradient-to-br from-accent-soft/40 via-background to-background">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1">{t("dashboard.welcome")}</div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-primary">
                {profile?.full_name || "—"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" /> {t("app.name")} (Baraka 2)
              </p>
            </div>
            {statusBadge()}
          </div>
        </Card>

        {!app && (
          <Card className="p-6 mb-6 border-warning/40 bg-warning/5 text-center">
            <FileText className="h-10 w-10 text-warning-foreground mx-auto mb-2" />
            <h2 className="text-lg font-bold text-primary mb-1">{t("dashboard.no_app_title")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("dashboard.no_app_subtitle")}</p>
            <Button asChild className="brand-gradient text-primary-foreground gap-2">
              <Link to="/my-application">
                <FileText className="h-4 w-4" /> {t("my_app.submit_now")}
              </Link>
            </Button>
          </Card>
        )}

        {/* Top stats */}
        {app && (
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <StatCard icon={Users} value={app.family_size} label={t("dashboard.family_count")} accent="accent" />
            <StatCard icon={PackageCheck} value={aidCount} label={t("dashboard.aids_received")} accent="success" />
            <StatCard
              icon={MapPin}
              value={app.original_residence || "—"}
              label={t("residence.original_residence")}
              accent="primary"
              small
            />
          </div>
        )}

        {/* Action grid */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <ActionCard
            icon={FileText}
            title={t("dashboard.action_app_title")}
            subtitle={app ? t("dashboard.action_app_view_subtitle") : t("dashboard.action_app_new_subtitle")}
            to="/my-application"
            cta={app ? t("my_app.edit") : t("my_app.submit_now")}
            Arrow={Arrow}
            tone="primary"
          />
          <ActionCard
            icon={PackageCheck}
            title={t("dashboard.action_aid_title")}
            subtitle={
              latestAid
                ? `${t("aid.last_received")}: ${latestAid.title}`
                : t("aid.empty_user")
            }
            to="/my-aid"
            cta={t("aid.show_all")}
            Arrow={Arrow}
            tone="accent"
            disabled={!app}
          />
          <ActionCard
            icon={Download}
            title={t("dashboard.action_pdf_title")}
            subtitle={t("dashboard.action_pdf_subtitle")}
            onClick={handleDownloadPdf}
            cta={t("dashboard.action_pdf_cta")}
            Arrow={Download}
            tone="gold"
            disabled={!app}
          />
          <ActionCard
            icon={MessageCircle}
            title={t("dashboard.action_contact_title")}
            subtitle={t("dashboard.action_contact_subtitle")}
            to="/contact"
            cta={t("dashboard.action_contact_cta")}
            Arrow={Arrow}
            tone="success"
          />
        </div>

        {/* Quick contact strip */}
        <Card className="p-5 shadow-card border-accent/20">
          <h2 className="font-bold text-primary mb-3 inline-flex items-center gap-2">
            <Phone className="h-4 w-4 text-accent" /> {t("contact.quick_title")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href={waLink(ADMIN_WHATSAPP, t("contact.prefill_admin"))}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-3 hover:bg-accent-soft transition-colors"
            >
              <div className="rounded-full bg-accent/20 p-2"><ShieldCheck className="h-4 w-4 text-accent" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-primary">{t("contact.admin_label")}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{ADMIN_WHATSAPP_DISPLAY}</div>
              </div>
              <MessageCircle className="h-4 w-4 text-success" />
            </a>
            <a
              href={waLink(SUPPORT_WHATSAPP, t("contact.prefill_support"))}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3 hover:bg-success/10 transition-colors"
            >
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

const StatCard = ({ icon: Icon, value, label, accent, small }: any) => (
  <Card className="p-4 shadow-card flex items-center gap-3">
    <div className={`rounded-full p-2.5 ${accent === "accent" ? "bg-accent/15 text-accent" : accent === "success" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className={`font-extrabold text-primary ${small ? "text-base truncate" : "text-2xl"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  </Card>
);

const ActionCard = ({ icon: Icon, title, subtitle, to, onClick, cta, Arrow, tone, disabled }: any) => {
  const toneCls =
    tone === "primary" ? "brand-gradient text-primary-foreground" :
    tone === "gold" ? "gold-gradient text-accent-foreground shadow-gold" :
    tone === "success" ? "bg-success text-white hover:bg-success/90" :
    "bg-accent text-accent-foreground hover:bg-accent/90";
  const inner = (
    <Card className={`p-5 shadow-card hover:shadow-elegant transition-all border-accent/20 h-full flex flex-col ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="rounded-xl bg-accent/10 text-accent p-2.5">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-primary">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</div>
        </div>
      </div>
      <div className="mt-auto pt-2">
        <Button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`w-full gap-2 ${toneCls}`}
        >
          {cta} <Arrow className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
  if (to && !onClick) {
    return disabled ? <div>{inner}</div> : <Link to={to}>{inner}</Link>;
  }
  return <div>{inner}</div>;
};

export default Dashboard;
