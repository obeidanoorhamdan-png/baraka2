import "@/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { OfflineStatusBar } from "@/components/OfflineStatusBar";
import { startSyncEngine } from "@/lib/syncEngine";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import MyApplication from "./pages/MyApplication";
import MyAid from "./pages/MyAid";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Incomplete from "./pages/admin/Incomplete";
import AuditLog from "./pages/admin/AuditLog";
import Managers from "./pages/admin/Managers";
import AdminSettings from "./pages/admin/Settings";
import AidPage from "./pages/admin/AidPage";
import AnnouncementsAdmin from "./pages/admin/Announcements";
import PowerTools from "./pages/admin/PowerTools";
import ExcelExport from "./pages/admin/ExcelExport";
import Announcements from "./pages/Announcements";
import Dashboard from "./pages/Dashboard";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Idempotently bootstrap the admin account on first load. Silent — never
    // expose admin credentials to end users in any visible toast or UI.
    supabase.functions.invoke("seed-admin").catch(() => {});
    // Start draining any queued offline mutations.
    startSyncEngine();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <OfflineStatusBar />
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/my-application" element={<MyApplication />} />
                <Route path="/my-aid" element={<MyAid />} />
                <Route path="/my-aid/:id" element={<MyAid />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/applications" element={<Admin />} />
                <Route path="/admin/incomplete" element={<Incomplete />} />
                <Route path="/admin/aid" element={<AidPage />} />
                <Route path="/admin/announcements" element={<AnnouncementsAdmin />} />
                <Route path="/admin/managers" element={<Managers />} />
                <Route path="/admin/audit" element={<AuditLog />} />
                <Route path="/admin/power" element={<PowerTools />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
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
