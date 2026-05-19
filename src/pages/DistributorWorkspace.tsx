import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Truck, Search, CheckCircle2, Users, PackageCheck, ClipboardList,
  PlusCircle, LogOut, RefreshCw, AlertCircle, FileSpreadsheet,
} from "lucide-react";
import { exportFamiliesAll } from "@/lib/excelExport";

type Campaign = {
  id: string;
  title: string;
  aid_type: string | null;
  contents: string | null;
  scheduled_date: string;
  target_camp: string | null;
  quota: number;
  is_active: boolean;
};

type Recipient = {
  id: string;
  campaign_id: string;
  application_id: string;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by_name: string | null;
  received_by_name: string | null;
  received_by_relation: string | null;
  notes: string | null;
};

type FamilyHit = {
  application_id: string;
  head_name: string;
  head_national_id: string;
  current_camp: string;
  family_size: number;
  status: string;
};

export default function DistributorWorkspace() {
  const navigate = useNavigate();
  const { user, canDistribute, loading } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchNid, setSearchNid] = useState("");
  const [searchHits, setSearchHits] = useState<FamilyHit[]>([]);
  const [activeFamily, setActiveFamily] = useState<FamilyHit | null>(null);
  const [receivedByName, setReceivedByName] = useState("");
  const [receivedByRelation, setReceivedByRelation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [supTitle, setSupTitle] = useState("");
  const [supName, setSupName] = useState("");
  const [supNid, setSupNid] = useState("");
  const [supReason, setSupReason] = useState("");
  const [myName, setMyName] = useState("");

  useEffect(() => {
    if (!loading && (!user || !canDistribute)) navigate("/distributor-login", { replace: true });
  }, [user, canDistribute, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setMyName((data as any)?.full_name || "المندوب"));
  }, [user]);

  // Load campaigns
  const loadCampaigns = async () => {
    const { data } = await supabase.from("aid_campaigns").select("*")
      .eq("is_active", true).order("scheduled_date", { ascending: false });
    setCampaigns((data || []) as Campaign[]);
    if (data && data.length && !selectedCampaign) setSelectedCampaign(data[0] as Campaign);
  };
  useEffect(() => { if (canDistribute) loadCampaigns(); }, [canDistribute]);

  // Load recipients for selected campaign + realtime subscription
  useEffect(() => {
    if (!selectedCampaign) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("aid_campaign_recipients")
        .select("*").eq("campaign_id", selectedCampaign.id)
        .order("delivered_at", { ascending: false });
      if (active) setRecipients((data || []) as Recipient[]);
    };
    load();
    const ch = supabase.channel(`recipients-${selectedCampaign.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "aid_campaign_recipients",
          filter: `campaign_id=eq.${selectedCampaign.id}` },
        (payload) => {
          setRecipients((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some(r => r.id === (payload.new as any).id)) return prev;
              return [payload.new as Recipient, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map(r => r.id === (payload.new as any).id ? (payload.new as Recipient) : r);
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(r => r.id !== (payload.old as any).id);
            }
            return prev;
          });
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [selectedCampaign]);

  const deliveredCount = useMemo(() => recipients.filter(r => r.delivered).length, [recipients]);
  const remaining = (selectedCampaign?.quota || 0) - deliveredCount;

  // Search family by national_id
  const doSearch = async () => {
    if (!/^\d{5,9}$/.test(searchNid)) {
      toast.error("أدخل رقم هوية صالحاً (5-9 أرقام)");
      return;
    }
    const { data, error } = await supabase.rpc("distributor_lookup_family", { _nid: searchNid });
    if (error) { toast.error(error.message); return; }
    const hits = (data || []) as FamilyHit[];
    setSearchHits(hits);
    if (hits.length === 0) toast.error("لم يتم العثور على أسرة مقبولة بهذا الرقم");
    if (hits.length === 1) selectFamily(hits[0]);
  };

  const selectFamily = (f: FamilyHit) => {
    setActiveFamily(f);
    const existing = recipients.find(r => r.application_id === f.application_id);
    setReceivedByName(existing?.received_by_name || "");
    setReceivedByRelation(existing?.received_by_relation || "");
    setNotes(existing?.notes || "");
  };

  // Auto-save handler — upserts as draft (delivered=false) on field change
  const autoSaveDraft = async () => {
    if (!activeFamily || !selectedCampaign || !user) return;
    if (!receivedByName && !receivedByRelation && !notes) return;
    await supabase.from("aid_campaign_recipients").upsert({
      campaign_id: selectedCampaign.id,
      application_id: activeFamily.application_id,
      received_by_name: receivedByName || null,
      received_by_relation: receivedByRelation || null,
      notes: notes || null,
      delivered_by: user.id,
      delivered_by_name: myName,
      delivered: false,
    }, { onConflict: "campaign_id,application_id" });
  };

  // Auto-save on blur of any input
  useEffect(() => {
    if (!activeFamily) return;
    const t = setTimeout(autoSaveDraft, 600);
    return () => clearTimeout(t);
  }, [receivedByName, receivedByRelation, notes]);

  const markDelivered = async () => {
    if (!activeFamily || !selectedCampaign || !user) return;
    if (!receivedByName.trim()) { toast.error("أدخل اسم من استلم المساعدة"); return; }
    setBusy(true);
    const { error } = await supabase.from("aid_campaign_recipients").upsert({
      campaign_id: selectedCampaign.id,
      application_id: activeFamily.application_id,
      delivered: true,
      delivered_at: new Date().toISOString(),
      delivered_by: user.id,
      delivered_by_name: myName,
      received_by_name: receivedByName.trim(),
      received_by_relation: receivedByRelation.trim() || null,
      notes: notes.trim() || null,
    }, { onConflict: "campaign_id,application_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ تم تسجيل التسليم لـ ${activeFamily.head_name}`);
    setActiveFamily(null);
    setSearchHits([]);
    setSearchNid("");
    setReceivedByName(""); setReceivedByRelation(""); setNotes("");
  };

  const submitSupplement = async () => {
    if (!supTitle.trim() || !supName.trim() || !supReason.trim()) {
      toast.error("املأ جميع الحقول المطلوبة"); return;
    }
    setBusy(true);
    const { error } = await supabase.from("aid_supplement_requests").insert({
      campaign_id: selectedCampaign?.id || null,
      requested_by: user!.id,
      applicant_name: supName.trim(),
      applicant_national_id: supNid.trim() || null,
      reason: `${supTitle.trim()} — ${supReason.trim()}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم رفع الطلب — بانتظار موافقة المسؤول");
    setSupTitle(""); setSupName(""); setSupNid(""); setSupReason("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/distributor-login", { replace: true });
  };

  if (loading) return <Layout><div className="p-10 text-center">...</div></Layout>;

  return (
    <Layout>
      <section className="container py-6 space-y-4">
        {/* Header */}
        <Card className="border-2 border-warning/30 bg-gradient-to-r from-warning/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Truck className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold">واجهة المندوب — توزيع المساعدات</h1>
                <p className="text-xs text-muted-foreground">مرحباً، {myName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadCampaigns} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> تحديث
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 text-destructive">
                <LogOut className="h-3.5 w-3.5" /> خروج
              </Button>
            </div>
          </CardContent>
        </Card>

        {campaigns.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-warning" />
            <p className="font-bold">لا توجد حملات توزيع نشطة حالياً</p>
            <p className="text-xs mt-1">سيتم إعلامك عند إنشاء حملة جديدة من قبل المسؤول</p>
          </Card>
        ) : (
          <>
            {/* Campaign selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-primary" /> اختر الحملة النشطة
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c) => {
                  const isSel = selectedCampaign?.id === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setSelectedCampaign(c)}
                      className={`text-right p-3 rounded-lg border-2 transition-all ${
                        isSel ? "border-primary bg-primary/5 shadow-md" : "border-muted hover:border-primary/40"
                      }`}>
                      <div className="font-bold text-sm">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {c.aid_type || "—"} • {c.target_camp || "كل المخيمات"}
                      </div>
                      <div className="text-[11px] mt-1">
                        <Badge variant="outline" className="text-[10px]">حصة: {c.quota}</Badge>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedCampaign && (
              <Tabs defaultValue="deliver" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="deliver" className="gap-1"><Search className="h-3.5 w-3.5" /> تسجيل التسليم</TabsTrigger>
                  <TabsTrigger value="received" className="gap-1"><Users className="h-3.5 w-3.5" /> من استلم ({deliveredCount}/{selectedCampaign.quota})</TabsTrigger>
                  <TabsTrigger value="supplement" className="gap-1"><PlusCircle className="h-3.5 w-3.5" /> طلب تكميلي</TabsTrigger>
                </TabsList>

                {/* TAB 1: Deliver */}
                <TabsContent value="deliver" className="space-y-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{selectedCampaign.title}</span>
                        <Badge variant={remaining > 0 ? "default" : "destructive"}>
                          متبقي: {Math.max(0, remaining)} من {selectedCampaign.quota}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Input value={searchNid} placeholder="ابحث برقم الهوية..."
                          onChange={(e) => setSearchNid(e.target.value.replace(/\D/g, "").slice(0, 9))}
                          onKeyDown={(e) => e.key === "Enter" && doSearch()} className="flex-1 text-lg font-bold" />
                        <Button onClick={doSearch} className="gap-1"><Search className="h-4 w-4" /> بحث</Button>
                      </div>

                      {searchHits.length > 1 && (
                        <div className="space-y-1">
                          {searchHits.map((h) => (
                            <button key={h.application_id} onClick={() => selectFamily(h)}
                              className="w-full text-right p-2 rounded border hover:bg-muted">
                              <div className="font-bold">{h.head_name}</div>
                              <div className="text-xs text-muted-foreground">{h.head_national_id} • {h.current_camp}</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {activeFamily && (() => {
                        const already = recipients.find(r => r.application_id === activeFamily.application_id && r.delivered);
                        return (
                          <Card className={`border-2 ${already ? "border-success bg-success/5" : "border-primary"}`}>
                            <CardContent className="p-4 space-y-3">
                              {already && (
                                <div className="rounded-md bg-success/10 border border-success/40 p-2 text-sm text-success font-bold flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4" />
                                  استلمت هذه الأسرة سابقاً بواسطة {already.delivered_by_name || "مندوب"} — المستلم: {already.received_by_name}
                                </div>
                              )}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <div className="text-lg font-extrabold">{activeFamily.head_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    هوية: {activeFamily.head_national_id} • مخيم: {activeFamily.current_camp} • عدد الأسرة: {activeFamily.family_size}
                                  </div>
                                </div>
                                <Badge className="bg-success">{activeFamily.status === "approved" ? "مقبولة" : activeFamily.status}</Badge>
                              </div>
                              <div className="grid md:grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">اسم من استلم * </Label>
                                  <Input value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)}
                                    placeholder="الاسم الكامل" />
                                </div>
                                <div>
                                  <Label className="text-xs">صلة قرابته (اختياري)</Label>
                                  <Input value={receivedByRelation} onChange={(e) => setReceivedByRelation(e.target.value)}
                                    placeholder="مثال: ابن، زوجة، جار" />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">ملاحظات</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={markDelivered} disabled={busy} className="flex-1 gap-1 bg-success hover:bg-success/90">
                                  <CheckCircle2 className="h-4 w-4" /> {already ? "تحديث التسليم" : "تأكيد التسليم"}
                                </Button>
                                <Button variant="outline" onClick={() => { setActiveFamily(null); setSearchHits([]); setSearchNid(""); }}>
                                  إلغاء
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">يُحفظ تلقائياً أثناء الكتابة — لا داعي للقلق إن خرجت.</p>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TAB 2: Live list of recipients */}
                <TabsContent value="received">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>قائمة المستلمين — مباشرة (تتحدث تلقائياً)</span>
                        <Badge>{deliveredCount} مستلم</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[500px]">
                        {recipients.filter(r => r.delivered).length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 text-sm">لم يستلم أحد بعد</p>
                        ) : (
                          <div className="space-y-1">
                            {recipients.filter(r => r.delivered).map((r) => (
                              <div key={r.id} className="p-2 border rounded text-sm flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold">{r.received_by_name}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {r.received_by_relation || "—"} • سلّم: {r.delivered_by_name}
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {r.delivered_at ? new Date(r.delivered_at).toLocaleString("ar-EG") : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TAB 3: Supplement request */}
                <TabsContent value="supplement">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> رفع طلب تكميلي (يحتاج موافقة المسؤول)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input value={supTitle} onChange={(e) => setSupTitle(e.target.value)} placeholder="عنوان الطلب *" />
                      <div className="grid md:grid-cols-2 gap-2">
                        <Input value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="اسم المستفيد *" />
                        <Input value={supNid} onChange={(e) => setSupNid(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="رقم الهوية (اختياري)" />
                      </div>
                      <Textarea value={supReason} onChange={(e) => setSupReason(e.target.value)} rows={3} placeholder="سبب الطلب التفصيلي *" />
                      <Button onClick={submitSupplement} disabled={busy} className="gap-1">
                        <PlusCircle className="h-4 w-4" /> رفع للموافقة
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="mt-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" /> طباعة كشف الأسر (Excel)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" onClick={() => exportFamiliesAll().then(() => toast.success("تم التنزيل"))} className="gap-1">
                        <FileSpreadsheet className="h-4 w-4" /> تنزيل كشف الأسر المقبولة
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
