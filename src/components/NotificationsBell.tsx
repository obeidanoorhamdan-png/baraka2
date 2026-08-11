import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const formatArabicTime = (iso: string, lang: string): string => {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60000);
    const isAr = lang === "ar";
    if (min < 1) return isAr ? "الآن" : "now";
    if (min < 60) return isAr ? `منذ ${min} دقيقة` : `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return isAr ? `منذ ${hr} ساعة` : `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return isAr ? `منذ ${day} يوم` : `${day}d ago`;
    return d.toLocaleDateString(isAr ? "ar-EG" : "en-US");
  } catch { return iso; }
};

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

export const NotificationsBell = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications")
      .select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    setItems((data as any) || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n: any = payload.new;
          // Live toast — id prevents duplicates if event fires twice
          toast.success(n.title, {
            description: n.body || undefined,
            id: `notif-${n.id}`,
            action: n.link ? {
              label: t("notify.open"),
              onClick: async () => {
                await supabase.from("notifications")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", n.id);
                navigate(n.link);
                load();
              },
            } : undefined,
          });
          load();
        },
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, navigate, t]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    load();
  };

  const openItem = async (n: Notif) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-1.5">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-background z-10">
          <div className="font-bold text-primary inline-flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" /> {t("notify.title")}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              {t("notify.mark_all_read")}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("notify.empty")}</div>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={`w-full text-start p-3 border-b last:border-0 hover:bg-muted/50 transition-colors flex gap-3 ${
                    !n.read_at ? "bg-accent/5" : ""
                  }`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    n.kind === "aid" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
                  }`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm text-primary truncate">{n.title}</div>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />}
                    </div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatArabicTime(n.created_at, i18n.language)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
