import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateAge } from "@/lib/age";
import { prepareUpload } from "@/lib/imageUpload";
import { GraduationCap, FileText, Upload, Eye, Pencil, X, Loader2, Crown, MessageCircle } from "lucide-react";
import { waLink } from "@/lib/contact";

export const EDIT_WHATSAPP = "970595440227";
export const EDIT_WHATSAPP_DISPLAY = "+970 59-544-0227";
export const EDIT_CONTACT_NAME = "عبيدة حمدان";

type Row = {
  kind: "head" | "member";
  id: string;
  name: string;
  age: number;
  docField: "id_card_url" | "birth_certificate_url" | null;
  docLabel: string;
  data: any;
};

const openDoc = async (path: string) => {
  const { data } = await supabase.storage.from("medical-reports").createSignedUrl(path, 600);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  else toast.error("تعذّر فتح الملف");
};

export const DocsStudySection = ({ profile, members, adminMode, onReload }: any) => {
  const rows: Row[] = [];
  if (profile) {
    rows.push({
      kind: "head", id: profile.id, name: profile.full_name, age: calculateAge(profile.birth_date),
      docField: "id_card_url", docLabel: "صورة الهوية (اختياري)", data: profile,
    });
  }
  (members || []).forEach((m: any) => {
    const age = calculateAge(m.birth_date);
    if (age < 5 || age >= 18) {
      rows.push({
        kind: "member", id: m.id, name: m.full_name || "—", age,
        docField: age < 5 ? "birth_certificate_url" : null,
        docLabel: "شهادة الميلاد (اختياري)", data: m,
      });
    }
  });

  return (
    <Card id="sec-docs" className="p-4 sm:p-5 shadow-card border-accent/20 scroll-mt-24">
      <h2 className="inline-flex items-center gap-2 border-b border-accent/25 pb-3 w-full text-base font-extrabold text-accent">
        <GraduationCap className="h-5 w-5" /> المستندات والدراسة الجامعية
      </h2>
      {!adminMode && (
        <a href={waLink(EDIT_WHATSAPP, "مرحباً، أرغب بطلب تعديل بيانات أسرتي")} target="_blank" rel="noreferrer"
          className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft/30 p-2.5 text-xs font-semibold text-primary">
          <MessageCircle className="h-4 w-4 text-accent shrink-0" />
          التعديل على هذا القسم من الإدارة فقط — للطلب تواصل واتساب مع {EDIT_CONTACT_NAME} <span dir="ltr">{EDIT_WHATSAPP_DISPLAY}</span>
        </a>
      )}
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد</p>}
        {rows.map((r) => <RowItem key={r.kind + r.id} row={r} adminMode={adminMode} onReload={onReload} />)}
      </div>
    </Card>
  );
};

const RowItem = ({ row, adminMode, onReload }: { row: Row; adminMode: boolean; onReload: () => any }) => {
  const d = row.data;
  const isAdult = row.age >= 18;
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState({
    is_university_student: !!d.is_university_student,
    university_major: d.university_major || "",
    university_name: d.university_name || "",
    university_year: d.university_year || "",
  });

  const save = async (patch: Record<string, any>) => {
    setBusy(true);
    const { error } = row.kind === "head"
      ? await supabase.rpc("admin_update_head_extra" as any, { _user_id: row.id, _patch: patch } as any)
      : await supabase.from("family_members").update(patch as any).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message || "تعذّر الحفظ"); return false; }
    toast.success("تم الحفظ");
    await onReload();
    return true;
  };

  const upload = async (file?: File) => {
    if (!file || !row.docField) return;
    setBusy(true);
    try {
      const p = await prepareUpload(file);
      const ext = p.file.type === "application/pdf" ? "pdf" : "jpg";
      const owner = row.kind === "head" ? row.id : (d.user_id || row.id);
      const path = `${owner}/${Date.now()}-${row.docField}.${ext}`;
      const { error } = await supabase.storage.from("medical-reports").upload(path, p.file, { upsert: true, contentType: p.file.type });
      if (error) throw error;
      setBusy(false);
      await save({ [row.docField]: path });
    } catch (e: any) {
      setBusy(false);
      toast.error(e?.message === "invalid_file_type" ? "نوع الملف غير مدعوم" : "تعذّر رفع الملف");
    }
  };

  const docPath = row.docField ? d[row.docField] : null;

  return (
    <div className="rounded-xl border border-accent/25 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-primary min-w-0">
          {row.kind === "head" && <Crown className="h-4 w-4 text-accent shrink-0" />}
          <span className="truncate">{row.name}</span>
          <span className="text-xs text-muted-foreground">({row.age} سنة)</span>
        </div>
        {adminMode && isAdult && (
          <Button size="sm" variant={edit ? "outline" : "default"} className="h-8 gap-1 text-xs" onClick={() => setEdit(!edit)}>
            {edit ? <><X className="h-3.5 w-3.5" /> إغلاق</> : <><Pencil className="h-3.5 w-3.5" /> تعديل الدراسة</>}
          </Button>
        )}
      </div>

      {row.docField && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <FileText className="h-4 w-4 text-accent" />
          <span className="font-semibold">{row.docLabel}:</span>
          {docPath ? (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openDoc(docPath)}>
              <Eye className="h-3.5 w-3.5" /> عرض
            </Button>
          ) : <span className="text-muted-foreground">لم يُرفع</span>}
          {adminMode && (
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-accent px-2 font-semibold text-accent-foreground">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {docPath ? "استبدال" : "رفع"}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          )}
        </div>
      )}

      {isAdult && !edit && (
        <div className="mt-2 text-xs">
          <span className="font-semibold">طالب جامعي: </span>
          {d.is_university_student
            ? <span>نعم — {d.university_major || "لا يوجد"} · {d.university_name || "لا يوجد"} · السنة {d.university_year || "لا يوجد"}</span>
            : <span>لا</span>}
        </div>
      )}

      {isAdult && edit && adminMode && (
        <div className="mt-3 space-y-3 rounded-lg border border-accent/25 bg-accent-soft/20 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={s.is_university_student}
              onChange={(e) => setS({ ...s, is_university_student: e.target.checked })} />
            هل هو طالب جامعي؟
          </label>
          {s.is_university_student && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="التخصص" value={s.university_major} onChange={(e) => setS({ ...s, university_major: e.target.value.slice(0, 100) })} />
              <Input placeholder="اسم الجامعة" value={s.university_name} onChange={(e) => setS({ ...s, university_name: e.target.value.slice(0, 100) })} />
              <Input placeholder="السنة الدراسية" value={s.university_year} onChange={(e) => setS({ ...s, university_year: e.target.value.slice(0, 30) })} />
            </div>
          )}
          <Button size="sm" disabled={busy} onClick={async () => {
            if (s.is_university_student && (!s.university_major.trim() || !s.university_name.trim() || !s.university_year.trim())) {
              toast.error("أكمل التخصص واسم الجامعة والسنة الدراسية"); return;
            }
            const patch = s.is_university_student ? s : { is_university_student: false, university_major: "", university_name: "", university_year: "" };
            if (await save(patch)) setEdit(false);
          }}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ
          </Button>
        </div>
      )}
    </div>
  );
};
