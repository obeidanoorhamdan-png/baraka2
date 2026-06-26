import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, MapPin, Phone, Compass, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NewsStrip } from "@/components/NewsStrip";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import logo from "@/assets/baraka-logo.jpg";
import bannerAsset from "@/assets/baraka-banner.jpg.asset.json";

const Landing = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Layout>
      <AnnouncementPopup />
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerAsset.url})` }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to left, hsl(220 50% 18% / 0.93) 0%, hsl(220 50% 18% / 0.86) 42%, hsl(220 50% 18% / 0.5) 100%)" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent)/0.18),transparent_50%)]" />

        <div className="container relative py-16 md:py-24 grid gap-10 md:grid-cols-2 items-center">
          <div className="text-primary-foreground space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-xs text-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("app.admin_label")} — {t("app.admin_name")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
              {t("app.name")}
              <span className="block mt-2 text-2xl md:text-3xl font-bold tracking-widest text-accent">BARAKA 2 CAMP</span>
            </h1>
            <p className="text-lg opacity-90 max-w-xl">{t("landing.tagline")}</p>
            <p className="text-sm opacity-75 max-w-xl">{t("landing.intro")}</p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Button asChild size="lg" className="gold-gradient text-accent-foreground hover:opacity-90 shadow-gold">
                <Link to="/auth" className="gap-2">
                  ابدأ الآن — سجِّل أو ادخل ببيانات عائلتك <Arrow className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-accent/30 blur-2xl" />
              <img src={logo} alt={t("app.name")} className="relative h-64 w-64 md:h-80 md:w-80 rounded-full object-cover ring-4 ring-accent/60 shadow-elegant" />
            </div>
          </div>
        </div>
      </section>

      <NewsStrip />



      <section className="container py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl text-primary mb-6 text-center">{t("landing.details_title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 shadow-card hover:shadow-elegant transition-shadow">
            <MapPin className="h-8 w-8 text-accent mb-3" />
            <div className="text-sm text-muted-foreground">{t("camp.address_label")}</div>
            <div className="text-lg font-bold text-primary mt-1">{t("camp.address")}</div>
          </Card>
          <Card className="p-6 shadow-card hover:shadow-elegant transition-shadow">
            <Phone className="h-8 w-8 text-accent mb-3" />
            <div className="text-sm text-muted-foreground">{t("camp.phone_label")}</div>
            <div className="text-lg font-bold text-primary mt-1" dir="ltr">{t("camp.phone")}</div>
          </Card>
          <Card className="p-6 shadow-card hover:shadow-elegant transition-shadow">
            <Compass className="h-8 w-8 text-accent mb-3" />
            <div className="text-sm text-muted-foreground">{t("camp.coords_label")}</div>
            <div className="text-base font-semibold text-primary mt-1" dir="ltr">{t("camp.coords")}</div>
            <a
              href="https://maps.app.goo.gl/r6DWkE55nsBY8UrW8"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm text-accent font-semibold hover:underline"
            >
              <MapPin className="h-4 w-4" /> {t("camp.open_in_maps")}
            </a>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
