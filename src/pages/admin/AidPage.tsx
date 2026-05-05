import { AdminLayout } from "@/components/admin/AdminLayout";
import { BulkAidDistributor } from "@/components/BulkAidDistributor";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AidPage = () => {
  const { user } = useAuth();
  const [families, setFamilies] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: apps } = await supabase.from("applications").select("*");
      if (!apps?.length) return;
      const userIds = apps.map((a) => a.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", userIds);
      const pmap: Record<string, any> = {};
      (profs || []).forEach((p: any) => { pmap[p.id] = p; });
      setFamilies(apps.map((r) => ({
        application_id: r.id,
        user_id: r.user_id,
        head_name: pmap[r.user_id]?.full_name || "",
        national_id: pmap[r.user_id]?.national_id || "",
        family_size: r.family_size || 0,
        status: r.status,
      })));
    };
    load();
  }, []);

  if (!user) return null;

  return (
    <AdminLayout title="توزيع المساعدات">
      <div className="container py-6 max-w-7xl">
        <BulkAidDistributor currentUserId={user.id} families={families} />
      </div>
    </AdminLayout>
  );
};

export default AidPage;
