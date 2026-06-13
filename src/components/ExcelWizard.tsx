import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sparkles,
  Download,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Columns3,
  Filter,
  Eye,
  LayoutTemplate,
  Wand2,
} from "lucide-react";
import {
  FAMILY_COLS,
  MEMBER_COLS,
  COMPUTED_PRESETS,
  PRESETS,
  fetchDataset,
  listCamps,
  buildExport,
  runWizardExport,
  validateConfig,
  type Dataset,
  type Entity,
  type ExportConfig,
  type ComputedCol,
  type PersonFlag,
  type MemberKind,
} from "@/lib/excelExport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** فلاتر مبدئية قادمة من واجهة بيانات الأدمن (مخيم، حالة، نطاق عمر). */
  initialFilters?: Partial<ExportConfig["filters"]>;
}

const STEPS = [
  { n: 1, label: "القالب والنوع", icon: LayoutTemplate },
  { n: 2, label: "الأعمدة والحساب", icon: Columns3 },
  { n: 3, label: "الفلاتر والمعاينة", icon: Filter },
];

const MEMBER_KINDS: { key: MemberKind; label: string }[] = [
  { key: "orphan", label: "الأيتام" },
  { key: "injured", label: "المصابون" },
  { key: "chronic", label: "أمراض مزمنة" },
  { key: "preg_breast", label: "حوامل/مرضعات" },
  { key: "special_needs", label: "ذوو الهمم" },
];

const FLAGS: { key: PersonFlag; label: string }[] = [
  { key: "pregnant", label: "حامل" },
  { key: "breastfeeding", label: "مرضعة" },
  { key: "war_injured", label: "مصاب" },
  { key: "chronic", label: "مرض مزمن" },
  { key: "special_needs", label: "ذوي همم" },
];

function blankConfig(entity: Entity): ExportConfig {
  return {
    title: entity === "family" ? "تقرير العائلات المخصص" : "تقرير الأفراد المخصص",
    entity,
    columns:
      entity === "family"
        ? ["head_name", "national_id", "phone", "family_size", "current_camp"]
        : ["member_name", "national_id", "gender", "age", "relationship", "head_name", "current_camp"],
    computed: [],
    filters: { status: "approved" },
  };
}

