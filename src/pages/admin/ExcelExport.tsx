import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileSpreadsheet, Download, Users2, Baby, HeartHandshake, Accessibility, Loader2, WifiOff } from "lucide-react";
import {
  exportFamiliesAll,
  exportWidows,
  exportOrphans,
  exportChildrenByAge,
  exportSpecialNeeds,
} from "@/lib/excelExport";

type TplKey = "families" | "widows" | "orphans" | "children" | "special";

const TEMPLATES: { key: TplKey; title: string; desc: string; icon: any; color: string }[] = [
  { key: "families", title: "كشف الأسر الكامل", desc: "جميع الأسر المقبولة — رب الأسرة + الزوج/ة + الموقع", icon: Users2, color: "from-blue-500 to-indigo-600" },
  { key: "widows", title: "الأرامل والمعيلات", desc: "النساء معيلات الأسرة والأرامل المقبولات", icon: HeartHandshake, color: "from-rose-500 to-pink-600" },
  { key: "orphans", title: "الأيتام", desc: "الأبناء القاصرون في أسر استشهد فيها أحد الأبوين", icon: Baby, color: "from-amber-500 to-orange-600" },
  { key: "children", title: "الأطفال حسب الفئة العمرية", desc: "تحديد فئة عمرية (من-إلى) لتصدير الأطفال", icon: Baby, color: "from-emerald-500 to-teal-600" },
  { key: "special", title: "ذوو الهمم", desc: "ذوو الاحتياجات الخاصة من رب الأسرة وأفرادها", icon: Accessibility, color: "from-violet-500 to-purple-600" },
];

export default function ExcelExport() {
  const [busy, setBusy] = useState<TplKey | null>(null);
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(12);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  async function run(key: TplKey) {
    setBusy(key);
    try {
      if (key === "families") await exportFamiliesAll();
      else if (key === "widows") await exportWidows();
      else if (key === "orphans") await exportOrphans();
      else if (key === "special") await exportSpecialNeeds();
      else if (key === "children") {
        if (minAge < 0 || maxAge < minAge) {
          toast.error("الرجاء إدخال نطاق عمري صحيح");
          return;
        }
        await exportChildrenByAge(minAge, maxAge);
      }
      toast.success("تم تنزيل الملف بنجاح ✅");
    } catch (e: any) {
      toast.error("تعذر التصدير: " + (e?.message || "خطأ غير معروف"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <FileSpreadsheet className="h-7 w-7 text-green-600" />
              مركز تصدير اكسل
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              قوالب احترافية منسقة (RTL، رؤوس ملونة، تصفية تلقائية، تجميد للرؤوس) — جميع التقارير للمقبولين فقط.
              {!online && (
                <span className="ms-2 inline-flex items-center gap-1 text-amber-600 font-bold">
                  <WifiOff className="h-3.5 w-3.5" /> أوفلاين — يستخدم آخر نسخة محفوظة
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.key} className="overflow-hidden border-2 hover:border-primary/40 transition-all hover:shadow-lg">
                <div className={`h-2 bg-gradient-to-r ${t.color}`} />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {t.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground min-h-[40px]">{t.desc}</p>

                  {t.key === "children" && (
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40">
                      <div>
                        <Label className="text-xs">من عمر</Label>
                        <Input type="number" min={0} max={120} value={minAge}
                          onChange={(e) => setMinAge(parseInt(e.target.value || "0"))} />
                      </div>
                      <div>
                        <Label className="text-xs">إلى عمر</Label>
                        <Input type="number" min={0} max={120} value={maxAge}
                          onChange={(e) => setMaxAge(parseInt(e.target.value || "0"))} />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => run(t.key)}
                    disabled={busy !== null}
                    className="w-full font-bold gap-2"
                  >
                    {busy === t.key ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> جاري التصدير...</>
                    ) : (
                      <><Download className="h-4 w-4" /> تنزيل الفورمة</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
            <p>• القيم الفارغة تُكتب تلقائياً <span className="font-bold text-foreground">«لا يوجد»</span> أو <span className="font-bold text-foreground">0</span> حسب نوع البيانات.</p>
            <p>• الملفات بصيغة .xlsx — تفتح على Excel / WPS / Google Sheets / LibreOffice.</p>
            <p>• يعمل بدون إنترنت — يستخدم آخر نسخة بيانات محفوظة محلياً، ويُحدِّث الكاش عند توفر الاتصال.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
