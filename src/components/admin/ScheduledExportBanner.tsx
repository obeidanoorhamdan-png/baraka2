import { useState } from "react";
import { CalendarClock, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportMultiSheet, getSchedule, isDue, markRun } from "@/lib/excelPro";

/** يظهر للإدارة عند حلول موعد التصدير المجدول — تنزيل بضغطة واحدة. */
export const ScheduledExportBanner = () => {
  const [show, setShow] = useState(() => isDue(getSchedule()));
  const [busy, setBusy] = useState(false);
  if (!show) return null;
  const run = async () => {
    setBusy(true);
    try {
      const r = await exportMultiSheet({ approvedOnly: getSchedule().approvedOnly });
      markRun();
      toast.success(`تم تنزيل التقرير الدوري (${r.families} أسرة)`);
      setShow(false);
    } catch (e: any) { toast.error(e.message || "تعذر التصدير"); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent-soft p-3 animate-fade-in">
      <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm font-semibold">حان موعد التقرير الدوري الشامل</div>
      <Button size="sm" onClick={run} disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} تنزيل
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { markRun(); setShow(false); }} aria-label="تخطي">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
