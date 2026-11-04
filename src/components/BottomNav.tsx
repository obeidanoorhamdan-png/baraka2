import { useState } from "react";
import { Home, UserRound, LifeBuoy, BellRing } from "lucide-react";

type Item = { key: string; label: string; icon: typeof Home; target: string; tab?: "new" | "track" };
const ITEMS: Item[] = [
  { key: "home", label: "الرئيسية", icon: Home, target: "top" },
  { key: "signin", label: "دخول للبيانات", icon: UserRound, target: "signin" },
  { key: "new", label: "شكوى / مساعدة", icon: LifeBuoy, target: "requests", tab: "new" },
  { key: "track", label: "متابعة الشكاوى", icon: BellRing, target: "requests", tab: "track" },
];

export const BottomNav = () => {
  const [active, setActive] = useState("home");
  const [wave, setWave] = useState<string | null>(null);

  const go = (it: Item) => {
    setActive(it.key);
    setWave(it.key);
    setTimeout(() => setWave(null), 650);
    if (it.target === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(it.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (it.tab) window.dispatchEvent(new CustomEvent("baraka:requests", { detail: it.tab }));
    if (it.target === "signin") {
      const el = document.getElementById("signin");
      el?.classList.add("ring-4", "ring-accent/60");
      setTimeout(() => el?.classList.remove("ring-4", "ring-accent/60"), 1400);
    }
  };

  return (
    <>
      <div className="h-24" aria-hidden />
      <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto max-w-xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-elegant grid grid-cols-4 p-1.5">
          {ITEMS.map((it) => {
            const on = active === it.key;
            return (
              <button key={it.key} type="button" onClick={() => go(it)}
                className={`relative overflow-hidden rounded-2xl py-2 flex flex-col items-center gap-1 transition-all duration-300 ${on ? "bg-primary text-primary-foreground -translate-y-1 shadow-card" : "text-muted-foreground hover:text-primary"}`}>
                {wave === it.key && <span className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-accent/50 animate-ping" />}
                <it.icon className={`h-5 w-5 transition-transform ${on ? "scale-110" : ""}`} />
                <span className="text-[11px] font-bold leading-none whitespace-nowrap">{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
