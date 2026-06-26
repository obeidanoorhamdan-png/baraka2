import { useEffect, useRef, useState } from "react";
import { Megaphone, Plus, Trash2, Edit2, Eye, EyeOff, Save, Sparkles, Wand2, ImagePlus, Upload, Video, X, Loader2 } from "lucide-react";
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
import { callAnnouncementAI, uploadAnnouncementMedia, dataUrlToBlob } from "@/lib/announcementMedia";

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
  media_url: "", media_type: "", show_popup: false, show_in_strip: true,
});

const AnnouncementsAdmin = () => {
  const [items, setItems] = useState<A[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<A>(empty());
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [imgPrompt, setImgPrompt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmAsk = useConfirm();

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(empty()); setAiPrompt(""); setImgPrompt(""); setOpen(true); };
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
      media_url: a.media_url || "",
      media_type: a.media_type || "",
      show_popup: !!a.show_popup,
      show_in_strip: a.show_in_strip ?? true,
    });
    setAiPrompt(""); setImgPrompt("");
    setOpen(true);
  };

  // ---- AI: write / improve text ----
  const aiWrite = async () => {
    if (!aiPrompt.trim()) { toast.error("اكتب فكرة الإعلان أولاً"); return; }
    setAiBusy("write");
    try {
      const r = await callAnnouncementAI({ action: "write", prompt: aiPrompt.trim() });
      setEditing((e: A) => ({ ...e, title: r.title || e.title, body: r.body || e.body }));
      toast.success("تم إنشاء النص بالذكاء الاصطناعي");
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(null); }
  };
  const aiImprove = async () => {
    if (!editing.title.trim() && !editing.body.trim()) { toast.error("أدخل نصاً لتحسينه"); return; }
    setAiBusy("improve");
    try {
      const r = await callAnnouncementAI({ action: "improve", title: editing.title, text: editing.body });
      setEditing((e: A) => ({ ...e, title: r.title || e.title, body: r.body || e.body }));
      toast.success("تم تحسين النص");
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(null); }
  };

  // ---- AI: generate / edit image ----
  const aiImage = async () => {
    if (!imgPrompt.trim()) { toast.error("اكتب وصف الصورة"); return; }
    setAiBusy("image");
    try {
      const r = await callAnnouncementAI({
        action: "image",
        prompt: imgPrompt.trim(),
        image: editing.media_type === "image" && editing.media_url ? editing.media_url : undefined,
      });
      if (!r.image) throw new Error("تعذّر توليد الصورة");
      const url = await uploadAnnouncementMedia(dataUrlToBlob(r.image), "png");
      setEditing((e: A) => ({ ...e, media_url: url, media_type: "image" }));
      toast.success("تم إنشاء الصورة وحفظها");
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(null); }
  };

  // ---- Manual upload (image or video) ----
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("يُسمح بالصور والفيديو فقط"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("الحجم الأقصى 50 ميجابايت"); return; }
    setAiBusy("upload");
    try {
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "png");
      const url = await uploadAnnouncementMedia(file, ext);
      setEditing((ed: A) => ({ ...ed, media_url: url, media_type: isVideo ? "video" : "image" }));
      toast.success("تم رفع الملف");
    } catch (err: any) { toast.error(err.message); } finally { setAiBusy(null); }
  };

  const clearMedia = () => setEditing((e: A) => ({ ...e, media_url: "", media_type: "" }));

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
      target_special: (editing.target_special && editing.target_special !== "none") ? editing.target_special : null,
      media_url: editing.media_url?.trim() || null,
      media_type: editing.media_url?.trim() ? (editing.media_type || "image") : null,
      show_popup: !!editing.show_popup,
      show_in_strip: !!editing.show_in_strip,
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
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {a.media_url && (
                      <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {a.media_type === "video"
                          ? <Video className="h-6 w-6 text-muted-foreground" />
                          : <img src={a.media_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                          {a.active ? "نشط" : "موقوف"}
                        </span>
                        {a.show_popup && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent/15 text-accent">منبثق</span>}
                        {a.show_in_strip && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">شريط الأخبار</span>}
                        {a.organizer && <span className="text-[11px] text-muted-foreground">— {a.organizer}</span>}
                      </div>
                      <h3 className="font-bold text-primary mt-1">{a.title}</h3>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-2">{a.body}</p>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {new Date(a.created_at).toLocaleString("ar")}
                        {a.event_at && <> · موعد: {new Date(a.event_at).toLocaleString("ar")}</>}
                      </div>
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
          <div className="space-y-4">
            {/* AI assistant */}
            <Card className="p-3 bg-accent-soft/40 border-accent/30 space-y-2">
              <Label className="text-sm font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-accent" /> مساعد الذكاء الاصطناعي (مجاناً)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="اكتب فكرة الإعلان… مثال: توزيع طرود غذائية غداً الساعة 10 صباحاً"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <Button type="button" onClick={aiWrite} disabled={!!aiBusy} className="brand-gradient text-primary-foreground gap-1.5 shrink-0">
                  {aiBusy === "write" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} اكتب
                </Button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={aiImprove} disabled={!!aiBusy} className="gap-1.5">
                {aiBusy === "improve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} حسّن النص الحالي
              </Button>
            </Card>

            <div>
              <Label>العنوان *</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>المحتوى *</Label>
              <Textarea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>

            {/* Media */}
            <Card className="p-3 space-y-3 border-primary/20">
              <Label className="text-sm font-bold text-primary flex items-center gap-1.5">
                <ImagePlus className="h-4 w-4 text-accent" /> الوسائط (صورة / فيديو)
              </Label>

              {editing.media_url ? (
                <div className="relative rounded-lg overflow-hidden bg-black/90 flex items-center justify-center max-h-56">
                  {editing.media_type === "video"
                    ? <video src={editing.media_url} controls className="max-h-56 w-full object-contain" />
                    : <img src={editing.media_url} alt="" className="max-h-56 w-full object-contain" />}
                  <Button type="button" size="icon" variant="destructive" onClick={clearMedia} className="absolute top-2 left-2 h-7 w-7">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">لا توجد وسائط بعد. ارفع ملفاً أو أنشئ صورة بالذكاء الاصطناعي.</p>
              )}

              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!!aiBusy} className="gap-1.5">
                  {aiBusy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} رفع صورة/فيديو
                </Button>
              </div>

              <div className="flex gap-2 pt-1 border-t">
                <Input
                  placeholder={editing.media_type === "image" && editing.media_url
                    ? "صف التعديل على الصورة الحالية…"
                    : "صف الصورة المطلوب إنشاؤها بالذكاء الاصطناعي…"}
                  value={imgPrompt}
                  onChange={(e) => setImgPrompt(e.target.value)}
                />
                <Button type="button" onClick={aiImage} disabled={!!aiBusy} variant="secondary" className="gap-1.5 shrink-0">
                  {aiBusy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {editing.media_type === "image" && editing.media_url ? "تعديل" : "إنشاء صورة"}
                </Button>
              </div>
            </Card>

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
                  <Select value={editing.target_special || "none"} onValueChange={(v) => setEditing({ ...editing, target_special: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="— لا تخصيص —" /></SelectTrigger>
                    <SelectContent>{SPECIALS.map((s) => <SelectItem key={s.v || "none"} value={s.v || "none"}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3￼">
              <div className="flex items-center gap-2">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>نشط (مرئي في صفحة الإعلانات)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.show_in_strip} onCheckedChange={(v) => setEditing({ ...editing, show_in_strip: v })} />
                <Label>عرض في شريط (آخر الأخبار والإعلانات) بالصفحة الرئيسية</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.show_popup} onCheckedChange={(v) => setEditing({ ...editing, show_popup: v })} />
                <Label>عرض كإعلان منبثق في وسط الشاشة لكل الزوّار</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving || !!aiBusy} className="brand-gradient text-primary-foreground gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AnnouncementsAdmin;
