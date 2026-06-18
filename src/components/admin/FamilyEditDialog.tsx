import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ID_RE } from "@/lib/validators";
import { Save, UserCog, Home, Users } from "lucide-react";

const GENDERS = [
  { v: "male", l: "ذكر" },
  { v: "female", l: "أنثى" },
];
const MARITAL = [
  { v: "married", l: "متزوج/ة" },
  { v: "single", l: "أعزب/عزباء" },
  { v: "widowed", l: "أرمل/ة" },
  { v: "divorced", l: "مطلق/ة" },
  { v: "other", l: "أخرى" },
];
const RELATIONS = [
  { v: "wife", l: "زوجة" },
  { v: "husband", l: "زوج" },
  { v: "son", l: "ابن" },
  { v: "daughter", l: "ابنة" },
  { v: "father", l: "والد" },
  { v: "mother", l: "والدة" },
  { v: "brother", l: "أخ" },
  { v: "sister", l: "أخت" },
  { v: "other", l: "أخرى" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  app: any | null;
  head: any | null;
  members: any[];
  onSaved: () => void;
}

export const FamilyEditDialog = ({ open, onOpenChange, app, head, members, onSaved }: Props) => {
  const [h, setH] = useState<any>({});
  const [a, setA] = useState<any>({});
  const [m, setM] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setH({ ...(head || {}) });
      setA({ ...(app || {}) });
      setM((members || []).map((x) => ({ ...x })));
    }
  }, [open, head, app, members]);

  const setMember = (i: number, key: string, val: any) =>
    setM((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: val } : x)));

  const save = async () => {
    // Basic validation
    if (!h.full_name?.trim()) { toast.error("اسم رب الأسرة مطلوب"); return; }
    if (h.national_id && !ID_RE.test(h.national_id)) { toast.error("رقم هوية رب الأسرة غير صالح"); return; }
    for (const mem of m) {
      if (mem.national_id && !ID_RE.test(mem.national_id)) {
        toast.error(`رقم هوية «${mem.full_name || "فرد"}» غير صالح`); return;
      }
    }
    setBusy(true);
    try {
      // 1) Head (profile) via SECURITY DEFINER RPC
      const { error: e1 } = await supabase.rpc("admin_update_head", {
        _user_id: head.id,
        _full_name: h.full_name,
        _national_id: h.national_id || null,
        _phone: h.phone || null,
        _alt_phone: h.alt_phone || null,
        _birth_date: h.birth_date || null,
        _gender: h.gender || null,
        _marital_status: h.marital_status || null,
        _chronic_diseases: h.chronic_diseases || null,
      } as any);
      if (e1) throw e1;

      // 2) Application core fields
      const { error: e2 } = await supabase.from("applications").update({
        original_residence: a.original_residence || null,
        original_landmark: a.original_landmark || null,
        current_camp: a.current_camp || null,
        current_landmark: a.current_landmark || null,
        family_size: a.family_size ? parseInt(a.family_size) : null,
        has_martyr: !!a.has_martyr,
        martyr_name: a.has_martyr ? (a.martyr_name || null) : null,
        martyr_relationship: a.has_martyr ? (a.martyr_relationship || null) : null,
      } as any).eq("id", app.id);
      if (e2) throw e2;

      // 3) Family members
      for (const mem of m) {
        const { error: e3 } = await supabase.from("family_members").update({
          full_name: mem.full_name || null,
          national_id: mem.national_id || null,
          birth_date: mem.birth_date || null,
          gender: mem.gender || null,
          relationship: mem.relationship || null,
        } as any).eq("id", mem.id);
        if (e3) throw e3;
      }

      toast.success("تم حفظ تعديلات الأسرة بنجاح");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حفظ التعديلات");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> تعديل بيانات الأسرة
          </DialogTitle>
        </DialogHeader>

        {/* Head of family */}
        <Card className="p-4 space-y-3 bg-accent-soft/30">
          <h3 className="font-bold text-primary flex items-center gap-2 text-sm"><UserCog className="h-4 w-4" /> رب الأسرة</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">الاسم الكامل *</Label>
              <Input value={h.full_name || ""} onChange={(e) => setH({ ...h, full_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">رقم الهوية</Label>
              <Input value={h.national_id || ""} inputMode="numeric"
                onChange={(e) => setH({ ...h, national_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">الجوال</Label>
              <Input value={h.phone || ""} onChange={(e) => setH({ ...h, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">الجوال البديل</Label>
              <Input value={h.alt_phone || ""} onChange={(e) => setH({ ...h, alt_phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">تاريخ الميلاد</Label>
              <Input type="date" value={h.birth_date || ""} onChange={(e) => setH({ ...h, birth_date: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">الجنس</Label>
              <Select value={h.gender || ""} onValueChange={(v) => setH({ ...h, gender: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{GENDERS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الحالة الاجتماعية</Label>
              <Select value={h.marital_status || ""} onValueChange={(v) => setH({ ...h, marital_status: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{MARITAL.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">أمراض مزمنة</Label>
              <Input value={h.chronic_diseases || ""} onChange={(e) => setH({ ...h, chronic_diseases: e.target.value })} />
            </div>
          </div>
        </Card>

        {/* Residence */}
        <Card className="p-4 space-y-3">
          <h3 className="font-bold text-primary flex items-center gap-2 text-sm"><Home className="h-4 w-4" /> السكن والأسرة</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">السكن الأصلي</Label>
              <Input value={a.original_residence || ""} onChange={(e) => setA({ ...a, original_residence: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">أقرب معلم (الأصلي)</Label>
              <Input value={a.original_landmark || ""} onChange={(e) => setA({ ...a, original_landmark: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">المخيم/مكان الإيواء</Label>
              <Input value={a.current_camp || ""} onChange={(e) => setA({ ...a, current_camp: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">المعلم الحالي</Label>
              <Input value={a.current_landmark || ""} onChange={(e) => setA({ ...a, current_landmark: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">عدد الأفراد</Label>
              <Input type="number" min={1} value={a.family_size ?? ""} onChange={(e) => setA({ ...a, family_size: e.target.value })} dir="ltr" />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input id="hasMartyr" type="checkbox" checked={!!a.has_martyr}
                onChange={(e) => setA({ ...a, has_martyr: e.target.checked })} className="h-4 w-4" />
              <Label htmlFor="hasMartyr" className="text-xs">يوجد شهيد في الأسرة</Label>
            </div>
            {a.has_martyr && (
              <>
                <div>
                  <Label className="text-xs">اسم الشهيد</Label>
                  <Input value={a.martyr_name || ""} onChange={(e) => setA({ ...a, martyr_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">صلة القرابة بالشهيد</Label>
                  <Input value={a.martyr_relationship || ""} onChange={(e) => setA({ ...a, martyr_relationship: e.target.value })} />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Members */}
        <Card className="p-4 space-y-3">
          <h3 className="font-bold text-primary flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> أفراد الأسرة ({m.length})</h3>
          {m.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد أفراد مسجلون</p>}
          {m.map((mem, i) => (
            <div key={mem.id} className="rounded-lg border p-3 grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={mem.full_name || ""} onChange={(e) => setMember(i, "full_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">رقم الهوية</Label>
                <Input value={mem.national_id || ""} inputMode="numeric" dir="ltr"
                  onChange={(e) => setMember(i, "national_id", e.target.value.replace(/\D/g, "").slice(0, 9))} />
              </div>
              <div>
                <Label className="text-xs">تاريخ الميلاد</Label>
                <Input type="date" dir="ltr" value={mem.birth_date || ""} onChange={(e) => setMember(i, "birth_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">الجنس</Label>
                <Select value={mem.gender || ""} onValueChange={(v) => setMember(i, "gender", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{GENDERS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">صلة القرابة</Label>
                <Select value={mem.relationship || ""} onValueChange={(v) => setMember(i, "relationship", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{RELATIONS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </Card>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ والرجوع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
