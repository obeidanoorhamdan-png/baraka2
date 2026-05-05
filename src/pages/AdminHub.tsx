import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardList, PackageCheck, Settings, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const HubCard = ({
  to,
  icon: Icon,
  title,
  desc,
  color,
}: {
  to: string;
  icon: any;
  title: string;
  desc: string;
  color: string;
}) => {
  const { t } = useTranslation();
  return (
    <Card className="p-6 shadow-card hover:shadow-elegant transition-all hover:-translate-y-0.5">
      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${color}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="text-xl font-extrabold text-primary mb-1">{title}</div>
      <p className="text-sm text-muted-foreground mb-4 min-h-[2.5rem]">{desc}</p>
      <Button asChild className="w-full brand-gradient text-primary-foreground gap-2">
        <Link to={to}>
          {t("admin.hub_open")} <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </Button>
    </Card>
  );
};

const AdminHub = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/admin-login", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  if (loading || !isAdmin) {
    return (
      <Layout>
        <div className="container py-20 text-center">...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="container py-10 max-w-5xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs text-accent font-bold">
            {t("admin.title")}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">{t("admin.hub_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.hub_subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <HubCard
            to="/admin/applications"
            icon={ClipboardList}
            title={t("admin.hub_apps_title")}
            desc={t("admin.hub_apps_desc")}
            color="bg-primary/10 text-primary"
          />
          <HubCard
            to="/admin/applications?tab=aid"
            icon={PackageCheck}
            title={t("admin.hub_aid_title")}
            desc={t("admin.hub_aid_desc")}
            color="bg-accent/15 text-accent-foreground"
          />
          <HubCard
            to="/admin/applications?tab=settings"
            icon={Settings}
            title={t("admin.hub_settings_title")}
            desc={t("admin.hub_settings_desc")}
            color="bg-success/15 text-success"
          />
        </div>
      </section>
    </Layout>
  );
};

export default AdminHub;
