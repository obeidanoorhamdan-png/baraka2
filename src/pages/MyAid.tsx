import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, PackageCheck, CalendarDays } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const AidPreview = ({ applicationId }: { applicationId: string }) => {
  const { t, i18n } = useTranslation();
  const [latest, setLatest] = useState<any | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, count: cnt } = await supabase.from("aid_distributions")
        .select("*", { count: "exact" })
        .eq("application_id", applicationId)
        .order("delivered_at", { ascending: false })
        .limit(1);
      if (!active) return;
      setLatest((data && data[0]) || null);
      setCount(cnt || 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [applicationId]);

  if (loading) return null;

  return (
    <Card className="p-4 mt-6 shadow-card border-accent/30 bg-gradient-to-br from-accent-soft/30 to-background">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-primary inline-flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-accent" />
          {t("aid.received_title")}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground font-semibold">
          {count} {t("aid.items")}
        </span>
      </div>

      {!latest ? (
        <p className="text-sm text-muted-foreground py-2">{t("aid.empty_user")}</p>
      ) : (
        <>
          <div className="rounded-md border border-accent/20 p-3 bg-background">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {t("aid.last_received")}
            </div>
            <div className="font-bold text-primary mt-1">{latest.title}</div>
            <div className="text-xs text-muted-foreground" dir="ltr">{latest.delivered_at}</div>
            {latest.contents && <div className="text-sm mt-1 whitespace-pre-wrap line-clamp-3">{latest.contents}</div>}
          </div>
          {count > 1 && (
            <div className="mt-3 text-end">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/my-aid">
                  {t("aid.show_all")}
                  {i18n.language === "ar" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const MyAid = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const isRtl = i18n.language === "ar";
  const Back = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: app } = await supabase.from("applications").select("id").eq("user_id", user.id).maybeSingle();
      if (!app) { setPageLoading(false); return; }
      const { data } = await supabase.from("aid_distributions")
        .select("*").eq("application_id", app.id).order("delivered_at", { ascending: false });
      setItems((data as any) || []);
      setPageLoading(false);
    })();
  }, [user]);

  return (
    <Layout>
      <section className="container py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/my-application")} className="mb-4 gap-2">
          <Back className="h-4 w-4" /> {t("aid.back_to_app")}
        </Button>
        <h1 className="text-2xl md:text-3xl text-primary mb-1 inline-flex items-center gap-2">
          <PackageCheck className="h-7 w-7 text-accent" /> {t("aid.full_list_title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">{t("aid.full_list_subtitle")}</p>

        {pageLoading ? (
          <div className="text-center text-muted-foreground py-10">...</div>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground border-dashed">{t("aid.empty_user")}</Card>
        ) : (
          <ol className="relative border-s-2 border-accent/30 ms-3 space-y-4">
            {items.map((a, i) => (
              <li key={a.id} className="ms-4">
                <span className="absolute -start-2.5 mt-1.5 h-4 w-4 rounded-full bg-accent ring-4 ring-background" />
                <Card className="p-4 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="font-bold text-primary">{a.title}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground" dir="ltr">{a.delivered_at}</div>
                  </div>
                  {a.contents && <div className="text-sm whitespace-pre-wrap">{a.contents}</div>}
                  {a.notes && <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">{t("aid.notes")}: {a.notes}</div>}
                  {i === 0 && (
                    <div className="mt-2 text-xs font-semibold text-success">★ {t("aid.most_recent")}</div>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Layout>
  );
};

export default MyAid;
