import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  registration_open: boolean;
  closed_reason: string | null;
}

const DEFAULT: AppSettings = { registration_open: true, closed_reason: null };

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("registration_open, closed_reason")
      .eq("id", 1)
      .maybeSingle();
    if (data) setSettings(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);
  return { settings, loading, refresh };
};
