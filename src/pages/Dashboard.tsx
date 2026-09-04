import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FamilyPanel } from "@/components/family/FamilyPanel";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(prof);
    const { data: a } = await supabase.from("applications").select("*").eq("user_id", user.id).maybeSingle();
    setApp(a);
    if (a) {
      const { data: fm } = await supabase
        .from("family_members").select("*").eq("application_id", a.id).order("created_at");
      setMembers(fm || []);
    } else {
      setMembers([]);
    }
    const { data: cs } = await supabase
      .from("complaints" as any).select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setComplaints((cs as any[]) || []);
    setPageLoading(false);
  }, [user]);

  useEffect(() => { if (user) { setPageLoading(true); load(); } }, [user, load]);

  if (loading || pageLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد بيانات لحسابك بعد.</Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-1 py-2 sm:px-2">
        <FamilyPanel
          profile={profile}
          app={app}
          members={members}
          complaints={complaints}
          onReload={load}
        />
      </div>
    </Layout>
  );
};

export default Dashboard;
