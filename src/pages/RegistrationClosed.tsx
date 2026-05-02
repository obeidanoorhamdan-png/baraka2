import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Lock, Phone, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const RegistrationClosedNotice = ({ reason }: { reason?: string | null }) => {
  const { t } = useTranslation();
  return (
    <div className="container py-12 max-w-2xl">
      <Card className="p-8 text-center shadow-elegant border-destructive/30">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-5">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">{t("closed.title")}</h1>
        <p className="text-muted-foreground mb-6">{t("closed.subtitle")}</p>
        {reason && (
          <Card className="p-4 bg-destructive/5 border-destructive/20 text-start mb-6">
            <div className="text-xs font-semibold text-destructive uppercase mb-1">{t("closed.reason_label")}</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{reason}</p>
          </Card>
        )}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
          <Phone className="h-4 w-4 text-accent" />
          <span>{t("closed.contact")}: </span>
          <span dir="ltr" className="font-bold text-primary">{t("camp.phone")}</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/" className="gap-2"><ArrowLeft className="h-4 w-4" />{t("auth.back")}</Link>
        </Button>
      </Card>
    </div>
  );
};

const RegistrationClosed = () => (
  <Layout><RegistrationClosedNotice /></Layout>
);

export default RegistrationClosed;
