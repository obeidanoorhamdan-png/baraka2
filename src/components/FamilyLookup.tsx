import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Crown, MessageCircle, Users, Home, Lock, HeartPulse, FileImage, GraduationCap, ArrowRight } from "lucide-react";
import { calculateAge } from "@/lib/age";
import { formatBirthDate } from "@/lib/formatDate";
import { waLink } from "@/lib/contact";
import { EDIT_WHATSAPP, EDIT_WHATSAPP_DISPLAY, EDIT_CONTACT_NAME } from "@/components/family/DocsStudySection";

const REL: Record<string, string> = { wife: "زوجة", husband: "زوج", son: "ابن", daughter: "ابنة", father: "أب", mother: "أم", brother: "أخ", sister: "أخت", other: "أخرى" };
const MAR: Record<string, string> = { married: "متزوج/ة", single: "أعزب/عزباء", widowed: "أرمل/ة", divorced: "مطلق/ة", other: "أخرى" };
const STATUS: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
const v = (x: unknown) => (x === null || x === undefined || x === "" ? "لا يوجد" : String(x));
const yn = (b: unknown) => (b ? "نعم" : "لا");

const Item = ({ label, value, ltr }: { label: string; value: unknown; ltr?: boolean }) => (
  <div className="rounded-md border-e-4 border-accent bg-accent-soft/40 px-3 py-2">
    <div className="text-[11px] font-bold text-accent">{label}</div>
    <div className="break-words text-sm font-semibold" dir={ltr ? "ltr" : undefined}>{v(value)}</div>
  </div>
);

const DOCUMENTS = [
  ["id_card_url", "صورة هوية رب الأسرة"],
  ["injury_report_url", "تقرير إصابة الحرب"],
  ["chronic_disease_report_url", "تقرير المرض المزمن"],
  ["special_needs_report_url", "تقرير ذوي الاحتياجات الخاصة"],
  ["pregnancy_report_url", "تقرير الحمل"],
  ["birth_certificate_url", "شهادة الميلاد"],
] as const;

type Preview = { url: string; title: string } | null;

