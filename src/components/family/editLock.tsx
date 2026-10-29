import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Timer, Unlock } from "lucide-react";

/** true = editing locked for the family */
export const EditLockCtx = createContext(false);
export const useEditLocked = () => useContext(EditLockCtx);

export const fmtRemaining = (ms: number) => {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d} يوم ` : ""}${p(h)}:${p(m)}:${p(sec)}`;
};

/** Loads the active edit grant for a user and ticks every second. */
export const useEditGrant = (userId?: string | null) => {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("edit_grants").select("expires_at")
      .eq("user_id", userId).eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false }).limit(1).maybeSingle();
    setExpiresAt(data?.expires_at ? new Date(data.expires_at).getTime() : null);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = expiresAt ? expiresAt - now : 0;
  return { active: remaining > 0, remaining, expiresAt, reload: load };
};

export const EditCountdownBanner = ({ active, remaining }: { active: boolean; remaining: number }) =>
  active ? (
    <div className="sticky top-2 z-20 flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent-soft p-3 shadow-card">
      <span className="flex items-center gap-2 text-sm font-bold text-primary">
        <Timer className="h-5 w-5 text-accent" /> التعديل مفتوح — الوقت المتبقي قبل القفل
      </span>
      <span dir="ltr" className="rounded-lg bg-accent px-3 py-1 font-mono text-sm font-extrabold text-accent-foreground">
        {fmtRemaining(remaining)}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm font-semibold text-muted-foreground">
      <Lock className="h-4 w-4" /> التعديل مقفل — يفتحه المسؤول الإداري لمدة محددة عند الحاجة.
    </div>
  );

const DURATIONS = [
  { m: 30, l: "30 دقيقة" }, { m: 60, l: "ساعة" }, { m: 180, l: "3 ساعات" },
  { m: 1440, l: "يوم" }, { m: 4320, l: "3 أيام" }, { m: 10080, l: "أسبوع" },
];

/** Admin control: open editing for a family for a chosen duration. */
export const AdminEditGrantControl = ({ userId }: { userId: string }) => {
  const { active, remaining, reload } = useEditGrant(userId);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_edit", { _user_id: userId, _minutes: minutes });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم السماح للأسرة بالتعديل");
    reload();
  };
  const revoke = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_revoke_edit", { _user_id: userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم قفل التعديل");
    reload();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/30 p-3">
      <span className="flex items-center gap-1 text-sm font-bold text-primary">
        <Unlock className="h-4 w-4 text-accent" /> سماح الأسرة بالتعديل:
      </span>
      {active ? (
        <>
          <span dir="ltr" className="rounded bg-accent px-2 py-0.5 font-mono text-xs font-bold text-accent-foreground">
            {fmtRemaining(remaining)}
          </span>
          <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={busy} onClick={revoke}>قفل الآن</Button>
        </>
      ) : null}
      <select className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
        {DURATIONS.map((d) => <option key={d.m} value={d.m}>{d.l}</option>)}
      </select>
      <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={grant}>
        {active ? "تمديد" : "فتح التعديل"}
      </Button>
    </div>
  );
};
