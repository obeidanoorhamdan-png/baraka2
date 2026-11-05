import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, ClipboardList, Wrench, Users2, ScrollText, Settings,
  AlertTriangle, Megaphone, Wand2, FileSpreadsheet, CheckSquare, Lock, LayoutGrid, X,
} from "lucide-react";

const main = [
  { title: "الرئيسية", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "الطلبات", url: "/admin/applications", icon: ClipboardList },
  { title: "الشكاوى", url: "/admin/requests", icon: Inbox },
  { title: "الاعتماد", url: "/admin/camp-roster", icon: Lock },
];
const more = [
  { title: "غير المكتملة", url: "/admin/incomplete", icon: AlertTriangle },
  { title: "حل المشاكل", url: "/admin/issues", icon: Wrench },
  { title: "الموافقات", url: "/admin/approvals", icon: CheckSquare },
  { title: "الإعلانات", url: "/admin/announcements", icon: Megaphone },
  { title: "المشرفون", url: "/admin/managers", icon: Users2 },
  { title: "أدوات متقدمة", url: "/admin/power", icon: Wand2 },
  { title: "تصدير اكسل", url: "/admin/excel", icon: FileSpreadsheet },
  { title: "سجل النشاط", url: "/admin/audit", icon: ScrollText },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings },
];

export const AdminBottomNav = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (url: string, end?: boolean) => (end ? pathname === url : pathname.startsWith(url));
  const moreActive = more.some((m) => isActive(m.url));

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />}
      <div className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-all`} dir="rtl">
        {open && (
          <div className="mb-3 rounded-3xl border border-border bg-background p-3 shadow-2xl animate-scale-in">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-bold text-primary">كل الأقسام</span>
              <button onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map((m) => (
                <NavLink key={m.url} to={m.url} onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-semibold transition ${isActive(m.url) ? "bg-accent text-accent-foreground shadow" : "bg-muted/60 text-foreground hover:bg-accent-soft"}`}>
                  <m.icon className="h-5 w-5" />{m.title}
                </NavLink>
              ))}
            </div>
          </div>
        )}
        <nav className="grid grid-cols-5 gap-1 rounded-3xl border border-border bg-background/95 p-1.5 shadow-2xl backdrop-blur">
          {main.map((m) => {
            const a = isActive(m.url, m.end);
            return (
              <NavLink key={m.url} to={m.url} end={m.end}
                className={`group flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-all ${a ? "bg-gradient-to-b from-accent to-primary text-primary-foreground shadow-lg -translate-y-1" : "text-muted-foreground hover:text-primary"}`}>
                <m.icon className={`h-5 w-5 transition-transform ${a ? "scale-110" : "group-active:scale-90"}`} />{m.title}
              </NavLink>
            );
          })}
          <button onClick={() => setOpen(!open)}
            className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-all ${open || moreActive ? "bg-gradient-to-b from-accent to-primary text-primary-foreground shadow-lg -translate-y-1" : "text-muted-foreground hover:text-primary"}`}>
            <LayoutGrid className="h-5 w-5" />المزيد
          </button>
        </nav>
      </div>
    </>
  );
};
