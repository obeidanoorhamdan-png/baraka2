import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExcelWizard } from "@/components/ExcelWizard";
import { PRESETS } from "@/lib/excelExport";
import { Wand2, Sparkles, FileSpreadsheet, Columns3, Filter, Calculator } from "lucide-react";

const FEATURES = [
  { icon: Sparkles, title: "قوالب جاهزة", desc: "تصدير بنقرة واحدة لأشهر الكشوف" },
  { icon: Columns3, title: "أعمدة مخصصة", desc: "اختر تماماً ما تريده في الملف" },
  { icon: Calculator, title: "أعمدة حسابية ذكية", desc: "عدّ الأفراد حسب شروط لكل أسرة" },
  { icon: Filter, title: "فلاتر متقدمة", desc: "مخيم، فئة عمرية، حالة، وأكثر" },
];

export default function ExcelExport() {
  const [open, setOpen] = useState(false);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-green-600" />
            مركز تصدير القوالب الذكي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ساحر متعدد المراحل لتصميم وتصدير تقارير إكسل احترافية ومنسقة بمرونة كاملة.
          </p>
        </div>

        {/* بطاقة الإطلاق */}
        <Card className="overflow-hidden border-2 relative">
          <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent pointer-events-none" />
          <CardContent className="relative py-8 flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-lg">
                <Wand2 className="h-8 w-8" />
              </div>
              <Sparkles className="h-5 w-5 text-amber-400 absolute -top-1 -left-1 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">ساحر تصدير قوالب إكسل الذكي</h2>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                صمّم تقريرك خطوة بخطوة: اختر قالباً جاهزاً أو ابنِ تقريراً مخصصاً بأعمدة وفلاتر وأعمدة حسابية، مع معاينة حية قبل التنزيل.
              </p>
            </div>
            <Button size="lg" className="gap-2 font-bold" onClick={() => setOpen(true)}>
              <Wand2 className="h-5 w-5" /> ابدأ الساحر
            </Button>
          </CardContent>
        </Card>

        {/* المميزات */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border-2">
                <CardContent className="pt-5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-bold text-sm">{f.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* وصول سريع للقوالب */}
        <div>
          <h3 className="font-bold mb-2 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> قوالب سريعة
          </h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
                <span>{p.emoji}</span> {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ExcelWizard open={open} onOpenChange={setOpen} />
    </AdminLayout>
  );
}
