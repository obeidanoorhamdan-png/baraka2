import { useTranslation } from "react-i18next";
import { MapPin, Phone, Compass } from "lucide-react";

export const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 border-t border-border/60 bg-primary text-primary-foreground">
      <div className="container py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="text-lg font-bold">{t("app.name")}</div>
          <div className="text-xs tracking-widest text-accent">BARAKA 2 CAMP</div>
          <p className="mt-3 text-sm opacity-80">{t("app.admin_label")}: {t("app.admin_name")}</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" /> {t("camp.address_label")}: {t("camp.address")}</div>
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> {t("camp.phone_label")}: {t("camp.phone")}</div>
          <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-accent" /> {t("camp.coords_label")}: {t("camp.coords")}</div>
        </div>
        <div className="text-xs opacity-70 md:text-end">{t("app.rights")}</div>
      </div>
    </footer>
  );
};
