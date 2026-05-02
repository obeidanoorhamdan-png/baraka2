import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PackageCheck, Search, Save, Users, CheckSquare, Square } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

type FamilyOpt = {
  application_id: string;
  user_id: string;
  head_name: string;
  national_id: string;
  family_size: number;
  status: string;
};

export const BulkAidDistributor = ({
  families, currentUserId, onSaved,
}: { families: FamilyOpt[]; currentUserId: string; onSaved?: () => void }) => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [search, setSearch] = useState("");
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families
      .filter((f) => (onlyApproved ? f.status === "approved" : true))
      .filter((f) =>
        !q ||
        f.head_name?.toLowerCase().includes(q) ||
        f.national_id?.includes(q),
      )
      .sort((a, b) => (a.head_name || "").localeCompare(b.head_name || "", "ar"));
  }, [families, search, onlyApproved]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (filtered.every((f) => selected.has(f.application_id))) {
      const n = new Set(selected);
      filtered.forEach((f) => n.delete(f.application_id));
      setSelected(n);
    } else {
      const n = new Set(selected);
      filtered.forEach((f) => n.add(f.application_id));
      setSelected(n);
    }
  };

  const submit = async () => {
    if (!title.trim()) { toast.error(t("aid.title_required")); return; }
    if (!date) { toast.error(t("aid.date_required")); return; }
    if (selected.size === 0) { toast.error(t("aid_bulk.select_required")); return; }
    if (!(await confirmAsk({
      title: t("aid_bulk.confirm_title"),
      description: t("aid_bulk.confirm_desc", { count: selected.size }),
      confirmText: t("form.save"),
      variant: "default",
    }))) return;
    setBusy(true);
    const rows = Array.from(selected).map((appId) => ({
      application_id: appId,
      title: title.trim(),
      contents: contents.trim() || null,
      delivered_at: date,
      notes: notes.trim() || null,
      created_by: currentUserId,
    }));
    const { error } = await supabase.from("aid_distributions").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("aid_bulk.saved", { count: rows.length }));
    setSelected(new Set()); setTitle(""); setContents(""); setNotes("");
    onSaved?.();
  };

  const allChecked = filtered.length > 0 && filtered.every((f) => selected.has(f.application_id));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Aid form */}
      <Card className="p-4 shadow-card border-accent/40 bg-accent-soft/20">
        <h3 className="font-bold text-primary inline-flex items-center gap-2 mb-3">
          <PackageCheck className="h-5 w-5 text-accent" /> {t("aid_bulk.form_title")}
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("aid.title_field")} <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("aid.title_placeholder")} />
          </div>
          <div>
            <Label className="text-xs">{t("aid.delivered_at")} <span className="text-destructive">*</span></Label>
            <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("aid.contents")}</Label>
            <Textarea rows={3} value={contents} onChange={(e) => setContents(e.target.value)} placeholder={t("aid.contents_placeholder")} />
          </div>
          <div>
            <Label className="text-xs">{t("aid.notes")}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-md border border-accent/30 bg-background p-3 text-sm flex items-center justify-between">
            <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> {t("aid_bulk.selected_count")}</span>
            <strong className="text-primary text-lg">{selected.size}</strong>
          </div>
          <Button onClick={submit} disabled={busy || selected.size === 0} className="w-full brand-gradient text-primary-foreground gap-2">
            <Save className="h-4 w-4" /> {t("aid_bulk.save_btn")}
          </Button>
        </div>
      </Card>

      {/* Families picker */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-bold text-primary inline-flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" /> {t("aid_bulk.pick_families")} ({filtered.length})
          </h3>
          <label className="text-xs inline-flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={onlyApproved} onCheckedChange={(v) => setOnlyApproved(!!v)} />
            {t("aid_bulk.only_approved")}
          </label>
        </div>
        <div className="relative mb-2">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.search")} />
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll} className="mb-2 gap-1.5 w-full">
          {allChecked ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {allChecked ? t("aid_bulk.deselect_all") : t("aid_bulk.select_all_visible")}
        </Button>
        <div className="max-h-[420px] overflow-y-auto space-y-1.5 pe-1">
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">{t("admin.no_results")}</div>
          )}
          {filtered.map((f) => {
            const checked = selected.has(f.application_id);
            return (
              <label key={f.application_id}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  checked ? "border-accent bg-accent/10" : "border-border hover:bg-muted/50"
                }`}>
                <Checkbox checked={checked} onCheckedChange={() => toggle(f.application_id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate text-primary">{f.head_name || "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{f.national_id} • {f.family_size} {t("aid_bulk.persons")}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  f.status === "approved" ? "bg-success/15 text-success" :
                  f.status === "rejected" ? "bg-destructive/15 text-destructive" :
                  "bg-warning/20 text-warning-foreground"
                }`}>{t(`status.${f.status}`)}</span>
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
