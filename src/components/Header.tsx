import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Languages, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/baraka-logo.jpg";
import { NotificationsBell } from "@/components/NotificationsBell";

export const Header = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Baraka 2 Camp logo" className="h-10 w-10 rounded-full object-cover ring-2 ring-accent/40" />
          <div className="leading-tight">
            <div className="text-sm font-bold text-primary">{t("app.name")}</div>
            <div className="text-[10px] font-semibold tracking-widest text-accent">BARAKA 2 CAMP</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{t("app.switch_lang")}</span>
          </Button>
          {user ? (
            <>
              {!isAdmin && <NotificationsBell />}
              {isAdmin ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/admin"><ShieldCheck className="h-4 w-4" />{t("admin.title")}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/my-application"><UserIcon className="h-4 w-4" />{t("my_app.title")}</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
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
