import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * حالة محفوظة تلقائياً في الجهاز — أي بيانات يكتبها المستخدم في نموذج
 * التعديل تبقى موجودة إذا خرج من الموقع وعاد إليه، حتى قبل الحفظ.
 */
function usePersistedForm<T extends Record<string, any>>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...initial, ...JSON.parse(raw) };
    } catch {}
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  const clear = () => { try { localStorage.removeItem(key); } catch {} };
  return [value, setValue, clear] as const;
}

function hasPersistedForm(key: string) {
  try { return !!localStorage.getItem(key); } catch { return false; }
}
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBirthDate, formatDateShort } from "@/lib/formatDate";
import { ID_RE } from "@/lib/validators";
import {
  User, IdCard, Phone, CalendarDays, Users, Briefcase, HeartPulse, Home, MapPin,
  Tent, Navigation, Pencil, Trash2, Plus, Save, X, MessageSquareMore, Settings2,
  Crown, ClipboardList, Menu,
} from "lucide-react";
import { PasswordCard } from "@/components/family/PasswordCard";

/* ---------------- option lists ---------------- */
const GENDERS = [{ v: "male", l: "ذكر" }, { v: "female", l: "أنثى" }];
const MARITAL = [
  { v: "married", l: "متزوج/ة" }, { v: "single", l: "أعزب/عزباء" },
  { v: "widowed", l: "أرمل/ة" }, { v: "divorced", l: "مطلق/ة" }, { v: "other", l: "أخرى" },
];
const RELATIONS = [
  { v: "wife", l: "زوجة" }, { v: "husband", l: "زوج" }, { v: "son", l: "ابن" },
  { v: "daughter", l: "ابنة" }, { v: "father", l: "والد" }, { v: "mother", l: "والدة" },
  { v: "brother", l: "أخ" }, { v: "sister", l: "أخت" }, { v: "other", l: "أخرى" },
];
const WORK = [
  { v: "لا يعمل", l: "لا يعمل" }, { v: "يعمل", l: "يعمل" },
  { v: "عمل مؤقت", l: "عمل مؤقت" }, { v: "موظف حكومي", l: "موظف حكومي" },
  { v: "طالب", l: "طالب" }, { v: "متقاعد", l: "متقاعد" },
];
const DAMAGE = [
  { v: "كلي", l: "كلي" }, { v: "جزئي", l: "جزئي" }, { v: "سليم", l: "سليم" },
];
const HOUSING = [
  { v: "خيمة", l: "خيمة" }, { v: "مركز إيواء", l: "مركز إيواء" }, { v: "شقة إيجار", l: "شقة إيجار" },
  { v: "كرفان", l: "كرفان" }, { v: "بيت أقارب", l: "بيت أقارب" }, { v: "منزل", l: "منزل" },
];
const YESNO = [{ v: "yes", l: "نعم" }, { v: "no", l: "لا" }];
const GOVS = [
  "شمال غزة", "غزة", "الوسطى", "خان يونس", "رفح",
].map((g) => ({ v: g, l: g }));

/* ---------------- name helpers (head is one member, split for display) ---------------- */
const nameParts = (full?: string | null) => {
  const p = (full || "").trim().split(/\s+/).filter(Boolean);
  return { first: p[0] || "", father: p[1] || "", grand: p[2] || "", family: p.slice(3).join(" ") };
};
const joinName = (o: { first: string; father: string; grand: string; family: string }) =>
  [o.first, o.father, o.grand, o.family].map((x) => (x || "").trim()).filter(Boolean).join(" ");

export interface FamilyPanelProps {
  profile: any;
  app: any;
  members: any[];
  complaints?: any[];
  /** admin/reviewer editing another family */
  adminMode?: boolean;
  /** show the greeting hero banner */
  showHero?: boolean;
  /** show the password (settings) card */
  showSettings?: boolean;
  onReload: () => void | Promise<void>;
}

