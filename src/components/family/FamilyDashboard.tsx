import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FamilyPanel } from "@/components/family/FamilyPanel";

interface Props {
  userId: string;
}

/**
 * Self-loading family control panel — same UI the family sees on the
 * dashboard. Also surfaces any open "data update request" sent by an admin,
 * so the notification link lands on this exact interface.
 */
export const FamilyDashboard = ({ userId }: Props) => {
  const [profile, setProfile] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [reqs, setReqs] = useState<{ id: string; fields: string[]; message: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(prof);
    const { data: a } = await supabase.from("applications").select("*").eq("user_id", userId).maybeSingle();
    setApp(a);
    if (a) {
      const { data: fm } = await supabase
        .from("family_members").select("*").eq("application_id", a.id).order("created_at");
      setMembers(fm || []);
    } else {
      setMembers([]);
    }
    const { data: cs } = await supabase
      .from("complaints" as any).select("*").eq("user_id", userId)
      .order("created_at", { ascending: false });
    setComplaints((cs as any[]) || []);
    const { data: rq } = await supabase
      .from("data_update_requests" as any).select("id, fields, message")
      .eq("target_user_id", userId).eq("status", "open");
    setReqs((rq as any[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
    );
  }

  if (!profile) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد بيانات لحسابك بعد.</Card>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-1 py-2 sm:px-2">
      {reqs.length > 0 && (
        <Card className="mb-3 border-warning/50 bg-warning/10 p-4 animate-fade-in">
          <div className="flex flex-wrap items-start gap-3">
            <div className="shrink-0 rounded-full bg-warning/20 p-2">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-primary">مطلوب تحديث بياناتك</div>
              {reqs.map((r) => (
                <p key={r.id} className="mt-1 text-xs text-muted-foreground">
                  {r.message || "الرجاء مراجعة بياناتك وتحديثها."}
                  {r.fields?.length > 0 && (
                    <span className="block font-semibold text-foreground/80">الحقول: {r.fields.join("، ")}</span>
                  )}
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}
      <FamilyPanel
        profile={profile}
        app={app}
        members={members}
        complaints={complaints}
        onReload={load}
      />
    </div>
  );
};
