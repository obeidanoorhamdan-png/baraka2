import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, PackageCheck, X, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

export type Aid = {
  id?: string;
  application_id: string;
  title: string;
  contents: string | null;
  delivered_at: string;
  notes: string | null;
};

const empty = (appId: string): Aid => ({
  application_id: appId,
  title: "",
  contents: "",
  delivered_at: new Date().toISOString().slice(0, 10),
  notes: "",
});

export const AidManager = ({ applicationId, currentUserId }: { applicationId: string; currentUserId: string }) => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [items, setItems] = useState<Aid[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Aid | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("aid_distributions")
      .select("*").eq("application_id", applicationId).order("delivered_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId]);

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { toast.error(t("aid.title_required")); return; }
    if (!draft.delivered_at) { toast.error(t("aid.date_required")); return; }
    if (!(await confirmAsk({
      title: editingId ? t("confirm.aid_update_title") : t("confirm.aid_add_title"),
      description: editingId ? t("confirm.aid_update") : t("confirm.aid_add"),
      confirmText: t("form.save"),
      variant: "default",
    }))) return;
    setBusy(true);
    const payload = {
      application_id: applicationId,
      title: draft.title.trim(),
      contents: draft.contents?.trim() || null,
      delivered_at: draft.delivered_at,
      notes: draft.notes?.trim() || null,
      created_by: currentUserId,
    };
    const { error } = editingId
      ? await supabase.from("aid_distributions").update(payload).eq("id", editingId)
      : await supabase.from("aid_distributions").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    // Notify family on new aid (not on edit)
    if (!editingId) {
      const { data: app } = await supabase.from("applications").select("user_id").eq("id", applicationId).maybeSingle();
      if (app?.user_id) {
        await supabase.from("notifications").insert({
          user_id: app.user_id,
          title: t("notify.new_aid_title"),
          body: t("notify.new_aid_body", { title: payload.title, date: payload.delivered_at }),
          link: "/my-aid",
          kind: "aid",
        });
      }
    }

    toast.success(t("toast.saved"));
    setDraft(null); setEditingId(null);
    load();
  };

  const startEdit = (a: Aid) => {
    setDraft({ ...a, contents: a.contents || "", notes: a.notes || "" });
    setEditingId(a.id || null);
  };

  const remove = async (a: Aid) => {
    if (!a.id) return;
    if (!(await confirmAsk({
      title: t("confirm.aid_delete_title"),
      description: t("confirm.aid_delete"),
      confirmText: t("common.delete"),
      variant: "danger",
    }))) return;
    const { error } = await supabase.from("aid_distributions").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("toast.saved"));
    load();
  };

  return (
    <Card className="p-4 border-accent/30 bg-accent-soft/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-primary inline-flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-accent" /> {t("aid.title_section")} ({items.length})
        </h3>
        {!draft && (
          <Button size="sm" onClick={() => setDraft(empty(applicationId))} className="gap-1.5 brand-gradient text-primary-foreground">
            <Plus className="h-4 w-4" /> {t("aid.add")}
          </Button>
        )}
      </div>

      {draft && (
        <Card className="p-3 mb-3 border-accent/40 bg-background space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label className="text-xs">{t("aid.title_field")} <span className="text-destructive">*</span></Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t("aid.title_placeholder")} />
            </div>
            <div>
              <Label className="text-xs">{t("aid.delivered_at")} <span className="text-destructive">*</span></Label>
              <Input type="date" value={draft.delivered_at} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, delivered_at: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("aid.contents")}</Label>
            <Textarea rows={2} value={draft.contents || ""} onChange={(e) => setDraft({ ...draft, contents: e.target.value })}
              placeholder={t("aid.contents_placeholder")} />
          </div>
          <div>
            <Label className="text-xs">{t("aid.notes")}</Label>
            <Textarea rows={2} value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { setDraft(null); setEditingId(null); }} className="gap-1">
              <X className="h-4 w-4" /> {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={busy} onClick={save} className="gap-1 brand-gradient text-primary-foreground">
              <Save className="h-4 w-4" /> {t("form.save")}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-3">...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-3 border border-dashed border-accent/30 rounded">
          {t("aid.empty_admin")}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-primary">{a.title}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{a.delivered_at}</div>
                  {a.contents && <div className="text-sm mt-1 whitespace-pre-wrap">{a.contents}</div>}
                  {a.notes && <div className="text-xs text-muted-foreground mt-1">{t("aid.notes")}: {a.notes}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)} className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4 text-accent" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