export function ExcelWizard({ open, onOpenChange, initialFilters }: Props) {
  const [step, setStep] = useState(1);
  const [cfg, setCfg] = useState<ExportConfig>(blankConfig("family"));
  const [ds, setDs] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // أداة بناء العمود الحسابي المخصص
  const [ccGender, setCcGender] = useState<"all" | "male" | "female">("all");
  const [ccMin, setCcMin] = useState<string>("");
  const [ccMax, setCcMax] = useState<string>("");
  const [ccFlags, setCcFlags] = useState<PersonFlag[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    // تطبيق الفلاتر المبدئية القادمة من واجهة الأدمن (إن وجدت)
    setCfg((c) =>
      initialFilters ? { ...c, filters: { ...c.filters, ...initialFilters } } : c,
    );
    setLoading(true);
    fetchDataset()
      .then(setDs)
      .catch(() => toast.error("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, [open]);

  const camps = useMemo(() => (ds ? listCamps(ds) : []), [ds]);
  const cols = cfg.entity === "family" ? FAMILY_COLS : MEMBER_COLS;

  const preview = useMemo(() => {
    if (!ds) return { headers: [], rows: [] as any[][] };
    try {
      return buildExport(ds, cfg);
    } catch {
      return { headers: [], rows: [] as any[][] };
    }
  }, [ds, cfg]);

  function applyPreset(id: string, andExport = false) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    const next = JSON.parse(JSON.stringify(p.config)) as ExportConfig;
    setCfg(next);
    if (andExport) {
      doExport(next);
    } else {
      setStep(2);
    }
  }

  function setEntity(entity: Entity) {
    setCfg(blankConfig(entity));
  }

  function toggleColumn(key: string) {
    setCfg((c) => ({
      ...c,
      columns: c.columns.includes(key) ? c.columns.filter((k) => k !== key) : [...c.columns, key],
    }));
  }

  function addComputedPreset(cc: ComputedCol) {
    setCfg((c) =>
      c.computed.some((x) => x.id === cc.id) ? c : { ...c, computed: [...c.computed, cc] },
    );
  }

  function removeComputed(id: string) {
    setCfg((c) => ({ ...c, computed: c.computed.filter((x) => x.id !== id) }));
  }

  function addCustomComputed() {
    const parts: string[] = [];
    if (ccGender !== "all") parts.push(ccGender === "male" ? "ذكور" : "إناث");
    if (ccMin || ccMax) parts.push(`${ccMin || 0}-${ccMax || "∞"} سنة`);
    ccFlags.forEach((f) => parts.push(FLAGS.find((x) => x.key === f)?.label || f));
    const label = "عدد: " + (parts.join(" • ") || "الكل");
    const cc: ComputedCol = {
      id: "custom_" + Date.now(),
      label,
      gender: ccGender,
      ageMin: ccMin === "" ? null : parseInt(ccMin),
      ageMax: ccMax === "" ? null : parseInt(ccMax),
      flags: ccFlags,
    };
    setCfg((c) => ({ ...c, computed: [...c.computed, cc] }));
    setCcGender("all");
    setCcMin("");
    setCcMax("");
    setCcFlags([]);
    toast.success("تمت إضافة عمود حسابي");
  }

  async function doExport(config = cfg) {
    const problems = validateConfig(config);
    if (problems.length) {
      toast.error("تعذّر التصدير — يرجى تصحيح التالي:", {
        description: problems.join("\n"),
      });
      return;
    }
    setExporting(true);
    try {
      const n = await runWizardExport(config);
      toast.success(`تم تنزيل الملف بنجاح — ${n} سجل ✅`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "تعذر التصدير");
    } finally {
      setExporting(false);
    }
  }

  const canNext = cfg.columns.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 rounded-2xl"
      >
        {/* الترويسة */}
        <DialogHeader className="p-5 pb-3 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <span className="relative">
              <Wand2 className="h-6 w-6 text-primary" />
              <Sparkles className="h-3 w-3 text-amber-400 absolute -top-1 -left-1 animate-pulse" />
            </span>
            ساحر تصدير قوالب إكسل الذكي
          </DialogTitle>
          <DialogDescription className="text-xs">
            صمّم تقاريرك بمرونة كاملة — قوالب جاهزة، أعمدة قابلة للتخصيص، أعمدة حسابية ذكية وفلاتر متقدمة.
          </DialogDescription>

          {/* شريط الخطوات */}
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const active = step === s.n;
              const done = step > s.n;
              return (
                <div key={s.n} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => (s.n < step || canNext ? setStep(s.n) : null)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow"
                        : done
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.n}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={cn("h-0.5 flex-1 mx-1", done ? "bg-primary/40" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> جاري تجهيز البيانات...
            </div>
          ) : (
            <>
              {/* الخطوة 1 */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" /> قوالب جاهزة بنقرة واحدة
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {PRESETS.map((p) => (
                        <div
                          key={p.id}
                          className="group flex items-center gap-3 rounded-xl border-2 p-3 hover:border-primary/50 hover:shadow-md transition-all bg-card"
                        >
                          <div className="text-2xl">{p.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{p.label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{p.desc}</div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applyPreset(p.id)}>
                              تخصيص
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              disabled={exporting}
                              onClick={() => applyPreset(p.id, true)}
                            >
                              <Download className="h-3 w-3" /> تصدير
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2">أو ابدأ تقريراً يدوياً — اختر نوع الكيان</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(["family", "member"] as Entity[]).map((e) => (
                        <button
                          key={e}
                          onClick={() => setEntity(e)}
                          className={cn(
                            "rounded-xl border-2 p-4 text-right transition-all",
                            cfg.entity === e ? "border-primary bg-primary/5 shadow" : "hover:border-primary/40",
                          )}
                        >
                          <div className="font-bold">
                            {e === "family" ? "🏠 تقرير العائلات" : "🧒 تقرير الأفراد/الأطفال"}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {e === "family"
                              ? "سطر لكل أسرة + أعمدة حسابية ذكية"
                              : "سطر لكل فرد — أيتام، أطفال، مصابين، حوامل..."}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* الخطوة 2 */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-xs">اسم التقرير</Label>
                    <Input
                      value={cfg.title}
                      onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <Columns3 className="h-4 w-4 text-primary" /> الأعمدة المراد إدراجها
                      <span className="text-[11px] font-normal text-muted-foreground">
                        ({cfg.columns.length} محدد)
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {cols.map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer hover:bg-accent/40"
                        >
                          <Checkbox
                            checked={cfg.columns.includes(col.key)}
                            onCheckedChange={() => toggleColumn(col.key)}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {cfg.entity === "family" && (
                    <div className="rounded-xl border-2 border-dashed p-3 space-y-3 bg-muted/20">
                      <h3 className="font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" /> أعمدة حسابية ذكية
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        تحسب تلقائياً عدد أفراد كل أسرة المطابقين لشرط معيّن.
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {COMPUTED_PRESETS.map((cc) => (
                          <Button
                            key={cc.id}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => addComputedPreset(cc)}
                          >
                            <Plus className="h-3 w-3" /> {cc.label}
                          </Button>
                        ))}
                      </div>

                      {/* بانٍ مخصص */}
                      <div className="rounded-lg bg-card border p-2.5 space-y-2">
                        <div className="text-xs font-bold">بناء شرط مخصص</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px]">الجنس</Label>
                            <Select value={ccGender} onValueChange={(v) => setCcGender(v as any)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="male">ذكر</SelectItem>
                                <SelectItem value="female">أنثى</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">من عمر</Label>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={ccMin}
                              onChange={(e) => setCcMin(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">إلى عمر</Label>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={ccMax}
                              onChange={(e) => setCcMax(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FLAGS.map((fl) => {
                            const on = ccFlags.includes(fl.key);
                            return (
                              <button
                                key={fl.key}
                                onClick={() =>
                                  setCcFlags((s) =>
                                    on ? s.filter((x) => x !== fl.key) : [...s, fl.key],
                                  )
                                }
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all",
                                  on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                                )}
                              >
                                {fl.label}
                              </button>
                            );
                          })}
                        </div>
                        <Button size="sm" className="h-7 text-xs gap-1 w-full" onClick={addCustomComputed}>
                          <Plus className="h-3 w-3" /> إضافة العمود الحسابي
                        </Button>
                      </div>

                      {cfg.computed.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {cfg.computed.map((cc) => (
                            <span
                              key={cc.id}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold px-2 py-1"
                            >
                              {cc.label}
                              <button onClick={() => removeComputed(cc.id)}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* الخطوة 3 */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">المخيم / مكان الإيواء</Label>
                      <Select
                        value={cfg.filters.camp || "__all"}
                        onValueChange={(v) =>
                          setCfg((c) => ({ ...c, filters: { ...c.filters, camp: v === "__all" ? null : v } }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">كل المخيمات</SelectItem>
                          {camps.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">حالة الطلب</Label>
                      <Select
                        value={cfg.filters.status || "approved"}
                        onValueChange={(v) =>
                          setCfg((c) => ({ ...c, filters: { ...c.filters, status: v as any } }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">مقبول</SelectItem>
                          <SelectItem value="pending">قيد المراجعة</SelectItem>
                          <SelectItem value="rejected">مرفوض</SelectItem>
                          <SelectItem value="all">الكل</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {cfg.entity === "member" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">العمر من</Label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={cfg.filters.ageMin ?? ""}
                          onChange={(e) =>
                            setCfg((c) => ({
                              ...c,
                              filters: { ...c.filters, ageMin: e.target.value === "" ? null : parseInt(e.target.value) },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">العمر إلى</Label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={cfg.filters.ageMax ?? ""}
                          onChange={(e) =>
                            setCfg((c) => ({
                              ...c,
                              filters: { ...c.filters, ageMax: e.target.value === "" ? null : parseInt(e.target.value) },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {cfg.entity === "family" && (
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!cfg.filters.hasMartyr}
                          onCheckedChange={(v) =>
                            setCfg((c) => ({ ...c, filters: { ...c.filters, hasMartyr: !!v } }))
                          }
                        />
                        أسر بها شهيد فقط
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!cfg.filters.maritalWidow}
                          onCheckedChange={(v) =>
                            setCfg((c) => ({ ...c, filters: { ...c.filters, maritalWidow: !!v } }))
                          }
                        />
                        الأرامل فقط
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!cfg.filters.femaleBreadwinner}
                          onCheckedChange={(v) =>
                            setCfg((c) => ({ ...c, filters: { ...c.filters, femaleBreadwinner: !!v } }))
                          }
                        />
                        المرأة المعيلة فقط
                      </label>
                    </div>
                  )}

                  {cfg.entity === "member" && (
                    <div>
                      <Label className="text-xs mb-1.5 block">تصفية حسب الفئة</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {MEMBER_KINDS.map((k) => {
                          const on = (cfg.filters.memberKinds || []).includes(k.key);
                          return (
                            <button
                              key={k.key}
                              onClick={() =>
                                setCfg((c) => {
                                  const cur = c.filters.memberKinds || [];
                                  return {
                                    ...c,
                                    filters: {
                                      ...c.filters,
                                      memberKinds: on ? cur.filter((x) => x !== k.key) : [...cur, k.key],
                                    },
                                  };
                                })
                              }
                              className={cn(
                                "rounded-full px-3 py-1 text-[11px] font-bold border transition-all",
                                on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                              )}
                            >
                              {k.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* المعاينة */}
                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" /> معاينة حية
                      <span className="text-[11px] font-normal text-muted-foreground">
                        ({preview.rows.length} سجل مطابق)
                      </span>
                    </h3>
                    <div className="rounded-xl border overflow-auto max-h-56">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                          <TableRow>
                            {preview.headers.map((h, i) => (
                              <TableHead key={i} className="text-xs whitespace-nowrap text-center font-bold">
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.rows.slice(0, 3).map((r, ri) => (
                            <TableRow key={ri}>
                              {r.map((cell, ci) => (
                                <TableCell key={ci} className="text-xs whitespace-nowrap text-center">
                                  {String(cell)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {preview.rows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={preview.headers.length || 1} className="text-center text-xs text-muted-foreground py-6">
                                لا توجد بيانات مطابقة — عدّل الفلاتر
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* التذييل / التنقل */}
        <div className="flex items-center justify-between gap-2 border-t p-4 bg-muted/20">
          <Button
            variant="ghost"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="gap-1"
          >
            <ArrowRight className="h-4 w-4" /> السابق
          </Button>

          {step < 3 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="gap-1">
              التالي <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={exporting || preview.rows.length === 0}
              onClick={() => doExport()}
              className="gap-1 font-bold"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> تنزيل ملف XLSX
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
