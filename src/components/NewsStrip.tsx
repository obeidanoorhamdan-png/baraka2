import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, ArrowLeft, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type A = {
  id: string; title: string; body: string; kind: string;
  media_url: string | null; media_type: string | null; created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  general: "إعلان عام", event: "فعالية", meeting: "اجتماع",
  aid: "توزيع مساعدات", health: "حملة صحية",
};

/** Homepage "Latest news & announcements" strip with images & videos. */
export const NewsStrip = () => {
  const [items, setItems] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id,title,body,kind,media_url,media_type,created_at")
        .eq("active", true)
        .eq("show_in_strip", true)
        .order("created_at", { ascending: false })
        .limit(12);
      setItems((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section className="container py-12 md:py-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent/15 p-3">
            <Newspaper className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl text-primary font-bold">آخر الأخبار والإعلانات</h2>
            <p className="text-sm text-muted-foreground">مستجدات وفعاليات مخيم بركة 2</p>
          </div>
        </div>
        <Link to="/announcements" className="inline-flex items-center gap-1.5 text-accent font-semibold hover:underline text-sm">
          عرض الكل <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1">
        {items.map((a) => (
          <Card key={a.id} className="snap-start shrink-0 w-72 md:w-80 overflow-hidden shadow-card hover:shadow-elegant transition-shadow">
            <div className="relative bg-muted h-44 flex items-center justify-center overflow-hidden">
              {a.media_url ? (
                a.media_type === "video" ? (
                  <>
                    <video src={a.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <PlayCircle className="absolute h-12 w-12 text-primary-foreground/90 drop-shadow-lg" />
                  </>
                ) : (
                  <img src={a.media_url} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                )
              ) : (
                <Newspaper className="h-10 w-10 text-muted-foreground/40" />
              )}
              <span className="absolute top-2 right-2 text-[10px] font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                {KIND_LABEL[a.kind] || a.kind}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-primary line-clamp-1">{a.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{a.body}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
