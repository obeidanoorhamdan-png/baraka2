import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { prepareUpload } from "@/lib/imageUpload";
import { toast } from "sonner";
import { FileCheck2, Loader2, Upload } from "lucide-react";

export type InjuryData = {
  injury_report_url: string;
  injury_location: string;
  injury_severity: string;
  needs_treatment: boolean;
  treatment_supplies: string;
};

export const SEVERITIES = ["بسيطة", "متوسطة", "شديدة", "خطيرة / إعاقة دائمة"];

export const injuryFrom = (r: any): InjuryData => ({
  injury_report_url: r?.injury_report_url || "",
  injury_location: r?.injury_location || "",
  injury_severity: r?.injury_severity || "",
  needs_treatment: !!r?.needs_treatment,
  treatment_supplies: r?.treatment_supplies || "",
});

/** Returns an error message, or null when valid. */
export const validateInjury = (d: InjuryData): string | null => {
  if (!d.injury_report_url) return "رفع تقرير الإصابة إجباري لمصاب الحرب";
  if (!d.injury_location.trim()) return "اكتب مكان الإصابة";
  if (!d.injury_severity) return "اختر درجة صعوبة الإصابة";
  if (d.needs_treatment && !d.treatment_supplies.trim()) return "اكتب المستلزمات العلاجية المطلوبة";
  return null;
};

export const clearedInjury = {
  injury_location: null, injury_severity: null, needs_treatment: false, treatment_supplies: null,
};

export const WarInjuryFields = ({ value, onChange, ownerId }: {
  value: InjuryData; onChange: (v: InjuryData) => void; ownerId: string;
}) => {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const p = await prepareUpload(file);
      const ext = p.file.type === "application/pdf" ? "pdf" : "jpg";
      const path = `${ownerId}/${Date.now()}-injury.${ext}`;
      const { error } = await supabase.storage.from("medical-reports").upload(path, p.file, { upsert: true, contentType: p.file.type });
      if (error) throw error;
      onChange({ ...value, injury_report_url: path });
      toast.success("تم رفع التقرير");
    } catch {
      toast.error("تعذّر رفع التقرير");
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-extrabold text-destructive">بيانات إصابة الحرب (إجبارية)</p>
      <div>
        <Label className="text-xs">تقرير الإصابة *</Label>
        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-accent/50 bg-card p-2.5 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : value.injury_report_url
            ? <FileCheck2 className="h-4 w-4 text-success" /> : <Upload className="h-4 w-4 text-accent" />}
          {value.injury_report_url ? "تم رفع التقرير — اضغط للاستبدال" : "اضغط لرفع صورة أو PDF للتقرير"}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">مكان الإصابة *</Label>
          <Input value={value.injury_location} placeholder="مثال: الساق اليمنى"
            onChange={(e) => onChange({ ...value, injury_location: e.target.value.slice(0, 150) })} />
        </div>
        <div>
          <Label className="text-xs">صعوبة الإصابة *</Label>
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={value.injury_severity} onChange={(e) => onChange({ ...value, injury_severity: e.target.value })}>
            <option value="">اختر</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">هل يحتاج إلى علاج؟</Label>
        <div className="mt-1 flex gap-4 text-sm">
          {[true, false].map((b) => (
            <label key={String(b)} className="flex items-center gap-1">
              <input type="radio" checked={value.needs_treatment === b}
                onChange={() => onChange({ ...value, needs_treatment: b })} /> {b ? "نعم" : "لا"}
            </label>
          ))}
        </div>
      </div>
      {value.needs_treatment && (
        <div>
          <Label className="text-xs">ما هي المستلزمات العلاجية؟ *</Label>
          <Textarea rows={2} value={value.treatment_supplies} placeholder="أدوية، كرسي متحرك، جلسات علاج طبيعي..."
            onChange={(e) => onChange({ ...value, treatment_supplies: e.target.value.slice(0, 500) })} />
        </div>
      )}
    </div>
  );
};
