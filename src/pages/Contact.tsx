import { useTranslation } from "react-i18next";
import { ShieldCheck, HelpCircle, MessageCircle, Phone, MapPin, Compass, ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ADMIN_WHATSAPP, ADMIN_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY, waLink,
} from "@/lib/contact";

const Contact = () => {
  const { t, i18n } = useTranslation();
  const Back = i18n.language === "ar" ? ArrowRight : ArrowLeft;

  return (
    <Layout>
      <section className="container py-10 max-w-3xl">
        <Button asChild variant="ghost" className="mb-4 gap-2">
          <Link to="/"><Back className="h-4 w-4" /> {t("auth.back")}</Link>
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-xs text-accent mb-3">
            <MessageCircle className="h-3.5 w-3.5" /> {t("contact.page_kicker")}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">{t("contact.page_title")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">{t("contact.page_subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ContactCard
            kind="admin"
            icon={ShieldCheck}
            title={t("contact.admin_title")}
            description={t("contact.admin_desc")}
            number={ADMIN_WHATSAPP_DISPLAY}
            href={waLink(ADMIN_WHATSAPP, t("contact.prefill_admin"))}
            tel={`tel:+${ADMIN_WHATSAPP}`}
          />
          <ContactCard
            kind="support"
            icon={HelpCircle}
            title={t("contact.support_title")}
            description={t("contact.support_desc")}
            number={SUPPORT_WHATSAPP_DISPLAY}
            href={waLink(SUPPORT_WHATSAPP, t("contact.prefill_support"))}
            tel={`tel:+${SUPPORT_WHATSAPP}`}
          />
        </div>

        <Card className="p-6 mt-6 shadow-card">
          <h2 className="font-bold text-primary mb-3 inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" /> {t("camp.address_label")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">{t("camp.address_label")}</div>
              <div className="font-semibold text-primary">{t("camp.address")}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">{t("camp.coords_label")}</div>
              <div className="font-semibold text-primary" dir="ltr">{t("camp.coords")}</div>
            </div>
          </div>
          <a
            href="https://maps.app.goo.gl/r6DWkE55nsBY8UrW8"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-sm text-accent font-semibold hover:underline"
          >
            <Compass className="h-4 w-4" /> {t("camp.open_in_maps")}
          </a>
        </Card>
      </section>
    </Layout>
  );
};

const ContactCard = ({ kind, icon: Icon, title, description, number, href, tel }: any) => {
  const isAdmin = kind === "admin";
  return (
    <Card className={`p-5 shadow-elegant border ${isAdmin ? "border-accent/30 bg-gradient-to-br from-accent-soft/40 to-background" : "border-success/30 bg-gradient-to-br from-success/5 to-background"}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`rounded-full p-3 ${isAdmin ? "bg-accent/20 text-accent" : "bg-success/15 text-success"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-primary">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <div className="rounded-md bg-background/60 border border-border p-2.5 mb-3">
        <div className="text-xs text-muted-foreground">WhatsApp / Phone</div>
        <div className="font-bold text-primary" dir="ltr">{number}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className={isAdmin ? "gold-gradient text-accent-foreground shadow-gold gap-2" : "bg-success text-white hover:bg-success/90 gap-2"}>
          <a href={href} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={tel}><Phone className="h-4 w-4" /> Call</a>
        </Button>
      </div>
    </Card>
  );
};

export default Contact;
