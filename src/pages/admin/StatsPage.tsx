import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Home, GraduationCap, HeartPulse } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDataset } from "@/lib/excelExport";
import { computeStats, type Stats } from "@/lib/excelPro";

const COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--primary-glow))", "hsl(var(--muted-foreground))"];

export default function StatsPage() {
  const [st, setSt] = useState<Stats | null>(null);
  useEffect(() => { fetchDataset().then((d) => setSt(computeStats(d))); }, []);

  return (
    <AdminLayout title="الإحصائيات المتقدمة">
      {!st ? (
        <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4 p-3 md:p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[{ i: Home, l: "الأسر", c: st.families }, { i: Users, l: "الأفراد", c: st.persons },
              { i: GraduationCap, l: "طلاب جامعيون", c: st.students }, { i: HeartPulse, l: "مصابو حرب", c: st.health[0].count }].map(({ i: I, l, c }) => (
              <Card key={l} className="shadow-card"><CardContent className="flex items-center gap-3 pt-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-primary"><I className="h-5 w-5" /></div>
                <div><div className="text-2xl font-extrabold">{c}</div><div className="text-xs text-muted-foreground">{l}</div></div>
              </CardContent></Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="الفئات العمرية">
              <BarChart data={st.ageBands}><XAxis dataKey="label" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                <Bar dataKey="count" name="العدد" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" /></BarChart>
            </ChartCard>
            <ChartCard title="الجنس">
              <PieChart><Tooltip /><Pie data={[{ label: "ذكور", count: st.males }, { label: "إناث", count: st.females }]} dataKey="count" nameKey="label" innerRadius={55} outerRadius={95} label>
                {[0, 1].map((i) => <Cell key={i} fill={COLORS[i]} />)}</Pie></PieChart>
            </ChartCard>
            <ChartCard title="الحالة الصحية">
              <BarChart data={st.health} layout="vertical"><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="label" width={90} fontSize={11} /><Tooltip />
                <Bar dataKey="count" name="العدد" radius={[0, 8, 8, 0]}>{st.health.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
            </ChartCard>
            <ChartCard title="حالة الطلبات">
              <PieChart><Tooltip /><Pie data={st.status} dataKey="count" nameKey="label" outerRadius={95} label>
                {st.status.map((_, i) => <Cell key={i} fill={[COLORS[2], COLORS[1], COLORS[3]][i]} />)}</Pie></PieChart>
            </ChartCard>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const ChartCard = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <Card className="shadow-card"><CardContent className="pt-5">
    <div className="mb-2 font-bold">{title}</div>
    <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
  </CardContent></Card>
);
