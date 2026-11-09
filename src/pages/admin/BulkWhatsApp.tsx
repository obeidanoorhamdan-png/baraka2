import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { fetchDataset, type Dataset } from "@/lib/excelExport";

/** يحوّل رقم الجوال المحلي إلى صيغة دولية (970). */
export function toIntl(phone?: string | null): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("970") || d.startsWith("972")) return d;
  return "970" + d.replace(/^0/, "").slice(-9);
}

export default function BulkWhatsApp() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [status, setStatus] = useState("approved");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("السلام عليكم {الاسم}،\nإدارة مخيم بركة 2 تُعلمكم بـ ...");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => { fetchDataset().then(setDs); }, []);

  const list = useMemo(() => {
    if (!ds) return [];
    const p = new Map(ds.profiles.map((x) => [x.id, x]));
    return ds.apps.filter((a) => status === "all" || a.status === status).map((a) => {
      const h: any = p.get(a.user_id) || {};
      return { id: a.id, no: a.family_no, name: h.full_name || "—", phone: toIntl(h.phone) };
    }).filter((r) => !q || r.name.includes(q) || String(r.no ?? "").includes(q))
      .sort((a, b) => (a.no ?? 1e9) - (b.no ?? 1e9));
  }, [ds, status, q]);

  const targets = list.filter((r) => picked.has(r.id) && r.phone);
  const open = (r: (typeof list)[number]) => {
    const text = msg.replace(/\{الاسم\}/g, r.name).replace(/\{رقم_الأسرة\}/g, String(r.no ?? ""));
    window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setSent((s) => new Set(s).add(r.id));
  };
  const next = targets.find((r) => !sent.has(r.id));

  return (
    <AdminLayout title="رسائل واتساب جماعية">
      <div className="space-y-4 p-3 md:p-6">
        <Card className="shadow-card"><CardContent className="space-y-3 pt-5">
          <div className="flex items-center gap-2 font-extrabold"><MessageCircle className="h-5 w-5 text-success" /> نص الرسالة</div>
          <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="text-xs text-muted-foreground">يمكنك استخدام {"{الاسم}"} و{"{رقم_الأسرة}"} ليُستبدلا تلقائياً لكل أسرة.</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!next || !msg.trim()} onClick={() => next && open(next)} className="gap-2 font-bold">
              <Send className="h-4 w-4" /> إرسال للتالي {next ? `(${next.name})` : ""}
            </Button>
            <span className="text-sm text-muted-foreground">أُرسل {targets.filter((t) => sent.has(t.id)).length} من {targets.length}</span>
          </div>
        </CardContent></Card>

        <Card className="shadow-card"><CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">المقبولة</SelectItem><SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="rejected">المرفوضة</SelectItem><SelectItem value="all">الكل</SelectItem>
              </SelectContent>
            </Select>
            <Input className="flex-1 min-w-40" placeholder="بحث بالاسم أو رقم الأسرة" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="outline" onClick={() => setPicked(new Set(list.filter((r) => r.phone).map((r) => r.id)))}>تحديد الكل</Button>
            <Button variant="ghost" onClick={() => setPicked(new Set())}>إلغاء</Button>
          </div>
          {!ds ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : (
            <div className="max-h-[55vh] divide-y overflow-y-auto rounded-2xl border">
              {list.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox disabled={!r.phone} checked={picked.has(r.id)} onCheckedChange={(c) => setPicked((s) => { const n = new Set(s); c ? n.add(r.id) : n.delete(r.id); return n; })} />
                  <span className="w-10 text-xs text-muted-foreground">{r.no ?? "—"}</span>
                  <span className="flex-1 text-sm font-semibold">{r.name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">{r.phone ? `+${r.phone}` : "لا يوجد رقم"}</span>
                  {sent.has(r.id) ? <CheckCircle2 className="h-4 w-4 text-success" /> : r.phone && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.preventDefault(); open(r); }}>إرسال</Button>
                  )}
                </label>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>
    </AdminLayout>
  );
}
