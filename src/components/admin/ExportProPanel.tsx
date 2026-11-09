import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Layers, Loader2, Printer, CalendarClock, BarChart3 } from "lucide-react";
import { exportMultiSheet, getSchedule, setSchedule, markRun, type ScheduleFreq } from "@/lib/excelPro";

export const ExportProPanel = () => {
  const [busy, setBusy] = useState(false);
  const [sched, setSched] = useState(getSchedule());
  const update = (patch: Partial<typeof sched>) => { const n = { ...sched, ...patch }; setSched(n); setSchedule(n); };

  const run = async () => {
    setBusy(true);
    try {
      const r = await exportMultiSheet({ approvedOnly: sched.approvedOnly });
      markRun();
      toast.success(`تم التصدير: ${r.families} أسرة و${r.persons} فرد`);
    } catch (e: any) { toast.error(e.message || "تعذر التصدير"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="border-2 border-primary/30 md:col-span-2">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 font-extrabold"><Layers className="h-5 w-5 text-primary" /> التقرير الشامل (ملف واحد بعدة أوراق)</div>
          <p className="text-xs text-muted-foreground">
            ورقة الملخص والإحصائيات مع أشرطة رسم بياني، ثم كشف الأسر، كشف الأفراد، والشكاوى والطلبات — بتنسيق رسمي وفلاتر جاهزة.
          </p>
          <div className="flex items-center gap-2">
            <Switch id="ap" checked={sched.approvedOnly} onCheckedChange={(b) => update({ approvedOnly: b })} />
            <Label htmlFor="ap" className="text-sm">المقبولون فقط</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={busy} className="gap-2 font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} تنزيل التقرير الشامل
            </Button>
            <Button asChild variant="outline" className="gap-2"><Link to="/admin/print"><Printer className="h-4 w-4" /> طباعة PDF رسمية</Link></Button>
            <Button asChild variant="outline" className="gap-2"><Link to="/admin/stats"><BarChart3 className="h-4 w-4" /> الإحصائيات</Link></Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-2">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 font-extrabold"><CalendarClock className="h-5 w-5 text-primary" /> تصدير مجدول</div>
          <p className="text-xs text-muted-foreground">عند حلول الموعد يظهر لك تنبيه في لوحة الإدارة لتنزيل التقرير بضغطة واحدة.</p>
          <Select value={sched.freq} onValueChange={(f) => update({ freq: f as ScheduleFreq })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">متوقف</SelectItem>
              <SelectItem value="daily">يومياً</SelectItem>
              <SelectItem value="weekly">أسبوعياً</SelectItem>
              <SelectItem value="monthly">شهرياً</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-[11px] text-muted-foreground">
            آخر تصدير: {sched.lastRun ? new Date(sched.lastRun).toLocaleString("ar-EG") : "لم يتم بعد"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
