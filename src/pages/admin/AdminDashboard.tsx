import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, ClipboardList, CheckCircle2, XCircle, Activity, Heart, Baby,
  PackageCheck, AlertTriangle, ArrowLeft, TrendingUp,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { calculateAge } from "@/lib/age";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning))"];

const StatCard = ({ icon: Icon, label, value, color, to }: any) => {
  const inner = (
    <Card className="p-4 shadow-card hover:shadow-elegant transition-all hover:-translate-y-0.5 cursor-pointer">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
};

const AdminDashboard = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [advanced, setAdvanced] = useState<any>(null);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [incompleteCount, setIncompleteCount] = useState(0);

  const load = async () => {
    const [{ data: apps }, inc] = await Promise.all([
      supabase.from("applications").select("*").order("submitted_at", { ascending: false }),
      supabase.rpc("list_incomplete_accounts"),
    ]);
    setRows(apps || []);
    setIncompleteCount((inc.data as any[])?.length || 0);
    if (apps?.length) {
      const ids = apps.map((a) => a.id);
      const userIds = apps.map((a) => a.user_id);
      const [{ data: fm }, { data: profs }] = await Promise.all([
        supabase.from("family_members").select("*").in("application_id", ids),
        supabase.from("profiles").select("*").in("id", userIds),
      ]);
      const grouped: Record<string, any[]> = {};
      (fm || []).forEach((m: any) => { (grouped[m.application_id] ||= []).push(m); });
      setMembers(grouped);
      const pmap: Record<string, any> = {};
      (profs || []).forEach((p: any) => { pmap[p.id] = p; });
      setProfiles(pmap);
    }
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const allMembers = Object.values(members).flat();
    const headInjured = Object.values(profiles).filter((p: any) => p.is_war_injured).length;
    const memberInjured = allMembers.filter((m: any) => m.is_war_injured).length;
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      totalMembers: rows.reduce((s, r) => s + (r.family_size || 0), 0),
      injured: headInjured + memberInjured,
      martyrs: rows.filter((r) => r.has_martyr).length,
      pregnant: allMembers.filter((m: any) => m.is_pregnant).length,
    };
  }, [rows, members, profiles]);

  // Status distribution
  const statusData = [
    { name: "قيد المراجعة", value: stats.pending, color: "hsl(var(--warning))" },
    { name: "مقبولة", value: stats.approved, color: "hsl(var(--success))" },
    { name: "مرفوضة", value: stats.rejected, color: "hsl(var(--destructive))" },
  ].filter((x) => x.value > 0);

  // Age groups
  const ageData = useMemo(() => {
    const groups = { "رضع (<1)": 0, "أطفال (1-11)": 0, "شباب (12-17)": 0, "بالغون (18-59)": 0, "كبار (60+)": 0 };
    const all: any[] = [];
    rows.forEach((r) => {
      const p = profiles[r.user_id]; if (p) all.push(p);
      (members[r.id] || []).forEach((m) => all.push(m));
    });
    all.forEach((p) => {
      const a = calculateAge(p.birth_date);
      if (a < 1) groups["رضع (<1)"]++;
      else if (a < 12) groups["أطفال (1-11)"]++;
      else if (a < 18) groups["شباب (12-17)"]++;
      else if (a < 60) groups["بالغون (18-59)"]++;
      else groups["كبار (60+)"]++;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [rows, members, profiles]);

  // Gender
  const genderData = useMemo(() => {
    let male = 0, female = 0;
    Object.values(profiles).forEach((p: any) => p.gender === "male" ? male++ : female++);
    Object.values(members).flat().forEach((m: any) => m.gender === "male" ? male++ : female++);
    return [
      { name: "ذكر", value: male, color: "hsl(var(--primary))" },
      { name: "أنثى", value: female, color: "hsl(var(--accent))" },
    ];
  }, [members, profiles]);

  // Daily registrations (last 14 days)
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10);
      map.set(key, 0);
    }
    rows.forEach((r) => {
      const k = r.submitted_at?.slice(5, 10);
      if (k && map.has(k)) map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([day, count]) => ({ day, count }));
  }, [rows]);

  return (
    <AdminLayout title="لوحة التحكم الرئيسية">
      <div className="container py-6 space-y-6 max-w-7xl">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-primary">مرحباً بعودتك 👋</h2>
          <p className="text-sm text-muted-foreground">نظرة شاملة على بيانات المخيم</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ClipboardList} label="إجمالي الطلبات" value={stats.total} color="bg-primary/10 text-primary" to="/admin/applications" />
          <StatCard icon={Activity} label="قيد المراجعة" value={stats.pending} color="bg-warning/20 text-warning-foreground" to="/admin/applications" />
          <StatCard icon={CheckCircle2} label="مقبولة" value={stats.approved} color="bg-success/15 text-success" to="/admin/applications" />
          <StatCard icon={XCircle} label="مرفوضة" value={stats.rejected} color="bg-destructive/15 text-destructive" to="/admin/applications" />
          <StatCard icon={Users} label="إجمالي الأفراد" value={stats.totalMembers} color="bg-accent/15 text-accent-foreground" />
          <StatCard icon={Heart} label="مصابو الحرب" value={stats.injured} color="bg-destructive/10 text-destructive" />
          <StatCard icon={Heart} label="عائلات الشهداء" value={stats.martyrs} color="bg-primary/10 text-primary" />
          <StatCard icon={Baby} label="حوامل" value={stats.pregnant} color="bg-accent/15 text-accent-foreground" />
        </div>

        {incompleteCount > 0 && (
          <Card className="p-4 border-2 border-warning/40 bg-warning/5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-warning-foreground" />
                <div>
                  <div className="font-bold text-primary">{incompleteCount} حساب غير مكتمل</div>
                  <div className="text-xs text-muted-foreground">سجّلت ولم تُكمل بياناتها</div>
                </div>
              </div>
              <Link to="/admin/incomplete" className="text-sm text-accent font-bold hover:underline inline-flex items-center gap-1">
                مراجعة <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </Card>
        )}

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 shadow-card">
            <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> التسجيل خلال آخر 14 يوماً
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 shadow-card">
            <h3 className="font-bold text-primary mb-3">حالة الطلبات</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 shadow-card">
            <h3 className="font-bold text-primary mb-3">الفئات العمرية</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 shadow-card">
            <h3 className="font-bold text-primary mb-3">توزيع الجنس</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {genderData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 md:grid-cols-3">
          <Link to="/admin/applications" className="block">
            <Card className="p-4 shadow-card hover:shadow-elegant transition-all hover:-translate-y-0.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="font-extrabold text-primary">الطلبات</div>
              <div className="text-xs text-muted-foreground">مراجعة العائلات وقبول/رفض الطلبات</div>
            </Card>
          </Link>
          <Link to="/admin/aid" className="block">
            <Card className="p-4 shadow-card hover:shadow-elegant transition-all hover:-translate-y-0.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15 text-accent-foreground mb-3">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div className="font-extrabold text-primary">المساعدات</div>
              <div className="text-xs text-muted-foreground">توزيع جماعي وتسجيل الإعانات</div>
            </Card>
          </Link>
          <Link to="/admin/managers" className="block">
            <Card className="p-4 shadow-card hover:shadow-elegant transition-all hover:-translate-y-0.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-success/15 text-success mb-3">
                <Users className="h-6 w-6" />
              </div>
              <div className="font-extrabold text-primary">المشرفون</div>
              <div className="text-xs text-muted-foreground">إدارة فريق الإشراف</div>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
