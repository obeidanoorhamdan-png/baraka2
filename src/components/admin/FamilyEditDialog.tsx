import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FamilyPanel } from "@/components/family/FamilyPanel";
import { UserCog, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  app: any | null;
  head: any | null;
  members: any[];
  onSaved: () => void;
}

export const FamilyEditDialog = ({ open, onOpenChange, app, head, members, onSaved }: Props) => {
  const [profile, setProfile] = useState<any>(head);
  const [application, setApplication] = useState<any>(app);
  const [fam, setFam] = useState<any[]>(members || []);
  const [complaints, setComplaints] = useState<any[]>([]);

  const reload = useCallback(async () => {
    if (!head?.id) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", head.id).maybeSingle();
    if (prof) setProfile(prof);
    if (app?.id) {
      const { data: a } = await supabase.from("applications").select("*").eq("id", app.id).maybeSingle();
      if (a) setApplication(a);
      const { data: fm } = await supabase
        .from("family_members").select("*").eq("application_id", app.id).order("created_at");
      setFam(fm || []);
    }
    const { data: cs } = await supabase
      .from("complaints" as any).select("*").eq("user_id", head.id)
      .order("created_at", { ascending: false });
    setComplaints((cs as any[]) || []);
    onSaved();
  }, [head?.id, app?.id, onSaved]);

  useEffect(() => {
    if (open) {
      setProfile(head);
      setApplication(app);
      setFam(members || []);
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto p-3 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> تعديل بيانات الأسرة
          </DialogTitle>
        </DialogHeader>

        {profile && (
          <FamilyPanel
            profile={profile}
            app={application}
            members={fam}
            complaints={complaints}
            adminMode
            showSettings={false}
            onReload={reload}
          />
        )}

        <div className="pt-2">
          <Button variant="outline" className="w-full gap-2" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
