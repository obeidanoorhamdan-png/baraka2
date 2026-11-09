import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/baraka-logo.jpg";
import { fetchDataset, ageParts, type Dataset } from "@/lib/excelExport";
import { computeStats, type Stats } from "@/lib/excelPro";

/** كشف رسمي قابل للطباعة / الحفظ PDF بشعار المخيم وتوقيع الإدارة. */
export default function PrintReport() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [st, setSt] = useState<Stats | null>(null);

  useEffect(() => { if (!loading && !isAdmin) nav("/admin-login"); }, [loading, isAdmin, nav]);
  useEffect(() => {
    if (!isAdmin) return;
    fetchDataset().then((d) => {
      const apps = d.apps.filter((a) => a.status === "approved").sort((a, b) => (a.family_no ?? 1e9) - (b.family_no ?? 1e9));
      const ids = new Set(apps.map((a) => a.id));
      const x = { ...d, apps, members: d.members.filter((m) => ids.has(m.application_id)) };
      setDs(x); setSt(computeStats(x));
    });
  }, [isAdmin]);

  if (!ds || !st) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  const pById = new Map(ds.profiles.map((p) => [p.id, p]));

  return (
    <div className="print-page mx-auto max-w-5xl bg-card p-6 text-foreground" dir="rtl">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> طباعة / حفظ PDF</Button>
        <Button variant="outline" onClick={() => nav(-1)} className="gap-2"><ArrowRight className="h-4 w-4" /> رجوع</Button>
        <span className="self-center text-xs text-muted-foreground">اختر «حفظ كـ PDF» من نافذة الطباعة.</span>
      </div>

      <header className="flex items-center justify-between border-b-4 border-primary pb-3">
        <div>
          <div className="text-2xl font-extrabold text-primary">مخيم بركة 2</div>
          <div className="text-sm">الكشف الرسمي للأسر المعتمدة</div>
        </div>
        <img src={logo} alt="شعار المخيم" className="h-20 w-20 rounded-full" />
        <div className="text-left text-xs leading-6">
          <div>التاريخ: {new Date().toLocaleDateString("ar-EG")}</div>
          <div>عدد الأسر: {st.families}</div>
          <div>عدد الأفراد: {st.persons}</div>
        </div>
      </header>

      <section className="my-4 grid grid-cols-4 gap-2 text-center text-sm">
        {[["الأسر", st.families], ["الأفراد", st.persons], ["ذكور", st.males], ["إناث", st.females],
          ...st.health.map((h) => [h.label, h.count]), ["طلاب جامعيون", st.students], ["أسر شهداء", st.martyrs]].map(([l, c]) => (
          <div key={String(l)} className="avoid-break rounded-lg border border-primary/40 p-2">
            <div className="text-xl font-extrabold text-primary">{c}</div><div className="text-xs">{l}</div>
          </div>
        ))}
      </section>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            {["#", "رقم الأسرة", "اسم رب الأسرة", "رقم الهوية", "العمر", "الجوال", "الأفراد", "السكن الأصلي"].map((h) => (
              <th key={h} className="border border-border p-1.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ds.apps.map((a, i) => {
            const h: any = pById.get(a.user_id) || {};
            const n = ds.members.filter((m) => m.application_id === a.id && !m.is_head).length + 1;
            return (
              <tr key={a.id} className="avoid-break odd:bg-muted/50">
                <td className="border border-border p-1 text-center">{i + 1}</td>
                <td className="border border-border p-1 text-center">{a.family_no ?? "—"}</td>
                <td className="border border-border p-1">{h.full_name || "لا يوجد"}</td>
                <td className="border border-border p-1 text-center">{h.national_id || "لا يوجد"}</td>
                <td className="border border-border p-1 text-center">{ageParts(h.birth_date)?.years ?? "—"}</td>
                <td className="border border-border p-1 text-center">{h.phone || "لا يوجد"}</td>
                <td className="border border-border p-1 text-center">{n}</td>
                <td className="border border-border p-1">{a.original_residence || "لا يوجد"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="avoid-break mt-10 grid grid-cols-2 gap-10 text-sm">
        <div className="text-center"><div className="mb-10">توقيع مدير المخيم</div><div className="border-t border-foreground pt-1">الاسم والتوقيع</div></div>
        <div className="text-center"><div className="mb-10">الختم الرسمي</div><div className="mx-auto h-20 w-20 rounded-full border-2 border-dashed border-primary" /></div>
      </footer>
    </div>
  );
}