export const FamilyPanel = ({
  profile, app, members, complaints = [], adminMode = false,
  showHero = true, showSettings = true, onReload,
}: FamilyPanelProps) => {
  const visibleMembers = useMemo(() => (members || []).filter((m) => !m.is_head), [members]);

  /* ---------------- persistence ---------------- */
  const saveProfile = async (patch: Record<string, any>) => {
    if (adminMode) {
      const { error } = await supabase.rpc("admin_update_head_json", {
        _user_id: profile.id, _patch: patch as any,
      } as any);
      if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    } else {
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", profile.id);
      if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    }
    toast.success("تم الحفظ بنجاح");
    await onReload();
    return true;
  };

  const saveApp = async (patch: Record<string, any>) => {
    if (!app) return false;
    const { error } = await supabase.from("applications").update(patch as any).eq("id", app.id);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    toast.success("تم الحفظ بنجاح");
    await onReload();
    return true;
  };

  const saveMember = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("family_members").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    toast.success("تم حفظ بيانات الفرد");
    await onReload();
    return true;
  };

  const addMember = async () => {
    if (!app) return;
    const { error } = await supabase.from("family_members").insert({
      application_id: app.id,
      full_name: "",
      birth_date: new Date().toISOString().slice(0, 10),
      gender: "male",
      relationship: "son",
    } as any);
    if (error) { toast.error(error.message || "تعذّر إضافة فرد"); return; }
    const newSize = visibleMembers.length + 2; // members + new + head
    await supabase.from("applications").update({ family_size: newSize } as any).eq("id", app.id);
    toast.success("تمت إضافة فرد جديد — أكمل بياناته");
    await onReload();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) { toast.error(error.message || "تعذّر الحذف"); return; }
    if (app) {
      const newSize = Math.max(1, visibleMembers.filter((m) => m.id !== id).length + 1);
      await supabase.from("applications").update({ family_size: newSize } as any).eq("id", app.id);
    }
    toast.success("تم حذف الفرد");
    await onReload();
  };

  const np = nameParts(profile?.full_name);
  const hasHealth = !!(profile?.chronic_diseases || profile?.health_notes || profile?.is_war_injured);

  return (
    <div className="space-y-4 sm:space-y-5">
      {showHero && (
        <Card className="overflow-hidden border-accent/30 shadow-elegant">
          <div
            className="p-5 sm:p-7 text-center"
            style={{
              background:
                "repeating-linear-gradient(135deg, hsl(var(--accent)) 0 14px, hsl(var(--accent) / 0.82) 14px 28px)",
            }}
          >
            <h1 className="text-lg sm:text-2xl font-extrabold text-accent-foreground drop-shadow-sm">
              مرحباً، {profile?.full_name || "—"}
            </h1>
          </div>
        </Card>
      )}

      {/* ============ البيانات الشخصية ============ */}
      <SectionShell id="sec-personal" icon={User} title="البيانات الشخصية"
        initiallyOpen={hasPersistedForm(`baraka2:edit:head:${profile?.id || "me"}:name`) || hasPersistedForm(`baraka2:edit:head:${profile?.id || "me"}:data`)}
        editor={({ close }) => (
          <PersonalEditor np={np} profile={profile} onCancel={close}
            onSave={async (patch) => { const ok = await saveProfile(patch); if (ok) close(); }} />
        )}>
        <FieldGrid>
          <Pill icon={User} label="الاسم الأول" value={np.first} />
          <Pill icon={User} label="اسم الأب" value={np.father} />
          <Pill icon={User} label="اسم الجد" value={np.grand} />
          <Pill icon={Users} label="اسم العائلة" value={np.family} />
          <Pill icon={IdCard} label="رقم الهوية" value={profile?.national_id} ltr />
          <Pill icon={CalendarDays} label="تاريخ الميلاد" value={formatBirthDate(profile?.birth_date)} ltr />
          <Pill icon={Phone} label="رقم الجوال" value={profile?.phone} ltr />
          <Pill icon={Phone} label="رقم الجوال البديل" value={profile?.alt_phone} ltr />
          <Pill icon={Users} label="الجنس" value={GENDERS.find((g) => g.v === profile?.gender)?.l} />
        </FieldGrid>
      </SectionShell>

      {/* ============ البيانات الاجتماعية والعمل ============ */}
      <SectionShell id="sec-social" icon={Briefcase} title="البيانات الاجتماعية والعمل"
        initiallyOpen={hasPersistedForm(`baraka2:edit:social:${profile?.id || "me"}`)}
        editor={({ close }) => (
          <SocialEditor profile={profile} app={app} onCancel={close}
            onSave={async (pPatch, aPatch) => {
              const ok1 = await saveProfile(pPatch);
              const ok2 = app ? await saveApp(aPatch) : true;
              if (ok1 && ok2) close();
            }} />
        )}>
        <FieldGrid>
          <Pill icon={HeartPulse} label="الحالة الاجتماعية" value={MARITAL.find((m) => m.v === profile?.marital_status)?.l} />
          <Pill icon={Users} label="عدد أفراد الأسرة" value={app?.family_size ?? visibleMembers.length + 1} />
          <Pill icon={Briefcase} label="حالة العمل" value={profile?.work_status} />
        </FieldGrid>
      </SectionShell>

      {/* ============ الحالة الصحية ============ */}
      <SectionShell id="sec-health" icon={HeartPulse} title="الحالة الصحية"
        initiallyOpen={hasPersistedForm(`baraka2:edit:health:${profile?.id || "me"}`)}
        editor={({ close }) => (
          <HealthEditor profile={profile} onCancel={close}
            onSave={async (patch) => { const ok = await saveProfile(patch); if (ok) close(); }} />
        )}>
        <FieldGrid>
          <Pill icon={HeartPulse} label="هل يعاني من حالة صحية؟" value={hasHealth ? "نعم" : "لا"} />
          <Pill icon={HeartPulse} label="مصاب حرب" value={profile?.is_war_injured ? "نعم" : "لا"} />
          <Pill icon={HeartPulse} label="احتياجات خاصة" value={profile?.is_special_needs ? "نعم" : "لا"} />
        </FieldGrid>
        <div className="mt-2">
          <Pill icon={ClipboardList} label="وصف الحالة الصحية"
            value={profile?.chronic_diseases || profile?.health_notes} wide />
        </div>
      </SectionShell>

      {/* ============ بيانات السكن ============ */}
      {app && (
        <SectionShell id="sec-home" icon={Home} title="بيانات السكن"
          initiallyOpen={hasPersistedForm(`baraka2:edit:residence:${app?.id || "new"}`)}
          editor={({ close }) => (
            <ResidenceEditor app={app} onCancel={close}
              onSave={async (patch) => { const ok = await saveApp(patch); if (ok) close(); }} />
          )}>
          <FieldGrid>
            <Pill icon={MapPin} label="المحافظة الأصلية" value={app.original_residence} />
            <Pill icon={Home} label="حالة السكن السابق" value={app.prev_housing_status} />
            <Pill icon={MapPin} label="المحافظة الحالية" value={app.current_governorate} />
            <Pill icon={Tent} label="نوع السكن الحالي" value={app.current_housing_type} />
            <Pill icon={Tent} label="الحي السكني الحالي" value={app.current_camp} />
            <Pill icon={Navigation} label="أقرب معلم" value={app.current_landmark} />
            <Pill icon={Navigation} label="أقرب معلم (الأصلي)" value={app.original_landmark} />
          </FieldGrid>
        </SectionShell>
      )}

      {/* ============ أفراد الأسرة ============ */}
      {app && (
        <MembersSection
          members={visibleMembers}
          head={profile}
          onAdd={addMember}
          onRemove={removeMember}
          onSave={saveMember}
        />
      )}

      {/* ============ الشكاوى ============ */}
      <ComplaintsSection
        complaints={complaints}
        profile={profile}
        adminMode={adminMode}
        onReload={onReload}
      />

      {/* ============ الإعدادات ============ */}
      {showSettings && !adminMode && (
        <div id="sec-settings"><PasswordCard /></div>
      )}

      {/* ============ القائمة ============ */}
      <MenuCard hasApp={!!app} showSettings={showSettings && !adminMode} />
    </div>
  );
};

