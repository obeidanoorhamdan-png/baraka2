import { useEffect, useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

type Tree = Record<string, Record<string, Record<string, Record<string, string[]>>>>;

let cache: Tree | null = null;
async function loadTree(): Promise<Tree> {
  if (cache) return cache;
  const res = await fetch("/data/locations.json");
  cache = (await res.json()) as Tree;
  return cache!;
}

export interface LocationValue {
  governorate: string;
  city: string;
  area: string;
  neighborhood: string;
}

export const emptyLocation = (): LocationValue => ({ governorate: "", city: "", area: "", neighborhood: "" });

export const formatLocation = (v: LocationValue) =>
  [v.governorate, v.city, v.area, v.neighborhood].filter(Boolean).join(" / ");

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  required?: boolean;
  showErrors?: boolean;
}

export const LocationCascade = ({ value, onChange, required, showErrors }: Props) => {
  const [tree, setTree] = useState<Tree | null>(null);

  useEffect(() => { loadTree().then(setTree).catch(() => setTree({} as Tree)); }, []);

  const govs = useMemo(() => tree ? Object.keys(tree) : [], [tree]);
  const cities = useMemo(() => (tree && value.governorate && tree[value.governorate]) ? Object.keys(tree[value.governorate]) : [], [tree, value.governorate]);
  const areas = useMemo(() => (tree && value.governorate && value.city && tree[value.governorate]?.[value.city]) ? Object.keys(tree[value.governorate][value.city]) : [], [tree, value.governorate, value.city]);
  const hoods = useMemo(() => {
    if (!tree || !value.governorate || !value.city || !value.area) return [];
    const node = tree[value.governorate]?.[value.city]?.[value.area];
    if (!node) return [];
    if (Array.isArray(node)) return node as unknown as string[];
    return Object.keys(node);
  }, [tree, value.governorate, value.city, value.area]);

  const err = (cond: boolean) => showErrors && cond ? "border-destructive" : "";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-accent" />المحافظة {required && <span className="text-destructive">*</span>}</Label>
        <Select value={value.governorate} onValueChange={(v) => onChange({ governorate: v, city: "", area: "", neighborhood: "" })}>
          <SelectTrigger className={err(!value.governorate)}><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
          <SelectContent>{govs.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        {showErrors && !value.governorate && <p className="text-xs text-destructive mt-1">يلزم اختيار المحافظة</p>}
      </div>
      <div>
        <Label>المدينة {required && <span className="text-destructive">*</span>}</Label>
        <Select value={value.city} disabled={!value.governorate} onValueChange={(v) => onChange({ ...value, city: v, area: "", neighborhood: "" })}>
          <SelectTrigger className={err(!value.city)}><SelectValue placeholder={value.governorate ? "اختر المدينة" : "اختر المحافظة أولاً"} /></SelectTrigger>
          <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        {showErrors && value.governorate && !value.city && <p className="text-xs text-destructive mt-1">يلزم اختيار المدينة</p>}
      </div>
      <div>
        <Label>المنطقة {required && <span className="text-destructive">*</span>}</Label>
        <Select value={value.area} disabled={!value.city} onValueChange={(v) => onChange({ ...value, area: v, neighborhood: "" })}>
          <SelectTrigger className={err(!value.area)}><SelectValue placeholder={value.city ? "اختر المنطقة" : "اختر المدينة أولاً"} /></SelectTrigger>
          <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
        {showErrors && value.city && !value.area && <p className="text-xs text-destructive mt-1">يلزم اختيار المنطقة</p>}
      </div>
      <div>
        <Label>الحي {required && <span className="text-destructive">*</span>}</Label>
        <Select value={value.neighborhood} disabled={!value.area} onValueChange={(v) => onChange({ ...value, neighborhood: v })}>
          <SelectTrigger className={err(!value.neighborhood)}><SelectValue placeholder={value.area ? "اختر الحي" : "اختر المنطقة أولاً"} /></SelectTrigger>
          <SelectContent>{hoods.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
        {showErrors && value.area && !value.neighborhood && <p className="text-xs text-destructive mt-1">يلزم اختيار الحي</p>}
      </div>
    </div>
  );
};

// Parse a "/" separated stored string back into LocationValue
export const parseLocation = (s?: string | null): LocationValue => {
  if (!s) return emptyLocation();
  const parts = s.split(" / ").map((p) => p.trim());
  return {
    governorate: parts[0] || "",
    city: parts[1] || "",
    area: parts[2] || "",
    neighborhood: parts[3] || "",
  };
};
