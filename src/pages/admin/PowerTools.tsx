import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Copy, Trash2, AlertTriangle, Save, MessageSquare, Send, Wand2, ChevronDown, ChevronUp, UserX, ShieldAlert } from "lucide-react";

const PowerTools = () => {
  const { user, canReview, isAdmin } = useAuth();
  const confirmAsk = useConfirm();
  const [dups, setDups] = useState<any[]>([]);
  const [loadingDups, setLoadingDups] = useState(false);
  const [expandedNid, setExpandedNid] = useState<string | null>(null);
  const [occ, setOcc] = useState<any[]>([]);
  const [occBusy, setOccBusy] = useState(false);

  // Bulk status
  const [bulkIds, setBulkIds] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"approved" | "rejected" | "pending">("approved");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Saved filters
  const [filters, setFilters] = useState<any[]>([]);
  const [filterName, setFilterName] = useState("");
  const [filterPayload, setFilterPayload] = useState('{"status":"pending"}');

  // Comments browser
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  const loadDuplicates = async () => {
    setLoadingDups(true);
    const { data, error } = await supabase.rpc("find_duplicate_persons");
    setLoadingDups(false);
    if (error) { toast.error(error.message); return; }
    setDups((data as any[]) || []);
  };

  const toggleOccurrences = async (nid: string) => {
    if (expandedNid === nid) { setExpandedNid(null); setOcc([]); return; }
    setExpandedNid(nid);
    setOcc([]);
    setOccBusy(true);
    const { data, error } = await supabase.rpc("admin_duplicate_occurrences", { _nid: nid });
    setOccBusy(false);
    if (error) { toast.error(error.message); return; }
    setOcc((data as any[]) || []);
  };

  const deleteOccurrence = async (o: any, nid: string) => {
    if (o.kind === "head") {
      toast.error("لا يمكن حذف رب الأسرة من هنا", {
        description: "رب الأسرة لا يمكن أن يتكرر. لمعالجة حساب رب أسرة مكرّر استخدم إدارة الحسابات أو احذف الحساب بالكامل.",
        duration: 7000,
      });
      return;
    }
    if (!(await confirmAsk({
      title: "حذف الفرد المكرّر",
      description: `سيُحذف «${o.full_name}» من أسرة «${o.head_name || "—"}» وسيُنقص عدد أفراد تلك الأسرة تلقائياً. سيبقى مسجلاً في الأسرة الأخرى. متابعة؟`,
      confirmText: "حذف من هذه الأسرة",
      variant: "danger",
    }))) return;
    const { error } = await supabase.rpc("admin_remove_family_member", { _member_id: o.member_id });
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الفرد وتحديث عدد أفراد الأسرة");
    await toggleOccurrences(nid); // refresh
    setExpandedNid(nid);
    setOccBusy(true);
    const { data } = await supabase.rpc("admin_duplicate_occurrences", { _nid: nid });
    setOccBusy(false);
    setOcc((data as any[]) || []);
    loadDuplicates();
  };

  const loadFilters = async () => {
    const { data } = await supabase.from("saved_filters").select("*").order("created_at", { ascending: false });
    setFilters((data as any[]) || []);
  };

  const loadRecentApps = async () => {
    const { data } = await supabase.from("applications").select("id, status, submitted_at, user_id").order("submitted_at", { ascending: false }).limit(50);
    const ids = (data || []).map((a: any) => a.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, full_name, national_id").in("id", ids);
    const pmap: Record<string, any> = {}; (profs || []).forEach((p: any) => pmap[p.id] = p);
    setRecentApps((data || []).map((a: any) => ({ ...a, profile: pmap[a.user_id] })));
  };

  const loadComments = async (appId: string) => {
    setActiveApp(appId);
    const { data } = await supabase.from("application_comments").select("*").eq("application_id", appId).order("created_at", { ascending: true });
    setComments((data as any[]) || []);
  };

  const addComment = async () => {
    if (!activeApp || !newComment.trim() || !user) return;
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const { error } = await supabase.from("application_comments").insert({
      application_id: activeApp, author_id: user.id,
      author_name: (prof as any)?.full_name || null, body: newComment.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    loadComments(activeApp);
  };

  useEffect(() => { if (isAdmin) { loadDuplicates(); loadFilters(); loadRecentApps(); } }, [isAdmin]);

  const runBulk = async () => {
    const ids = bulkIds.split(/[\s,]+/).filter(Boolean);
    if (!ids.length) { toast.error("أدخل معرّفات الطلبات"); return; }
    setBulkBusy(true);
    const { data, error } = await supabase.rpc("bulk_update_application_status", {
      _ids: ids, _status: bulkStatus, _reason: bulkReason || null,
    });
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم تحديث ${data} طلب`);
    setBulkIds("");
  };

  const saveFilter = async () => {
    if (!filterName.trim() || !user) return;
    let payload: any = {};
    try { payload = JSON.parse(filterPayload); } catch { toast.error("صيغة JSON غير صحيحة"); return; }
    const { error } = await supabase.from("saved_filters").insert({
      user_id: user.id, name: filterName.trim(), payload, scope: "applications",
    });
    if (error) { toast.error(error.message); return; }
    setFilterName(""); loadFilters(); toast.success("تم حفظ الفلتر");
  };

  const deleteFilter = async (id: string) => {
    await supabase.from("saved_filters").delete().eq("id", id);
    loadFilters();
  };

  return (
    <AdminLayout title="أدوات متقدمة">
      <div className="container py-6 max-w-7xl">
        <Tabs defaultValue="duplicates" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-4">
            <TabsTrigger value="duplicates"><AlertTriangle className="h-4 w-4 ml-1" />التكرارات</TabsTrigger>
            <TabsTrigger value="bulk"><Wand2 className="h-4 w-4 ml-1" />عمليات جماعية</TabsTrigger>
            <TabsTrigger value="filters"><Save className="h-4 w-4 ml-1" />فلاتر محفوظة</TabsTrigger>
            <TabsTrigger value="comments"><MessageSquare className="h-4 w-4 ml-1" />تعليقات الطلبات</TabsTrigger>
          </TabsList>

          {/* Duplicates */}
          <TabsContent value="duplicates">
            <Card className="p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-primary">كشف الأشخاص المكرّرين</h3>
                <Button size="sm" variant="outline" onClick={loadDuplicates} disabled={loadingDups}>
                  {loadingDups ? "جارٍ..." : "إعادة الفحص"}
                </Button>
              </div>
              {dups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">لا توجد تكرارات 🎉</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>النوع</TableHead><TableHead>القيمة</TableHead>
                    <TableHead>التكرار</TableHead><TableHead>الأسماء</TableHead>
                    <TableHead>الطلبات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {dups.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant={d.match_kind === "national_id" ? "destructive" : "secondary"}>
                          {d.match_kind === "national_id" ? "هوية" : "اسم+ميلاد"}
                        </Badge></TableCell>
                        <TableCell className="font-mono text-xs">{d.match_value}</TableCell>
                        <TableCell><Badge>{d.occurrences}</Badge></TableCell>
                        <TableCell className="text-xs">{(d.person_names || []).join("، ")}</TableCell>
                        <TableCell className="text-xs">
                          <Button size="sm" variant="ghost" onClick={() => {
                            navigator.clipboard.writeText((d.application_ids || []).join(","));
                            toast.success("تم نسخ المعرّفات");
                          }}><Copy className="h-3 w-3 ml-1" />نسخ</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Bulk */}
          <TabsContent value="bulk">
            <Card className="p-4 shadow-card space-y-3">
              <h3 className="font-bold text-primary">تحديث جماعي لحالة الطلبات</h3>
              <div>
                <Label>معرّفات الطلبات (مفصولة بفواصل أو أسطر)</Label>
                <Textarea rows={4} value={bulkIds} onChange={(e) => setBulkIds(e.target.value)} className="font-mono text-xs"
                  placeholder="uuid1, uuid2, ..." />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>الحالة الجديدة</Label>
                  <Select value={bulkStatus} onValueChange={(v: any) => setBulkStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">قبول</SelectItem>
                      <SelectItem value="rejected">رفض</SelectItem>
                      <SelectItem value="pending">إعادة للمراجعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {bulkStatus === "rejected" && (
                  <div>
                    <Label>سبب الرفض</Label>
                    <Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
                  </div>
                )}
              </div>
              <Button onClick={runBulk} disabled={!canReview || bulkBusy} className="w-full">
                {bulkBusy ? "جارٍ التنفيذ..." : "تنفيذ"}
              </Button>
              {!canReview && <p className="text-xs text-destructive">لا تملك صلاحية المراجعة</p>}
            </Card>
          </TabsContent>

          {/* Saved filters */}
          <TabsContent value="filters">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 shadow-card space-y-3">
                <h3 className="font-bold text-primary">حفظ فلتر جديد</h3>
                <div>
                  <Label>اسم الفلتر</Label>
                  <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="مثلاً: قيد المراجعة - عائلات شهداء" />
                </div>
                <div>
                  <Label>محتوى الفلتر (JSON)</Label>
                  <Textarea rows={6} value={filterPayload} onChange={(e) => setFilterPayload(e.target.value)} className="font-mono text-xs" />
                </div>
                <Button onClick={saveFilter} className="w-full"><Save className="h-4 w-4 ml-1" />حفظ</Button>
              </Card>
              <Card className="p-4 shadow-card">
                <h3 className="font-bold text-primary mb-3">فلاتري المحفوظة</h3>
                {filters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا فلاتر بعد</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f) => (
                      <div key={f.id} className="flex items-center justify-between border rounded-lg p-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm">{f.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">{JSON.stringify(f.payload)}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => deleteFilter(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-3 shadow-card md:col-span-1 max-h-[600px] overflow-auto">
                <h3 className="font-bold text-primary mb-2">آخر 50 طلب</h3>
                {recentApps.map((a) => (
                  <button key={a.id} onClick={() => loadComments(a.id)}
                    className={`w-full text-right p-2 rounded-lg border mb-1 hover:bg-muted ${activeApp === a.id ? "bg-accent/15 border-accent" : ""}`}>
                    <div className="text-sm font-bold truncate">{a.profile?.full_name || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{a.profile?.national_id} • {a.status}</div>
                  </button>
                ))}
              </Card>
              <Card className="p-4 shadow-card md:col-span-2">
                {!activeApp ? (
                  <p className="text-sm text-muted-foreground text-center py-10">اختر طلباً لعرض التعليقات الداخلية</p>
                ) : (
                  <>
                    <h3 className="font-bold text-primary mb-3">التعليقات الداخلية</h3>
                    <div className="space-y-2 max-h-[400px] overflow-auto mb-3">
                      {comments.length === 0 && <p className="text-xs text-muted-foreground">لا تعليقات بعد</p>}
                      {comments.map((c) => (
                        <div key={c.id} className="border rounded-lg p-2 bg-muted/30">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-primary">{c.author_name || "مشرف"}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Textarea rows={2} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="اكتب تعليقاً داخلياً..." />
                      <Button onClick={addComment} disabled={!canReview || !newComment.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    {!canReview && <p className="text-xs text-destructive mt-2">لا تملك صلاحية إضافة تعليق</p>}
                  </>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default PowerTools;
