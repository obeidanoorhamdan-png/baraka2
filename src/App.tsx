import "@/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import MyApplication from "./pages/MyApplication";
import MyAid from "./pages/MyAid";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SEED_TOAST_KEY = "seed-admin-toast-shown";

const App = () => {
  useEffect(() => {
    // Idempotently bootstrap the admin account on first load.
    supabase.functions.invoke("seed-admin").then(({ data, error }) => {
      if (error || !data?.ok) return;
      // Show success toast once per browser session, only when an admin is logged in.
      if (sessionStorage.getItem(SEED_TOAST_KEY)) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle()
          .then(({ data: roleRow }) => {
            if (!roleRow) return;
            sessionStorage.setItem(SEED_TOAST_KEY, "1");
            toast.success("تم تجهيز حساب الإدارة بنجاح", {
              description: "اسم المستخدم: 2026 — كلمة المرور: 1234",
            });
          });
      });
    }).catch(() => {});
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/my-application" element={<MyApplication />} />
                <Route path="/my-aid" element={<MyAid />} />
                <Route path="/my-aid/:id" element={<MyAid />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