/* ================= layout primitives ================= */

const SectionShell = ({
  id, icon: Icon, title, children, editor, initiallyOpen = false,
}: {
  id?: string; icon: any; title: string; children: ReactNode;
  editor?: (ctx: { close: () => void }) => ReactNode;
  initiallyOpen?: boolean;
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card id={id} className="p-4 sm:p-5 shadow-card border-accent/20 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 border-b border-accent/25 pb-3">
        <h2 className="inline-flex min-w-0 items-center gap-2 text-base font-extrabold text-accent">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{title}</span>
        </h2>
        {editor && (
          open ? (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" /> إغلاق
            </Button>
          ) : (
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> تعديل
            </Button>
          )
        )}
      </div>
      <div className="pt-3">
        {open && editor ? editor({ close: () => setOpen(false) }) : children}
      </div>
    </Card>
  );
};

const FieldGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-2 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

const Pill = ({ icon: Icon, label, value, ltr, wide }: any) => (
  <div className={`rounded-xl border-e-4 border-accent bg-accent-soft/40 px-3 py-2 ${wide ? "w-full" : ""}`}>
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
      {Icon && <Icon className="h-3.5 w-3.5" />} {label}
    </div>
    <div className="mt-0.5 break-words text-sm font-semibold text-foreground" dir={ltr ? "ltr" : undefined}>
      {value === null || value === undefined || value === "" ? "لا يوجد" : String(value)}
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-bold text-accent">{label}</label>
    {children}
  </div>
);

