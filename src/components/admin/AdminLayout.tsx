import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Home as HomeIcon } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { NotificationsBell } from "@/components/NotificationsBell";

export const AdminLayout = ({ children, title }: { children: ReactNode; title?: string }) => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const confirmAsk = useConfirm();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/admin-login", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const onLogout = async () => {
    const ok = await confirmAsk({
      title: "تسجيل الخروج",
      description: "هل أنت متأكد؟",
      confirmText: "خروج",
      variant: "danger",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">...</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-2 border-b border-border bg-background/90 backdrop-blur px-3">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              {title && <h1 className="text-sm md:text-base font-bold text-primary truncate">{title}</h1>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationsBell />
              <Button asChild variant="outline" size="sm" className="gap-1.5 h-9">
                <a href="/" target="_blank" rel="noopener noreferrer">
                  <HomeIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">الموقع</span>
                </a>
              </Button>
              <Button variant="destructive" size="sm" onClick={onLogout} className="gap-1.5 h-9 font-bold">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};