const Documents = ({ record, prefix = "" }: { record: Record<string, any>; prefix?: string }) => {
  const [preview, setPreview] = useState<Preview>(null);
  const docs = DOCUMENTS.filter(([field]) => record?.[field]);
  if (!docs.length) return <Item label="المستندات" value="لا يوجد" />;
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {docs.map(([field, title]) => (
          <Button key={field} type="button" variant="outline" className="h-auto min-h-11 justify-start gap-2 whitespace-normal text-start" onClick={() => setPreview({ url: record[field], title: `${prefix}${title}` })}>
            <FileImage className="h-4 w-4 text-accent" /> عرض {title}
          </Button>
        ))}
      </div>
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          <div className="max-h-[72vh] overflow-auto rounded-md bg-muted p-2 text-center">
            {preview?.url?.toLowerCase().includes(".pdf") ? (
              <iframe src={preview.url} title={preview.title} className="h-[65vh] w-full rounded-md" />
            ) : (
              <img src={preview?.url} alt={preview?.title || "مستند"} className="mx-auto max-h-[68vh] rounded-md object-contain" />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">للعرض فقط — لا يتوفر تنزيل المستند من شاشة التدقيق</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const FamilyLookup = ({ expanded = false }: { expanded?: boolean }) => {
  const [nid, setNid] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(undefined);
  const [err, setErr] = useState("");

  const search = async () => {
    setErr("");
    setRes(undefined);
    if (!/^\d{9}$/.test(nid)) { setErr("رقم الهوية يجب أن يكون 9 أرقام"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("family-audit", { body: { national_id: nid } });
    setBusy(false);
    if (error || data?.error) { setErr(data?.error || "تعذّر البحث، حاول مجدداً"); return; }
    if (!data?.data) { setRes(null); setErr("لا توجد أسرة مسجلة بهذا الرقم"); return; }
    setRes(data.data);
  };

  const reset = () => { setRes(undefined); setErr(""); setNid(""); };
  const h = res?.head;
  const a = res?.app;

  return (
    <Card className={`${expanded ? "max-w-5xl" : "max-w-xl"} mx-auto w-full p-4 shadow-elegant sm:p-5`}>
      {!h && <>
        <div className="mb-1 text-base font-extrabold text-primary">اكتب رقم الهوية</div>
        <p className="mb-3 text-xs text-muted-foreground">رقم هوية رب الأسرة أو أي فرد مسجل، ثم اضغط متابعة.</p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <Input dir="ltr" inputMode="numeric" aria-label="رقم الهوية" placeholder="رقم الهوية — 9 أرقام" value={nid}
            onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-11 text-center text-lg tracking-widest" />
          <Button type="submit" className="h-11 gap-1 sm:min-w-32" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} متابعة
          </Button>
        </form>
        {err && <p className="mt-2 text-sm font-semibold text-destructive">{err}</p>}
      </>}

      {h && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xl font-extrabold text-primary">ملف الأسرة</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Lock className="h-3.5 w-3.5 text-success" /> للعرض والتدقيق فقط</div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reset}><ArrowRight className="h-4 w-4" /> بحث جديد</Button>
          </div>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Crown className="h-4 w-4" /> البيانات الشخصية والاجتماعية</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="الاسم" value={h.full_name} /><Item label="رقم الهوية" value={h.national_id} ltr />
              <Item label="تاريخ الميلاد" value={formatBirthDate(h.birth_date)} ltr /><Item label="العمر" value={h.birth_date ? calculateAge(h.birth_date) : 0} />
              <Item label="الجنس" value={h.gender === "male" ? "ذكر" : h.gender === "female" ? "أنثى" : "لا يوجد"} />
              <Item label="الحالة الاجتماعية" value={MAR[h.marital_status]} /><Item label="حالة العمل" value={h.work_status} />
              <Item label="الجوال" value={h.phone} ltr /><Item label="الجوال البديل" value={h.alt_phone} ltr />
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><HeartPulse className="h-4 w-4" /> البيانات الصحية والتعليمية</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="أمراض مزمنة" value={h.chronic_diseases} /><Item label="ملاحظات صحية" value={h.health_notes} />
              <Item label="مصاب حرب" value={yn(h.is_war_injured)} /><Item label="احتياجات خاصة" value={yn(h.is_special_needs)} />
              <Item label="طالب جامعي" value={yn(h.is_university_student)} /><Item label="التخصص" value={h.university_major} />
              <Item label="الجامعة" value={h.university_name} /><Item label="السنة الدراسية" value={h.university_year} />
            </div>
            <div className="mt-2"><Documents record={h} /></div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Home className="h-4 w-4" /> الطلب والسكن</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="حالة الطلب" value={STATUS[a?.status]} /><Item label="رقم الأسرة / الخيمة" value={a?.family_no ?? 0} />
              <Item label="عدد الأفراد" value={a?.family_size ?? 0} /><Item label="السكن الأصلي" value={a?.original_residence} />
              <Item label="أقرب معلم بالسكن الأصلي" value={a?.original_landmark} /><Item label="المحافظة الحالية" value={a?.current_governorate} />
              <Item label="المخيم الحالي" value={a?.current_camp} /><Item label="أقرب معلم حالياً" value={a?.current_landmark} />
              <Item label="نوع السكن الحالي" value={a?.current_housing_type} /><Item label="حالة السكن السابق" value={a?.prev_housing_status} />
              <Item label="وجود شهيد بالأسرة" value={yn(a?.has_martyr)} /><Item label="اسم الشهيد" value={a?.martyr_name} />
              <Item label="صلة القرابة بالشهيد" value={a?.martyr_relationship} /><Item label="معيلة للأسرة" value={yn(a?.is_female_breadwinner)} />
            </div>
            {a?.martyr_death_certificate_url && <div className="mt-2"><Documents record={{ injury_report_url: a.martyr_death_certificate_url }} prefix="شهادة وفاة الشهيد — " /></div>}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Users className="h-4 w-4" /> أفراد الأسرة ({res.members?.length ?? 0})</h3>
            <div className="space-y-3">
              {!res.members?.length && <p className="text-xs text-muted-foreground">لا يوجد</p>}
              {res.members?.map((m: any, i: number) => {
                const age = m.birth_date ? calculateAge(m.birth_date) : 0;
                return (
                  <Card key={m.id || i} className="border-accent/25 p-3 shadow-none">
                    <div className="mb-2 flex flex-wrap items-center gap-2"><strong className="text-primary">{v(m.full_name)}</strong><span className="text-xs text-muted-foreground">{REL[m.relationship] || "لا يوجد"} · {age} سنة</span></div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <Item label="رقم الهوية" value={m.national_id} ltr /><Item label="تاريخ الميلاد" value={formatBirthDate(m.birth_date)} ltr />
                      <Item label="الجنس" value={m.gender === "male" ? "ذكر" : m.gender === "female" ? "أنثى" : "لا يوجد"} />
                      <Item label="أمراض مزمنة" value={m.chronic_diseases} /><Item label="ملاحظات صحية" value={m.health_notes} />
                      <Item label="مصاب حرب" value={yn(m.is_war_injured)} /><Item label="احتياجات خاصة" value={yn(m.is_special_needs)} />
                      {m.gender === "female" && <><Item label="حامل" value={yn(m.is_pregnant)} /><Item label="مرضعة" value={yn(m.is_breastfeeding)} /></>}
                      {age >= 18 && <><Item label="طالب جامعي" value={yn(m.is_university_student)} /><Item label="التخصص" value={m.university_major} /><Item label="الجامعة" value={m.university_name} /><Item label="السنة الدراسية" value={m.university_year} /></>}
                    </div>
                    <div className="mt-2"><Documents record={m} prefix={`${m.full_name} — `} /></div>
                  </Card>
                );
              })}
            </div>
          </section>

          <a href={waLink(EDIT_WHATSAPP, `مرحباً، أرغب بطلب تعديل بيانات الأسرة - رقم الهوية ${h.national_id}`)} target="_blank" rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-success p-3 text-center text-sm font-bold text-success-foreground">
            <MessageCircle className="h-5 w-5" /> طلب تعديل عبر واتساب — {EDIT_CONTACT_NAME} <span dir="ltr">{EDIT_WHATSAPP_DISPLAY}</span>
          </a>
        </div>
      )}
    </Card>
  );
};