const Sel = ({ value, options, onChange, placeholder = "اختر" }: any) => (
  <Select value={value || ""} onValueChange={onChange}>
    <SelectTrigger className="h-10"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {options.map((o: any) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
    </SelectContent>
  </Select>
);

const EditorActions = ({ onCancel, onSave, busy }: any) => (
  <div className="mt-4 flex flex-wrap gap-2">
    <Button size="sm" className="gap-1" onClick={onSave} disabled={busy}>
      <Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ"}
    </Button>
    <Button size="sm" variant="outline" className="gap-1" onClick={onCancel} disabled={busy}>
      <X className="h-4 w-4" /> إلغاء
    </Button>
  </div>
);

/* ================= editors ================= */

const PersonalEditor = ({ np, profile, onSave, onCancel }: any) => {
  const pk = `baraka2:edit:head:${profile?.id || "me"}`;
  const [f, setF, clearF] = usePersistedForm(`${pk}:name`, { ...np } as any);
  const [p, setP, clearP] = usePersistedForm(`${pk}:data`, {
    national_id: profile?.national_id || "",
    birth_date: profile?.birth_date || "",
    phone: profile?.phone || "",
    alt_phone: profile?.alt_phone || "",
    gender: profile?.gender || "",
  } as any);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const full = joinName(f);
    if (!full) { toast.error("الاسم مطلوب"); return; }
    if (!p.national_id) { toast.error("رقم الهوية مطلوب"); return; }
    if (!ID_RE.test(p.national_id)) { toast.error("رقم الهوية يجب أن يكون 9 أرقام"); return; }
    setBusy(true);
    const ok = await onSave({ ...p, full_name: full });
    if (ok !== false) { clearF(); clearP(); }
    setBusy(false);
  };


  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="الاسم الأول"><Input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
        <Field label="اسم الأب"><Input value={f.father} onChange={(e) => setF({ ...f, father: e.target.value })} /></Field>
        <Field label="اسم الجد"><Input value={f.grand} onChange={(e) => setF({ ...f, grand: e.target.value })} /></Field>
        <Field label="اسم العائلة"><Input value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })} /></Field>
        <Field label="رقم الهوية">
          <Input dir="ltr" inputMode="numeric" value={p.national_id}
            onChange={(e) => setP({ ...p, national_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
        </Field>
        <Field label="تاريخ الميلاد">
          <Input type="date" dir="ltr" value={p.birth_date || ""} onChange={(e) => setP({ ...p, birth_date: e.target.value })} />
        </Field>
        <Field label="رقم الجوال">
          <Input dir="ltr" inputMode="numeric" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </Field>
        <Field label="رقم الجوال البديل">
          <Input dir="ltr" inputMode="numeric" value={p.alt_phone || ""} onChange={(e) => setP({ ...p, alt_phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </Field>
        <Field label="الجنس"><Sel value={p.gender} options={GENDERS} onChange={(v: string) => setP({ ...p, gender: v })} /></Field>
      </div>
      <EditorActions onCancel={onCancel} onSave={submit} busy={busy} />
    </div>
  );
};

const SocialEditor = ({ profile, app, onSave, onCancel }: any) => {
  const key = `baraka2:edit:social:${profile?.id || "me"}`;
  const [draft, setDraft, clearDraft] = usePersistedForm(key, {
    marital: profile?.marital_status || "", work: profile?.work_status || "", size: String(app?.family_size ?? ""),
  });
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Field label="الحالة الاجتماعية"><Sel value={draft.marital} options={MARITAL} onChange={(marital: string) => setDraft({ ...draft, marital })} /></Field>
        <Field label="عدد أفراد الأسرة">
          <Input type="number" min={1} dir="ltr" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} />
        </Field>
        <Field label="حالة العمل"><Sel value={draft.work} options={WORK} onChange={(work: string) => setDraft({ ...draft, work })} /></Field>
      </div>
      <EditorActions onCancel={() => { clearDraft(); onCancel(); }} busy={busy} onSave={async () => {
        setBusy(true);
        const ok = await onSave(
          { marital_status: draft.marital, work_status: draft.work },
          { family_size: draft.size ? parseInt(draft.size) : app?.family_size },
        );
        if (ok !== false) clearDraft();
        setBusy(false);
      }} />
    </div>
  );
};

const HealthEditor = ({ profile, onSave, onCancel }: any) => {
  const key = `baraka2:edit:health:${profile?.id || "me"}`;
  const [draft, setDraft, clearDraft] = usePersistedForm(key, {
    has: profile?.chronic_diseases || profile?.health_notes || profile?.is_war_injured ? "yes" : "no",
    desc: profile?.chronic_diseases || profile?.health_notes || "",
    injured: profile?.is_war_injured ? "yes" : "no",
    special: profile?.is_special_needs ? "yes" : "no",
  });
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Field label="هل يعاني من حالة صحية؟"><Sel value={draft.has} options={YESNO} onChange={(has: string) => setDraft({ ...draft, has })} /></Field>
        <Field label="مصاب حرب"><Sel value={draft.injured} options={YESNO} onChange={(injured: string) => setDraft({ ...draft, injured })} /></Field>
        <Field label="احتياجات خاصة"><Sel value={draft.special} options={YESNO} onChange={(special: string) => setDraft({ ...draft, special })} /></Field>
      </div>
      <div className="mt-3">
        <Field label="وصف الحالة الصحية">
          <Textarea rows={3} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
            placeholder="اكتب وصف الحالة الصحية أو «لا يوجد»" disabled={draft.has === "no"} />
        </Field>
      </div>
      <EditorActions onCancel={() => { clearDraft(); onCancel(); }} busy={busy} onSave={async () => {
        setBusy(true);
        const ok = await onSave({
          chronic_diseases: draft.has === "yes" ? draft.desc : "",
          is_war_injured: draft.injured === "yes",
          is_special_needs: draft.special === "yes",
        });
        if (ok !== false) clearDraft();
        setBusy(false);
      }} />
    </div>
  );
};

const ResidenceEditor = ({ app, onSave, onCancel }: any) => {
  const key = `baraka2:edit:residence:${app?.id || "new"}`;
  const [a, setA, clearA] = usePersistedForm(key, {
    original_residence: app.original_residence || "",
    original_landmark: app.original_landmark || "",
    prev_housing_status: app.prev_housing_status || "",
    current_governorate: app.current_governorate || "",
    current_housing_type: app.current_housing_type || "",
    current_camp: app.current_camp || "",
    current_landmark: app.current_landmark || "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="المحافظة الأصلية"><Sel value={a.original_residence} options={GOVS} onChange={(v: string) => setA({ ...a, original_residence: v })} /></Field>
        <Field label="أقرب معلم (الأصلي)"><Input value={a.original_landmark} onChange={(e) => setA({ ...a, original_landmark: e.target.value })} /></Field>
        <Field label="حالة السكن السابق"><Sel value={a.prev_housing_status} options={DAMAGE} onChange={(v: string) => setA({ ...a, prev_housing_status: v })} /></Field>
        <Field label="المحافظة الحالية"><Sel value={a.current_governorate} options={GOVS} onChange={(v: string) => setA({ ...a, current_governorate: v })} /></Field>
        <Field label="نوع السكن الحالي"><Sel value={a.current_housing_type} options={HOUSING} onChange={(v: string) => setA({ ...a, current_housing_type: v })} /></Field>
        <Field label="الحي السكني الحالي"><Input value={a.current_camp} onChange={(e) => setA({ ...a, current_camp: e.target.value })} /></Field>
        <Field label="أقرب معلم (الحالي)"><Input value={a.current_landmark} onChange={(e) => setA({ ...a, current_landmark: e.target.value })} /></Field>
      </div>
      <EditorActions onCancel={() => { clearA(); onCancel(); }} busy={busy} onSave={async () => {
        setBusy(true); const ok = await onSave(a); if (ok !== false) clearA(); setBusy(false);
      }} />
    </div>
  );
};

/* ================= members ================= */

const MembersSection = ({ members, head, onAdd, onRemove, onSave }: any) => {
  const [editId, setEditId] = useState<string | null>(() => {
    const found = members.find((m: any) => hasPersistedForm(`baraka2:edit:member:${m.id}:name`) || hasPersistedForm(`baraka2:edit:member:${m.id}:data`));
    return found?.id || null;
  });
  return (
    <Card id="sec-members" className="p-4 sm:p-5 shadow-card border-accent/20 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 border-b border-accent/25 pb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-extrabold text-accent">
          <Users className="h-5 w-5" /> بيانات أفراد الأسرة ({members.length})
        </h2>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> إضافة فرد جديد
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-accent/25 bg-accent-soft/25 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
            <Crown className="h-3 w-3" /> رب الأسرة
          </span>
          <span className="font-bold text-primary">{head?.full_name || "—"}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">{head?.national_id || "—"}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          رب الأسرة فرد من أفراد الأسرة — بياناته في الأعلى ولا تُكرَّر هنا.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-center text-xs">
          <thead>
            <tr className="bg-accent text-accent-foreground">
              {["رقم الهوية", "الاسم الكامل", "صلة القرابة", "تاريخ الميلاد", "الجنس", "حامل / مرضعة", "حالة صحية", "وصف الحالة", "الإجراءات"]
                .map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-muted-foreground">لا يوجد أفراد مسجلون بعد</td></tr>
            )}
            {members.map((m: any, i: number) => (
              <tr key={m.id} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                <td className="px-2 py-2" dir="ltr">{m.national_id || "لا يوجد"}</td>
                <td className="px-2 py-2 font-semibold">{m.full_name || "لا يوجد"}</td>
                <td className="px-2 py-2">{RELATIONS.find((r) => r.v === m.relationship)?.l || "—"}</td>
                <td className="px-2 py-2" dir="ltr">{formatBirthDate(m.birth_date) || "لا يوجد"}</td>
                <td className="px-2 py-2">{GENDERS.find((g) => g.v === m.gender)?.l || "—"}</td>
                <td className="px-2 py-2">
                  {[m.is_pregnant && "حامل", m.is_breastfeeding && "مرضعة"].filter(Boolean).join(" و ") || "لا"}
                </td>
                <td className="px-2 py-2">{m.chronic_diseases || m.is_war_injured || m.is_special_needs ? "نعم" : "لا"}</td>
                <td className="max-w-[200px] truncate px-2 py-2">{m.chronic_diseases || "لا يوجد"}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-accent"
                      onClick={() => setEditId(editId === m.id ? null : m.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => onRemove(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <MemberEditor
          key={editId}
          member={members.find((m: any) => m.id === editId)}
          onCancel={() => setEditId(null)}
          onSave={async (patch: any) => { const ok = await onSave(editId, patch); if (ok) setEditId(null); }}
        />
      )}
    </Card>
  );
};

const MemberEditor = ({ member, onSave, onCancel }: any) => {
  const np = nameParts(member?.full_name);
  const mk = `baraka2:edit:member:${member?.id || "new"}`;
  const [f, setF, clearF] = usePersistedForm(`${mk}:name`, { ...np } as any);
  const [m, setM, clearM] = usePersistedForm(`${mk}:data`, {
    national_id: member?.national_id || "",
    birth_date: member?.birth_date || "",
    gender: member?.gender || "male",
    relationship: member?.relationship || "son",
    is_pregnant: !!member?.is_pregnant,
    is_breastfeeding: !!member?.is_breastfeeding,
    is_war_injured: !!member?.is_war_injured,
    is_special_needs: !!member?.is_special_needs,
    chronic_diseases: member?.chronic_diseases || "",
  } as any);
  const [busy, setBusy] = useState(false);


  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/20 p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-extrabold text-accent">تعديل بيانات الفرد</h3>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="الاسم الأول"><Input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
        <Field label="اسم الأب"><Input value={f.father} onChange={(e) => setF({ ...f, father: e.target.value })} /></Field>
        <Field label="اسم الجد"><Input value={f.grand} onChange={(e) => setF({ ...f, grand: e.target.value })} /></Field>
        <Field label="اسم العائلة"><Input value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })} /></Field>
        <Field label="رقم الهوية">
          <Input dir="ltr" inputMode="numeric" value={m.national_id}
            onChange={(e) => setM({ ...m, national_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
        </Field>
        <Field label="تاريخ الميلاد">
          <Input type="date" dir="ltr" value={m.birth_date || ""} onChange={(e) => setM({ ...m, birth_date: e.target.value })} />
        </Field>
        <Field label="الجنس"><Sel value={m.gender} options={GENDERS} onChange={(v: string) => setM({ ...m, gender: v })} /></Field>
        <Field label="صلة القرابة"><Sel value={m.relationship} options={RELATIONS} onChange={(v: string) => setM({ ...m, relationship: v })} /></Field>
        <Field label="مصاب حرب"><Sel value={m.is_war_injured ? "yes" : "no"} options={YESNO} onChange={(v: string) => setM({ ...m, is_war_injured: v === "yes" })} /></Field>
        <Field label="احتياجات خاصة"><Sel value={m.is_special_needs ? "yes" : "no"} options={YESNO} onChange={(v: string) => setM({ ...m, is_special_needs: v === "yes" })} /></Field>
      </div>

      {m.gender === "female" && (
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-accent/25 bg-card p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-current" checked={m.is_pregnant}
              onChange={(e) => setM({ ...m, is_pregnant: e.target.checked })} />
            حامل
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={m.is_breastfeeding}
              onChange={(e) => setM({ ...m, is_breastfeeding: e.target.checked })} />
            مرضعة
          </label>
          <span className="text-[11px] text-muted-foreground">يمكن اختيار الحالتين معاً (حامل ومرضعة)</span>
        </div>
      )}

      <div className="mt-3">
        <Field label="وصف الحالة الصحية">
          <Textarea rows={2} value={m.chronic_diseases}
            onChange={(e) => setM({ ...m, chronic_diseases: e.target.value })} placeholder="لا يوجد" />
        </Field>
      </div>

      <EditorActions onCancel={() => { clearF(); clearM(); onCancel(); }} busy={busy} onSave={async () => {
        const full = joinName(f);
        if (!full) { toast.error("اسم الفرد مطلوب"); return; }
        if (!m.national_id) { toast.error("رقم الهوية مطلوب لكل فرد — حتى الأطفال"); return; }
        if (!ID_RE.test(m.national_id)) { toast.error("رقم الهوية يجب أن يكون 9 أرقام"); return; }
        if (!m.birth_date) { toast.error("تاريخ الميلاد مطلوب"); return; }
        setBusy(true);
        const ok = await onSave({
          ...m,
          full_name: full,
          national_id: m.national_id,
          is_pregnant: m.gender === "female" ? m.is_pregnant : false,
          is_breastfeeding: m.gender === "female" ? m.is_breastfeeding : false,
        });
        if (ok !== false) { clearF(); clearM(); }
        setBusy(false);
      }} />

    </div>
  );
};

/* ================= complaints ================= */

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار", in_progress: "قيد المعالجة", resolved: "تم الحل", rejected: "مرفوضة",
};

const ComplaintsSection = ({ complaints, profile, adminMode, onReload }: any) => {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("resolved");

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("العنوان ونص الشكوى مطلوبان"); return; }
    setBusy(true);
    const { error } = await supabase.from("complaints").insert({
      user_id: profile.id, national_id: profile.national_id || null, title, body,
    } as any);
    setBusy(false);
    if (error) { toast.error(error.message || "تعذّر الإرسال"); return; }
    setTitle(""); setBody(""); setAdding(false);
    toast.success("تم إرسال الشكوى");
    await onReload();
  };

  const saveReply = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("complaints")
      .update({ reply, status, updated_at: new Date().toISOString() } as any).eq("id", id);
    setBusy(false);
    if (error) { toast.error("تعذّر حفظ الرد"); return; }
    setReplyId(null); setReply("");
    toast.success("تم حفظ الرد");
    await onReload();
  };

  const removeComplaint = async (id: string) => {
    const { error } = await supabase.from("complaints").delete().eq("id", id);
    if (error) { toast.error("تعذّر الحذف"); return; }
    toast.success("تم حذف الشكوى");
    await onReload();
  };

  return (
    <Card id="sec-complaints" className="p-4 sm:p-5 shadow-card border-accent/20 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 border-b border-accent/25 pb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-extrabold text-accent">
          <MessageSquareMore className="h-5 w-5" /> قائمة الشكاوى ({complaints.length})
        </h2>
        {!adminMode && (
          adding ? (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setAdding(false)}>
              <X className="h-3.5 w-3.5" /> إغلاق
            </Button>
          ) : (
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> إضافة شكوى جديدة
            </Button>
          )
        )}
      </div>

      {adding && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft/20 p-3">
          <div className="grid gap-3">
            <Field label="عنوان الشكوى"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="نص الشكوى"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          </div>
          <EditorActions onCancel={() => setAdding(false)} onSave={submit} busy={busy} />
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-center text-xs">
          <thead>
            <tr className="bg-accent text-accent-foreground">
              {["رقم الهوية", "عنوان الشكوى", "نص الشكوى", "حالة الشكوى", "الرد", "تاريخ الإنشاء", "الإجراءات"]
                .map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {complaints.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-muted-foreground">لا توجد شكاوى</td></tr>
            )}
            {complaints.map((c: any, i: number) => (
              <tr key={c.id} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                <td className="px-2 py-2" dir="ltr">{c.national_id || "لا يوجد"}</td>
                <td className="max-w-[160px] truncate px-2 py-2 font-semibold">{c.title}</td>
                <td className="max-w-[220px] truncate px-2 py-2">{c.body}</td>
                <td className="px-2 py-2">
                  <span className="inline-block rounded-full bg-warning/25 px-2 py-0.5 font-bold text-warning-foreground">
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </td>
                <td className="max-w-[180px] truncate px-2 py-2 text-muted-foreground">{c.reply || "لم يتم الرد بعد"}</td>
                <td className="px-2 py-2" dir="ltr">{formatDateShort(c.created_at)}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {adminMode && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-accent"
                        onClick={() => { setReplyId(replyId === c.id ? null : c.id); setReply(c.reply || ""); setStatus(c.status || "resolved"); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeComplaint(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adminMode && replyId && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft/20 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="حالة الشكوى">
              <Sel value={status} options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ v, l }))} onChange={setStatus} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="الرد على الشكوى">
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
              </Field>
            </div>
          </div>
          <EditorActions onCancel={() => setReplyId(null)} busy={busy} onSave={() => saveReply(replyId)} />
        </div>
      )}
    </Card>
  );
};

/* ================= menu ================= */

const MENU: { title: string; sub: string; icon: any; children?: { id: string; title: string; sub: string; icon: any }[] }[] = [];

const MenuCard = ({ hasApp, showSettings }: { hasApp: boolean; showSettings: boolean }) => {
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const items = [
    {
      id: "sec-personal", title: "معلومات رب الأسرة", sub: "البيانات الأساسية وتفاصيل السكن والعمل", icon: Crown,
      children: [
        { id: "sec-personal", title: "البيانات الشخصية", sub: "الاسم ورقم الهوية ومعلومات التواصل", icon: IdCard },
        { id: "sec-social", title: "البيانات الاجتماعية والعمل", sub: "الحالة الاجتماعية وتفاصيل الوظيفة", icon: Briefcase },
        { id: "sec-health", title: "الحالة الصحية", sub: "الأمراض المزمنة والحالة الطبية", icon: HeartPulse },
        ...(hasApp ? [{ id: "sec-home", title: "بيانات السكن", sub: "العنوان الحالي وتفاصيل المنطقة", icon: Home }] : []),
      ],
    },
    ...(hasApp ? [{ id: "sec-members", title: "معلومات أفراد الأسرة", sub: "إدارة بيانات الزوجة والأبناء", icon: Users, children: [] }] : []),
    { id: "sec-complaints", title: "الشكاوى", sub: "إرسال ومتابعة الشكاوى والاقتراحات", icon: MessageSquareMore, children: [] },
    ...(showSettings ? [{ id: "sec-settings", title: "الإعدادات", sub: "تغيير كلمة المرور وإدارة الحساب", icon: Settings2, children: [] }] : []),
  ];

  return (
    <Card className="p-4 sm:p-5 shadow-card border-accent/20">
      <h2 className="border-b-2 border-accent pb-2 text-center text-base font-extrabold text-primary">
        <Menu className="me-1 inline h-4 w-4 text-accent" /> القائمة
      </h2>
      <div className="mt-3 space-y-2">
        {items.map((g) => (
          <div key={g.title} className="rounded-xl border-e-4 border-accent bg-accent-soft/25 p-3">
            {g.id === "family-settings" ? <Button asChild variant="ghost" className="h-auto w-full justify-start p-0 text-start hover:bg-transparent">
              <Link to="/family-settings" className="block">
                <div className="flex items-center gap-2 text-sm font-extrabold text-accent"><g.icon className="h-4 w-4" /> {g.title}</div>
                <div className="text-[11px] text-muted-foreground">{g.sub}</div>
              </Link>
            </Button> : <button onClick={() => go(g.id)} className="w-full text-start">
              <div className="flex items-center gap-2 text-sm font-extrabold text-accent">
                <g.icon className="h-4 w-4" /> {g.title}
              </div>
              <div className="text-[11px] text-muted-foreground">{g.sub}</div>
            </button>}
            {!!g.children?.length && (
              <div className="mt-2 space-y-1.5">
                {g.children.map((c) => (
                  <button key={c.title} onClick={() => go(c.id)}
                    className="w-full rounded-lg bg-card/70 px-2.5 py-1.5 text-start transition-colors hover:bg-accent-soft">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <c.icon className="h-3.5 w-3.5 text-accent" /> {c.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{c.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
