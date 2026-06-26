import { useEffect, useState } from "react";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type A = {
  id: string; title: string; body: string; kind: string;
  media_url: string | null; media_type: string | null;
};

/** Centered announcement popup shown to every visitor on each visit. */
export const AnnouncementPopup = () => {
  const [items, setItems] = useState<A[]>([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id,title,body,kind,media_url,media_type")
        .eq("active", true)
        .eq("show_popup", true)
        .order("created_at", { ascending: false });
      const list = (data as any[]) || [];
      if (list.length) { setItems(list); setOpen(true); }
    })();
  }, []);

  if (!items.length) return null;
  const a = items[idx];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-accent/40">
        <div className="brand-gradient px-5 py-3 flex items-center gap-2 text-primary-foreground">
          <Megaphone className="h-5 w-5 text-accent" />
          <DialogTitle className="text-primary-foreground text-base">إعلان من إدارة المخيم</DialogTitle>
        </div>

        {a.media_url && (
          <div className="bg-black/90 max-h-[45vh] flex items-center justify-center">
            {a.media_type === "video" ? (
              <video src={a.media_url} controls autoPlay muted playsInline className="max-h-[45vh] w-full object-contain" />
            ) : (
              <img src={a.media_url} alt={a.title} className="max-h-[45vh] w-full object-contain" />
            )}
          </div>
        )}

        <div className="p-5 space-y-2 max-h-[40vh] overflow-y-auto">
          <h3 className="text-lg font-bold text-primary">{a.title}</h3>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{a.body}</p>
        </div>

        {items.length > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              <ChevronRight className="h-4 w-4" /> السابق
            </Button>
            <span className="text-xs text-muted-foreground">{idx + 1} / {items.length}</span>
            <Button size="sm" variant="ghost" disabled={idx === items.length - 1} onClick={() => setIdx((i) => i + 1)}>
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
