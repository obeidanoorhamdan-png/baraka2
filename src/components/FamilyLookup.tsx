import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Crown, MessageCircle, Users, Home, Lock } from "lucide-react";
import { calculateAge } from "@/lib/age";
import { formatBirthDate } from "@/lib/formatDate";
import { waLink } from "@/lib/contact";
import { EDIT_WHATSAPP, EDIT_WHATSAPP_DISPLAY, EDIT_CONTACT_NAME } from "@/components/family/DocsStudySection";

const REL: Record<string, string> = { wife: "زوجة", husband: "زوج", son: "ابن", daughter: "ابنة", father: "أب", mother: "أم", brother: "أخ", sister: "أخت", other: "أخرى" };
const MAR: Record<string, string> = { married: "متزوج/ة", single: "أعزب/عزباء", widowed: "أرمل/ة", divorced: "مطلق/ة", other: "أخرى" };
const STATUS: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
const v = (x: any) => (x === null || x === undefined || x === "" ? "لا يوجد" : String(x));
const yn = (b: any) => (b ? "نعم" : "لا");

const Item = ({ label, value, ltr }: { label: string; value: any; ltr?: boolean }) => (
  <div className="rounded-lg border-e-4 border-accent bg-accent-soft/40 px-3 py-2">
    <div className="text-[11px] font-bold text-accent">{label}</div>
    <div className="text-sm font-semibold break-words" dir={ltr ? "ltr" : undefined}>{v(value)}</div>
  </div>
);

export const FamilyLookup = () => {
  const [nid, setNid] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(undefined);
  const [err, setErr] = useState("");

  const search = async () => {
    setErr("");
    if (!/^\d{9}$/.test(nid)) { setErr("رقم الهوية يجب أن يكون 9 أرقام"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("public_family_lookup" as any, { _nid: nid } as any);
    setBusy(false);
    if (error) { setErr("تعذّر البحث، حاول مجدداً"); return; }
    if (!data) { setRes(null); setErr("لا توجد أسرة مسجلة بهذا الرقم"); return; }
    setRes(data);
  };

  const h = res?.head; const a = res?.app;

  return (
    <Card className="w-full max-w-xl p-4 sm:p-5 shadow-elegant bg-card/95 backdrop-blur">
      <div className="text-base font-extrabold text-primary mb-1">استعلام عن بيانات الأسرة</div>
      <p className="text-xs text-muted-foreground mb-3">اكتب رقم الهوية (رب الأسرة أو أي فرد) لعرض البيانات.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Input dir="ltr" inputMode="numeric" placeholder="رقم الهوية — 9 أرقام" value={nid}
          onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-11 text-center text-lg tracking-widest" />
        <Button type="submit" className="h-11 gap-1" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} عرض
        </Button>
      </form>
      {err && <p className="mt-2 text-sm font-semibold text-destructive">{err}</p>}

      {h && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-2 text-xs font-semibold">
            <Lock className="h-4 w-4 text-accent" /> للعرض فقط — لا يمكن التعديل من هنا
          </div>
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Crown className="h-4 w-4" /> رب الأسرة</h3>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              <Item label="الاسم" value={h.full_name} />
              <Item label="رقم الهوية" value={h.national_id} ltr />
              <Item label="تاريخ الميلاد" value={formatBirthDate(h.birth_date)} ltr />
              <Item label="العمر" value={h.birth_date ? calculateAge(h.birth_date) : null} />
              <Item label="الجوال" value={h.phone} ltr />
              <Item label="الجوال البديل" value={h.alt_phone} ltr />
              <Item label="الحالة الاجتماعية" value={MAR[h.marital_status]} />
              <Item label="حالة العمل" value={h.work_status} />
              <Item label="أمراض مزمنة" value={h.chronic_diseases} />
              <Item label="مصاب حرب" value={yn(h.is_war_injured)} />
              <Item label="صورة الهوية" value={h.has_id_card ? "مرفوعة" : "لم تُرفع"} />
              <Item label="طالب جامعي" value={h.is_university_student ? `نعم — ${v(h.university_major)} · ${v(h.university_name)} · ${v(h.university_year)}` : "لا"} />
            </div>
          </section>
          {a && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Home className="h-4 w-4" /> الطلب والسكن</h3>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                <Item label="حالة الطلب" value={STATUS[a.status]} />
                <Item label="رقم الأسرة" value={a.family_no} />
                <Item label="عدد الأفراد" value={a.family_size} />
                <Item label="السكن الأصلي" value={a.original_residence} />
                <Item label="المحافظة الحالية" value={a.current_governorate} />
                <Item label="الحي / المخيم الحالي" value={a.current_camp} />
                <Item label="أقرب معلم" value={a.current_landmark} />
                <Item label="نوع السكن" value={a.current_housing_type} />
              </div>
            </section>
          )}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent"><Users className="h-4 w-4" /> أفراد الأسرة ({res.members.length})</h3>
            <div className="space-y-2">
              {res.members.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد</p>}
              {res.members.map((m: any, i: number) => {
                const age = m.birth_date ? calculateAge(m.birth_date) : 0;
                return (
                  <div key={i} className="rounded-lg border border-accent/25 p-2.5 text-xs space-y-1">
                    <div className="font-bold text-primary text-sm">{v(m.full_name)} <span className="text-muted-foreground font-normal">— {REL[m.relationship] || "—"} · {age} سنة</span></div>
                    <div>الهوية: <span dir="ltr">{v(m.national_id)}</span> · الميلاد: <span dir="ltr">{formatBirthDate(m.birth_date) || "لا يوجد"}</span></div>
                    <div>أمراض مزمنة: {v(m.chronic_diseases)} · مصاب حرب: {yn(m.is_war_injured)}{m.gender === "female" && ` · ${[m.is_pregnant && "حامل", m.is_breastfeeding && "مرضعة"].filter(Boolean).join(" و ") || "غير حامل/مرضعة"}`}</div>
                    {age < 5 && <div>شهادة الميلاد: {m.has_birth_certificate ? "مرفوعة" : "لم تُرفع"}</div>}
                    {age >= 18 && <div>طالب جامعي: {m.is_university_student ? `نعم — ${v(m.university_major)} · ${v(m.university_name)} · ${v(m.university_year)}` : "لا"}</div>}
                  </div>
                );
              })}
            </div>
          </section>
          <a href={waLink(EDIT_WHATSAPP, `مرحباً، أرغب بطلب تعديل بيانات الأسرة - رقم الهوية ${h.national_id}`)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent p-3 text-sm font-bold text-accent-foreground shadow-gold">
            <MessageCircle className="h-5 w-5" /> طلب تعديل عبر واتساب — {EDIT_CONTACT_NAME} <span dir="ltr">{EDIT_WHATSAPP_DISPLAY}</span>
          </a>
        </div>
      )}
    </Card>
  );
};
