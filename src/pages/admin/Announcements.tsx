import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, Edit2, Eye, EyeOff, Save } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

type A = any;

const KINDS = [
  { v: "general", l: "إعلان عام" },
  { v: "event", l: "فعالية" },
  { v: "meeting", l: "اجتماع" },
  { v: "aid", l: "توزيع مساعدات" },
  { v: "health", l: "حملة صحية" },
];

const SPECIALS = [
  { v: "", l: "— لا تخصيص —" },
  { v: "war_injured", l: "مصابي الحرب" },
  { v: "pregnant", l: "الحوامل" },
  { v: "breastfeeding", l: "المرضعات" },
  { v: "martyr_family", l: "أسر الشهداء" },
  { v: "chronic", l: "أمراض مزمنة" },
  { v: "special_needs", l: "ذوي الاحتياجات الخاصة" },
];

const empty = (): A => ({
  title: "", body: "", kind: "general", organizer: "",
  event_at: "", target_age_min: "", target_age_max: "",
  target_gender: "", target_camp: "", target_special: "", active: true,
});

const AnnouncementsAdmin = () => {
  const [items, setItems] = useState<A[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<A>(empty());
  const [saving, setSaving] = useState(false);
  const confirmAsk = useConfirm();

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(empty()); setOpen(true); };
  const startEdit = (a: A) => {
    setEditing({
      ...a,
      organizer: a.organizer || "",
      event_at: a.event_at ? a.event_at.slice(0, 16) : "",
      target_age_min: a.target_age_min ?? "",
      target_age_max: a.target_age_max ?? "",
      target_gender: a.target_gender || "",
      target_camp: a.target_camp || "",
      target_special: a.target_special || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing.title.trim() || !editing.body.trim()) {
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }
    setSaving(true);
    const payload: any = {
      title: editing.title.trim(),
      body: editing.body.trim(),
      kind: editing.kind || "general",
      organizer: editing.organizer?.trim() || null,
      event_at: editing.event_at ? new Date(editing.event_at).toISOString() : null,
      target_age_min: editing.target_age_min === "" ? null : Number(editing.target_age_min),
      target_age_max: editing.target_age_max === "" ? null : Number(editing.target_age_max),
      target_gender: editing.target_gender || null,
      target_camp: editing.target_camp?.trim() || null,
      target_special: editing.target_special || null,
      active: editing.active,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("announcements").update(payload).eq("id", editing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.created_by = u.user?.id;
      ({ error } = await supabase.from("announcements").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", {
      _action: editing.id ? "announcement.update" : "announcement.create",
      _target_type: "announcement", _target_label: payload.title,
    });
    toast.success(editing.id ? "تم التحديث" : "تم النشر");
    setOpen(false);
    load();
  };

  const remove = async (a: A) => {
    if (!(await confirmAsk({ title: "حذف الإعلان", description: a.title, confirmText: "حذف", variant: "danger" }))) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("log_admin_action", { _action: "announcement.delete", _target_type: "announcement", _target_label: a.title });
    toast.success("تم الحذف");
    load();
  };

  const toggle = async (a: A) => {
    const { error } = await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    if (!error) load();
  };

  return (
    <AdminLayout title="إدارة الإعلانات">
      <div className="container py-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-bold text-primary">الإعلانات</h2>
          </div>
          <Button onClick={startNew} className="brand-gradient text-primary-foreground gap-1.5">
            <Plus className="h-4 w-4" /> إعلان جديد
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">لا توجد إعلانات بعد.</Card>
        ) : (
          <div className="grid gap-3">
            {items.map((a) => (
              <Card key={a.id} className="p-4 shadow-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {a.active ? "نشط" : "موقوف"}
                      </span>
                      {a.organizer && <span className="text-[11px] text-muted-foreground">— {a.organizer}</span>}
                    </div>
                    <h3 className="font-bold text-primary mt-1">{a.title}</h3>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-2">{a.body}</p>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleString("ar")}
                      {a.event_at && <> · موعد: {new Date(a.event_at).toLocaleString("ar")}</>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggle(a)} className="gap-1 h-8">
                      {a.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(a)} className="gap-1 h-8">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(a)} className="gap-1 h-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "تعديل الإعلان" : "إعلان جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>المحتوى *</Label>
              <Textarea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>النوع</Label>
                <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الجهة المنظمة (مثل UNICEF)</Label>
                <Input value={editing.organizer} onChange={(e) => setEditing({ ...editing, organizer: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ ووقت الفعالية (اختياري)</Label>
                <Input type="datetime-local" value={editing.event_at} onChange={(e) => setEditing({ ...editing, event_at: e.target.value })} />
              </div>
              <div>
                <Label>المخيم المستهدف (اختياري)</Label>
                <Input placeholder="Baraka 2" value={editing.target_camp} onChange={(e) => setEditing({ ...editing, target_camp: e.target.value })} />
              </div>
            </div>
            <div className="border-t pt-3">
              <Label className="text-sm font-bold text-primary">فلاتر مركبة (اختيارية)</Label>
              <div className="grid gap-3 md:grid-cols-3 mt-2">
                <div>
                  <Label className="text-xs">العمر من</Label>
                  <Input type="number" value={editing.target_age_min} onChange={(e) => setEditing({ ...editing, target_age_min: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">العمر إلى</Label>
                  <Input type="number" value={editing.target_age_max} onChange={(e) => setEditing({ ...editing, target_age_max: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">الجنس</Label>
                  <Select value={editing.target_gender || "all"} onValueChange={(v) => setEditing({ ...editing, target_gender: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الجميع</SelectItem>
                      <SelectItem value="male">ذكور</SelectItem>
                      <SelectItem value="female">إناث</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">الفئة الخاصة</Label>
                  <Select value={editing.target_special || ""} onValueChange={(v) => setEditing({ ...editing, target_special: v })}>
                    <SelectTrigger><SelectValue placeholder="— لا تخصيص —" /></SelectTrigger>
                    <SelectContent>{SPECIALS.map((s) => <SelectItem key={s.v || "none"} value={s.v || "none"}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              <Label>نشط (مرئي في صفحة الإعلانات العامة)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving} className="brand-gradient text-primary-foreground gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AnnouncementsAdmin;
