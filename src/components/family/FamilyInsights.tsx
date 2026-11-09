import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, History, ChevronDown } from "lucide-react";
import { familyCompletion } from "@/lib/familyCompletion";

const FIELD_AR: Record<string, string> = {
  full_name: "الاسم", national_id: "رقم الهوية", phone: "الجوال", alt_phone: "الجوال البديل", birth_date: "تاريخ الميلاد",
  gender: "الجنس", marital_status: "الحالة الاجتماعية", chronic_diseases: "الأمراض المزمنة", is_war_injured: "إصابة الحرب",
  is_special_needs: "ذوي الهمم", is_pregnant: "الحمل", is_breastfeeding: "الرضاعة", current_landmark: "المعلم القريب",
  original_residence: "السكن الأصلي", current_camp: "المخيم", id_card_url: "صورة الهوية", is_university_student: "الدراسة الجامعية",
  relationship: "صلة القرابة", work_status: "العمل", health_notes: "ملاحظات صحية",
};
const TARGET_AR: Record<string, string> = { profiles: "بيانات رب الأسرة", applications: "بيانات السكن", family_members: "فرد" };
const ACTION_AR: Record<string, string> = { insert: "إضافة", update: "تعديل", delete: "حذف" };

export const FamilyInsights = ({ profile, app, members }: { profile: any; app: any; members: any[] }) => {
  const { percent, missing } = familyCompletion(profile, app, members);
  const [log, setLog] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("family_edit_log").select("*").eq("family_user_id", profile.id)
      .order("created_at", { ascending: false }).limit(30).then(({ data }) => setLog(data || []));
  }, [profile.id, members.length]);

  return (
    <div className="mb-3 grid gap-3 md:grid-cols-2">
      <Card className="p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">اكتمال بيانات الأسرة</span>
          <span className={`text-lg font-extrabold ${percent === 100 ? "text-success" : "text-primary"}`}>{percent}%</span>
        </div>
        <Progress value={percent} className="h-2.5" />
        {missing.length ? (
          <ul className="mt-3 space-y-1">
            {missing.slice(0, 5).map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertCircle className="h-3.5 w-3.5 text-warning" /> {m}</li>
            ))}
            {missing.length > 5 && <li className="text-xs text-muted-foreground">و{missing.length - 5} أخرى…</li>}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> بياناتكم مكتملة، شكراً لكم</div>
        )}
      </Card>
      <Card className="p-4 shadow-card">
        <button className="flex w-full items-center justify-between font-bold" onClick={() => setOpen((o) => !o)}>
          <span className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> سجل التعديلات ({log.length})</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {!log.length && <div className="mt-2 text-xs text-muted-foreground">لا يوجد تعديلات بعد.</div>}
        <ul className={`mt-2 space-y-2 overflow-y-auto transition-all ${open ? "max-h-72" : "max-h-24"}`}>
          {log.map((l) => (
            <li key={l.id} className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span>{ACTION_AR[l.action] || l.action} {TARGET_AR[l.target] || ""} {l.target === "family_members" ? l.target_label : ""}</span>
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              {l.changed_fields?.length > 0 && (
                <div className="mt-0.5 text-muted-foreground">{l.changed_fields.map((f: string) => FIELD_AR[f] || f).slice(0, 6).join("، ")}</div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
