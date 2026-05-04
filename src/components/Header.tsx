import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import logo from "@/assets/baraka-logo.jpg";
import { NotificationsBell } from "@/components/NotificationsBell";

export const Header = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const confirmAsk = useConfirm();

  const handleLogout = async () => {
    const ok = await confirmAsk({
      title: t("auth.logout_confirm_title"),
      description: t("auth.logout_confirm_desc"),
      confirmText: t("auth.logout"),
      cancelText: t("form.cancel"),
      variant: "danger",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Baraka 2 Camp logo" className="h-9 w-9 rounded-full object-cover ring-2 ring-accent/40 shrink-0" />
          <div className="leading-tight min-w-0 hidden xs:block sm:block">
            <div className="text-sm font-bold text-primary truncate">{t("app.name")}</div>
            <div className="text-[10px] font-semibold tracking-widest text-accent truncate">BARAKA 2 CAMP</div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          {user ? (
            <>
              <NotificationsBell />
              {isAdmin ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-9">
                  <Link to="/admin"><ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">{t("admin.title")}</span></Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-9">
                  <Link to="/dashboard"><HomeIcon className="h-4 w-4" /><span className="hidden sm:inline">{t("dashboard.nav")}</span></Link>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 h-9 font-bold"
                aria-label={t("auth.logout")}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t("auth.logout")}</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
};
