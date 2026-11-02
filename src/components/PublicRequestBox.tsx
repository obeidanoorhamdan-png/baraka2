import { useState } from "react";
import { MessageSquareWarning, LifeBuoy, Send, Search, CheckCircle2, Clock, XCircle, Loader2, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatDate";

const CATEGORIES = {
  complaint: ["سوء معاملة", "مشكلة في البيانات", "خدمات المخيم", "النظافة والصرف", "أخرى"],
  help: ["مساعدة طبية", "مستلزمات أطفال", "خيمة / مأوى", "مياه وغذاء", "أخرى"],
};

export const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "قيد الانتظار", cls: "bg-accent/15 text-accent-foreground border-accent/30", icon: Clock },
  in_progress: { label: "قيد المعالجة", cls: "bg-primary/10 text-primary border-primary/30", icon: Loader2 },
  accepted: { label: "مقبول", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  rejected: { label: "مرفوض", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

export const PublicRequestBox = () => {
  const [tab, setTab] = useState<"new" | "track">("new");
  const [kind, setKind] = useState<"complaint" | "help">("complaint");
  const [nid, setNid] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ticket_no: string; head_name: string } | null>(null);
  const [tracked, setTracked] = useState<any[] | null>(null);

  const validNid = /^\d{9}$/.test(nid);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validNid) return toast.error("رقم الهوية يجب أن يكون 9 أرقام");
    if (subject.trim().length < 3) return toast.error("اكتب عنواناً واضحاً");
    if (body.trim().length < 10) return toast.error("اكتب التفاصيل (10 أحرف على الأقل)");
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("submit_public_request", {
      _nid: nid, _kind: kind, _category: category || null, _priority: priority,
      _subject: subject, _body: body, _phone: phone || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDone(data as any);
    setSubject(""); setBody(""); setCategory(""); setPriority("normal");
  };

  const track = async () => {
    if (!validNid) return toast.error("رقم الهوية يجب أن يكون 9 أرقام");
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("track_public_requests", { _nid: nid });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTracked(data || []);
  };

  return (
    <section className="container py-10 md:py-14">
      <Card className="overflow-hidden shadow-elegant border-primary/10">
        <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent/20 grid place-items-center"><LifeBuoy className="h-6 w-6 text-accent" /></div>
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold">تقديم شكوى أو طلب مساعدة</h2>
              <p className="text-sm opacity-85 mt-1">أدخل رقم الهوية واكتب طلبك، وستقوم إدارة المخيم بمراجعته والرد عليك.</p>
            </div>
          </div>
          <div className="mt-5 inline-flex rounded-xl bg-background/10 p-1">
            {(["new", "track"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setTab(k); setDone(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === k ? "bg-background text-primary shadow" : "opacity-85 hover:opacity-100"}`}>
                {k === "new" ? "طلب جديد" : "متابعة طلباتي"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          {tab === "new" && done && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
              <h3 className="text-xl font-bold">تم استلام طلبك بنجاح</h3>
              <p className="text-muted-foreground">رب الأسرة: {done.head_name}</p>
              <div className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-accent px-5 py-3 text-lg font-mono font-bold" dir="ltr">
                <Ticket className="h-5 w-5 text-accent" /> {done.ticket_no}
              </div>
              <p className="text-sm text-muted-foreground">احتفظ برقم التذكرة، ويمكنك متابعة الرد من «متابعة طلباتي».</p>
              <Button variant="outline" onClick={() => setDone(null)}>إرسال طلب آخر</Button>
            </div>
          )}

          {tab === "new" && !done && (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {([["complaint", "شكوى", MessageSquareWarning], ["help", "طلب مساعدة", LifeBuoy]] as const).map(([k, l, I]) => (
                  <button key={k} type="button" onClick={() => { setKind(k); setCategory(""); }}
                    className={`rounded-2xl border-2 p-4 flex items-center gap-3 transition ${kind === k ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}`}>
                    <I className={`h-6 w-6 ${kind === k ? "text-accent" : "text-muted-foreground"}`} />
                    <span className="font-bold">{l}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>رقم الهوية *</Label>
                  <Input dir="ltr" inputMode="numeric" maxLength={9} value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, ""))} placeholder="9 أرقام" />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم تواصل (اختياري)</Label>
                  <Input dir="ltr" inputMode="tel" maxLength={15} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="059xxxxxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label>التصنيف</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>{CATEGORIES[kind].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الأولوية</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="normal">عادية</SelectItem><SelectItem value="urgent">عاجلة</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>العنوان *</Label>
                <Input maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={kind === "complaint" ? "موضوع الشكوى" : "ما الذي تحتاجه؟"} />
              </div>
              <div className="space-y-1.5">
                <Label>التفاصيل *</Label>
                <Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="اشرح بالتفصيل..." />
                <div className="text-xs text-muted-foreground text-left">{body.length}/2000</div>
              </div>
              <Button type="submit" size="lg" disabled={busy} className="w-full md:w-auto gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال إلى إدارة المخيم
              </Button>
            </form>
          )}

          {tab === "track" && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <Input dir="ltr" inputMode="numeric" maxLength={9} value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, ""))} placeholder="رقم الهوية (9 أرقام)" />
                <Button onClick={track} disabled={busy} className="gap-2"><Search className="h-4 w-4" /> بحث</Button>
              </div>
              {tracked && tracked.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد طلبات لهذا الرقم.</p>}
              <div className="space-y-3">
                {tracked?.map((r) => {
                  const m = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <div key={r.ticket_no} className="rounded-xl border p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold">{r.subject}</div>
                        <Badge variant="outline" className={`gap-1 ${m.cls}`}><m.icon className="h-3 w-3" />{m.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        <span dir="ltr" className="font-mono">{r.ticket_no}</span>
                        <span>{r.kind === "help" ? "طلب مساعدة" : "شكوى"}</span>
                        <span>{formatDateShort(r.created_at)}</span>
                      </div>
                      {r.admin_reply && <div className="rounded-lg bg-muted p-3 text-sm"><span className="font-semibold text-primary">رد الإدارة: </span>{r.admin_reply}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
};
