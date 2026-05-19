import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PackagePlus, Trash2, PackageCheck, Users } from "lucide-react";

type Campaign = {
  id: string;
  title: string;
  aid_type: string | null;
  contents: string | null;
  scheduled_date: string;
  target_camp: string | null;
  quota: number;
  is_active: boolean;
  notes: string | null;
};

export default function AdminCampaigns() {
  const { isSuperAdmin, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    title: "", aid_type: "", contents: "", scheduled_date: new Date().toISOString().slice(0, 10),
    target_camp: "Baraka 2", quota: 50, notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const { data } = await supabase.from("aid_campaigns").select("*")
      .order("scheduled_date", { ascending: false });
    setCampaigns((data || []) as Campaign[]);
    // load delivered counts per campaign
    if (data && data.length) {
      const { data: recs } = await supabase.from("aid_campaign_recipients")
        .select("campaign_id").eq("delivered", true);
      const c: Record<string, number> = {};
      (recs || []).forEach((r: any) => { c[r.campaign_id] = (c[r.campaign_id] || 0) + 1; });
      setCounts(c);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || form.quota <= 0) { toast.error("العنوان والحصة مطلوبان"); return; }
    setBusy(true);
    const { error } = await supabase.from("aid_campaigns").insert({
      title: form.title.trim(),
      aid_type: form.aid_type.trim() || null,
      contents: form.contents.trim() || null,
      scheduled_date: form.scheduled_date,
      target_camp: form.target_camp.trim() || null,
      quota: form.quota,
      notes: form.notes.trim() || null,
      created_by: user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الحملة");
    setForm({ ...form, title: "", aid_type: "", contents: "", notes: "" });
    load();
  };

  const toggleActive = async (c: Campaign) => {
    await supabase.from("aid_campaigns").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الحملة؟ سيتم حذف جميع سجلات التسليم أيضاً")) return;
    await supabase.from("aid_campaigns").delete().eq("id", id);
    load();
  };

  if (!isSuperAdmin) return <AdminLayout><div className="p-8 text-center">صلاحية المسؤول مطلوبة</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-extrabold">إدارة حملات التوزيع</h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">إنشاء حملة جديدة</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div><Label>العنوان *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>نوع المساعدة</Label><Input value={form.aid_type} onChange={e => setForm({ ...form, aid_type: e.target.value })} placeholder="طرود غذائية / مالية / ..." /></div>
            <div className="md:col-span-2"><Label>المحتويات</Label><Textarea rows={2} value={form.contents} onChange={e => setForm({ ...form, contents: e.target.value })} /></div>
            <div><Label>التاريخ</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div><Label>المخيم المستهدف</Label><Input value={form.target_camp} onChange={e => setForm({ ...form, target_camp: e.target.value })} /></div>
            <div><Label>الحصة (عدد الأسر) *</Label><Input type="number" min={1} value={form.quota} onChange={e => setForm({ ...form, quota: parseInt(e.target.value || "0") })} /></div>
            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="md:col-span-2">
              <Button onClick={create} disabled={busy} className="gap-1"><PackagePlus className="h-4 w-4" /> إنشاء الحملة</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">الحملات الحالية ({campaigns.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد حملات</p>}
            {campaigns.map(c => (
              <div key={c.id} className="p-3 border rounded-lg flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {c.title}
                    {c.is_active ? <Badge variant="default">نشطة</Badge> : <Badge variant="secondary">موقوفة</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.aid_type || "—"} • {c.target_camp || "كل المخيمات"} • {c.scheduled_date}
                  </div>
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {counts[c.id] || 0} / {c.quota} استلموا
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                    {c.is_active ? "إيقاف" : "تنشيط"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
