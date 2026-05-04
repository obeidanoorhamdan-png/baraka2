import { useState } from "react";
import { MessageCircle, ShieldCheck, HelpCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ADMIN_WHATSAPP,
  ADMIN_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP,
  SUPPORT_WHATSAPP_DISPLAY,
  waLink,
} from "@/lib/contact";

export const WhatsAppFab = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 end-5 z-50 print:hidden">
      {open && (
        <div
          className="absolute bottom-16 end-0 w-72 rounded-2xl border border-border bg-card shadow-elegant p-3 space-y-2 animate-fade-in"
          role="dialog"
          aria-label={t("contact.whatsapp_title")}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-primary">{t("contact.whatsapp_title")}</div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-muted text-muted-foreground"
              aria-label={t("common.cancel")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <a
            href={waLink(ADMIN_WHATSAPP, t("contact.prefill_admin"))}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 hover:bg-accent-soft transition-colors"
          >
            <div className="rounded-full bg-accent/20 p-2 shrink-0">
              <ShieldCheck className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary">{t("contact.admin_label")}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{ADMIN_WHATSAPP_DISPLAY}</div>
            </div>
          </a>
          <a
            href={waLink(SUPPORT_WHATSAPP, t("contact.prefill_support"))}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3 hover:bg-success/10 transition-colors"
          >
            <div className="rounded-full bg-success/15 p-2 shrink-0">
              <HelpCircle className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary">{t("contact.support_label")}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{SUPPORT_WHATSAPP_DISPLAY}</div>
            </div>
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="group relative h-14 w-14 rounded-full bg-success text-white shadow-elegant hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        aria-label={t("contact.open_whatsapp")}
        title={t("contact.open_whatsapp")}
      >
        <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-20" />
        <MessageCircle className="h-7 w-7 relative" />
      </button>
    </div>
  );
};
