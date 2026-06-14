import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  PackageCheck,
  Users2,
  ScrollText,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Megaphone,
  Wand2,
  FileSpreadsheet,
  Truck,
  CheckSquare,
  Lock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/baraka-logo.jpg";

const items = [
  { title: "لوحة التحكم", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "الطلبات", url: "/admin/applications", icon: ClipboardList },
  { title: "غير المكتملة", url: "/admin/incomplete", icon: AlertTriangle },
  { title: "المساعدات", url: "/admin/aid", icon: PackageCheck },
  { title: "حملات التوزيع", url: "/admin/campaigns", icon: Truck },
  { title: "الموافقات", url: "/admin/approvals", icon: CheckSquare },
  { title: "الإعلانات", url: "/admin/announcements", icon: Megaphone },
  { title: "المشرفون", url: "/admin/managers", icon: Users2 },
  { title: "أدوات متقدمة", url: "/admin/power", icon: Wand2 },
  { title: "تصدير اكسل", url: "/admin/excel", icon: FileSpreadsheet },
  { title: "سجل النشاط", url: "/admin/audit", icon: ScrollText },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings },
];

export const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <img src={logo} alt="logo" className="h-9 w-9 rounded-full ring-2 ring-accent/40 shrink-0" />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="text-xs font-bold text-sidebar-foreground truncate">لوحة الإدارة</div>
              <div className="text-[10px] font-semibold tracking-wider text-accent flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Baraka 2
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القوائم</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <NavLink to={item.url} end={item.end} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
