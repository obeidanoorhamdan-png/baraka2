import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Calendar, Users, ExternalLink, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: string;
  organizer: string | null;
  event_at: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  target_gender: string | null;
  target_camp: string | null;
  target_special: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  general: "إعلان عام",
  event: "فعالية",
  meeting: "اجتماع",
  aid: "توزيع مساعدات",
  health: "حملة صحية",
};

const SPECIAL_LABEL: Record<string, string> = {
  war_injured: "مصابي الحرب",
  pregnant: "الحوامل",
  breastfeeding: "المرضعات",
  martyr_family: "أسر الشهداء",
  chronic: "أمراض مزمنة",
  special_needs: "ذوي الاحتياجات الخاصة",
};

const Announcements = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const targetingChips = (a: Announcement) => {
    const chips: string[] = [];
    if (a.target_age_min != null || a.target_age_max != null) {
      chips.push(`الأعمار ${a.target_age_min ?? "—"} - ${a.target_age_max ?? "—"}`);
    }
    if (a.target_gender) chips.push(a.target_gender === "male" ? "ذكور" : "إناث");
    if (a.target_camp) chips.push(a.target_camp);
    if (a.target_special) chips.push(SPECIAL_LABEL[a.target_special] || a.target_special);
    return chips;
  };

  return (
    <Layout>
      <section className="container py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-accent/15 p-3">
            <Megaphone className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl text-primary font-bold">الإعلانات</h1>
            <p className="text-sm text-muted-foreground">آخر الإعلانات والفعاليات لمخيم بركة 2</p>
          </div>
        </div>

        {loading && <p className="text-center text-muted-foreground py-12">جاري التحميل…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-8 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">لا توجد إعلانات حالياً.</p>
          </Card>
        )}

        <div className="space-y-3">
          {items.map((a) => {
            const chips = targetingChips(a);
            const waText = encodeURIComponent(`${a.title}\n\n${a.body}${a.organizer ? `\n\nالجهة: ${a.organizer}` : ""}${a.event_at ? `\n\nالموعد: ${new Date(a.event_at).toLocaleString("ar")}` : ""}`);
            return (
              <Card key={a.id} className="p-5 shadow-card hover:shadow-elegant transition-all">
                <div className="flex items-start gap-3 flex-wrap">
                  <Badge variant="secondary" className="bg-accent/15 text-accent border-accent/30">
                    {KIND_LABEL[a.kind] || a.kind}
                  </Badge>
                  {a.organizer && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {a.organizer}
                    </Badge>
                  )}
                  {a.event_at && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(a.event_at).toLocaleString("ar")}
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg font-bold text-primary mt-3">{a.title}</h2>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-1">{a.body}</p>
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-[11px] text-muted-foreground">الفئة المستهدفة:</span>
                    {chips.map((c, i) => (
                      <span key={i} className="text-[11px] bg-muted px-2 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> مشاركة عبر واتساب
                    </a>
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  نُشر: {new Date(a.created_at).toLocaleString("ar")}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost" className="gap-1.5">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> العودة للرئيسية</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Announcements;
