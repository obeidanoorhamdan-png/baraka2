import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload, FileImage, Replace, X, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { calculateAge } from "@/lib/age";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { prepareUpload, formatBytes } from "@/lib/imageUpload";
import { useConfirm } from "@/components/ConfirmDialog";

export type Member = {
  id?: string;
  full_name: string;
  national_id: string;
  birth_date: string;
  gender: "male" | "female";
  relationship: "wife" | "husband" | "son" | "daughter" | "father" | "mother" | "brother" | "sister" | "other";
  relationship_other?: string;
  is_war_injured: boolean;
  injury_report_url?: string | null;
  chronic_diseases: string;
  is_pregnant: boolean;
  is_breastfeeding: boolean;
  pregnancy_report_url?: string | null;
  health_notes: string;
};

export const emptyMember = (): Member => ({
  full_name: "",
  national_id: "",
  birth_date: "",
  gender: "male",
  relationship: "son",
  relationship_other: "",
  is_war_injured: false,
  injury_report_url: null,
  chronic_diseases: "",
  is_pregnant: false,
  is_breastfeeding: false,
  pregnancy_report_url: null,
  health_notes: "",
});

type FieldKey = "injury_report_url" | "pregnancy_report_url";

export const MemberCard = ({
  index,
  total,
  member,
  userId,
  onChange,
  onRemove,
  onSave,
  errors = {},
  onFieldBlur,
}: {
  index: number;
  total?: number;
  member: Member;
  userId: string;
  onChange: (m: Member) => void;
  onRemove?: () => void;
  onSave?: () => void;
  errors?: Record<string, string>;
  onFieldBlur?: (field: string) => void;
}) => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [uploading, setUploading] = useState<FieldKey | null>(null);
  const [signedPreviews, setSignedPreviews] = useState<Record<FieldKey, string>>({ injury_report_url: "", pregnancy_report_url: "" });
  const [localPreviews, setLocalPreviews] = useState<Record<FieldKey, string>>({ injury_report_url: "", pregnancy_report_url: "" });
  const [dragOver, setDragOver] = useState<FieldKey | null>(null);
  const age = calculateAge(member.birth_date);
  const showFemaleHealth = member.gender === "female" && age >= 12 && age <= 55;

  useEffect(() => {
    let active = true;
    (["injury_report_url", "pregnancy_report_url"] as FieldKey[]).forEach((field) => {
      const path = member[field];
      if (path && !localPreviews[field]) {
        supabase.storage.from("medical-reports").createSignedUrl(path, 3600)
          .then(({ data }) => { if (active && data?.signedUrl) setSignedPreviews((p) => ({ ...p, [field]: data.signedUrl })); });
      } else if (!path) {
        setSignedPreviews((p) => ({ ...p, [field]: "" }));
      }
    });
    return () => { active = false; };
  }, [member.injury_report_url, member.pregnancy_report_url]);

  const handleUpload = async (rawFile: File, field: FieldKey) => {
    if (!rawFile) return;
    setUploading(field);
    try {
      const prepared = await prepareUpload(rawFile);
      const ext = prepared.file.type === "application/pdf" ? "pdf"
        : (prepared.file.type === "image/heic" || prepared.file.type === "image/heif") ? "heic"
        : "jpg";
      const path = `${userId}/${Date.now()}-${index}-${field}.${ext}`;
      const { error } = await supabase.storage.from("medical-reports").upload(path, prepared.file, {
        upsert: true, contentType: prepared.file.type,
      });
      if (error) throw error;
      onChange({ ...member, [field]: path });
      setLocalPreviews((p) => ({ ...p, [field]: prepared.preview }));
      const saved = prepared.originalSize - prepared.finalSize;
      if (saved > 50 * 1024) {
        toast.success(`${t("toast.report_uploaded")} (${formatBytes(prepared.originalSize)} → ${formatBytes(prepared.finalSize)})`);
      } else {
        toast.success(t("toast.report_uploaded"));
      }
    } catch (e: any) {
      const code = e?.message;
      if (code === "invalid_file_type") toast.error(t("toast.invalid_file_type"));
      else if (code === "file_too_large") toast.error(t("toast.file_too_large"));
      else if (code === "image_too_large_dimensions") toast.error(t("toast.image_too_large_dimensions"));
      else toast.error(e?.message || t("toast.error"));
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = async (field: FieldKey) => {
    const path = member[field];
    if (!path) return;
    if (!(await confirmAsk({
      title: t("confirm.remove_file_title"),
      description: t("confirm.remove_file"),
      confirmText: t("health.remove"),
      variant: "danger",
    }))) return;
    await supabase.storage.from("medical-reports").remove([path]);
    onChange({ ...member, [field]: null });
    setLocalPreviews((p) => ({ ...p, [field]: "" }));
    setSignedPreviews((p) => ({ ...p, [field]: "" }));
    toast.success(t("toast.file_removed"));
  };

  const handleDrop = (e: React.DragEvent, field: FieldKey) => {
    e.preventDefault();
    setDragOver(null);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f, field);
  };

  const errCls = (k: string) => errors[k] ? "border-destructive focus-visible:ring-destructive" : "";
  const errMsg = (k: string) => errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <Card className="p-4 md:p-5 shadow-elegant border-accent/30 animate-fade-in">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent/15 text-accent w-9 h-9 flex items-center justify-center font-bold">
            {index + 1}
          </div>
          <div>
            <h4 className="font-bold text-primary">
              {t("family.person")} {index + 1}{total ? ` / ${total}` : ""}
            </h4>
            {member.full_name && <div className="text-xs text-muted-foreground">{member.full_name}</div>}
          </div>
        </div>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm"
            onClick={async () => {
              if (await confirmAsk({
                title: t("confirm.remove_person_title"),
                description: t("confirm.remove_person"),
                confirmText: t("family.remove"),
                variant: "danger",
              })) onRemove();
            }}
            className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>{t("form.full_name")} <span className="text-destructive">*</span></Label>
          <Input value={member.full_name} placeholder="الاسم الأول الأب الجد العائلة"
            aria-invalid={!!errors.full_name}
            className={errCls("full_name")}
            onBlur={() => onFieldBlur?.("full_name")}
            onChange={(e) => onChange({ ...member, full_name: e.target.value })} />
          {errMsg("full_name")}
        </div>
        <div>
          <Label>{t("form.national_id")}</Label>
          <Input inputMode="numeric" maxLength={9} value={member.national_id}
            placeholder="9 أرقام (اختياري للأطفال)"
            aria-invalid={!!errors.national_id}
            className={errCls("national_id")}
            onBlur={() => onFieldBlur?.("national_id")}
            onChange={(e) => onChange({ ...member, national_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
          {errMsg("national_id")}
        </div>
        <div>
          <Label>{t("form.birth_date")} <span className="text-destructive">*</span></Label>
          <Input type="date" value={member.birth_date}
            max={new Date().toISOString().split("T")[0]}
            aria-invalid={!!errors.birth_date}
            className={errCls("birth_date")}
            onBlur={() => onFieldBlur?.("birth_date")}
            onChange={(e) => onChange({ ...member, birth_date: e.target.value })} />
          {errMsg("birth_date")}
          {member.birth_date && !errors.birth_date && <div className="text-xs text-muted-foreground mt-1">{t("form.age")}: {age} {t("form.years")}</div>}
        </div>
        <div>
          <Label>{t("form.gender")}</Label>
          <Select value={member.gender} onValueChange={(v) => onChange({ ...member, gender: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t("form.male")}</SelectItem>
              <SelectItem value="female">{t("form.female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>{t("family.relationship")} <span className="text-destructive">*</span></Label>
          <Select value={member.relationship} onValueChange={(v) => onChange({ ...member, relationship: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wife">{t("family.rel_wife")}</SelectItem>
              <SelectItem value="husband">{t("family.rel_husband")}</SelectItem>
              <SelectItem value="son">{t("family.rel_son")}</SelectItem>
              <SelectItem value="daughter">{t("family.rel_daughter")}</SelectItem>
              <SelectItem value="father">{t("family.rel_father")}</SelectItem>
              <SelectItem value="mother">{t("family.rel_mother")}</SelectItem>
              <SelectItem value="brother">{t("family.rel_brother")}</SelectItem>
              <SelectItem value="sister">{t("family.rel_sister")}</SelectItem>
              <SelectItem value="other">{t("family.rel_other")}</SelectItem>
            </SelectContent>
          </Select>
          {member.relationship === "other" && (
            <>
              <Input className={`mt-2 ${errCls("relationship_other")}`} placeholder={t("form.specify")} value={member.relationship_other || ""}
                onBlur={() => onFieldBlur?.("relationship_other")}
                onChange={(e) => onChange({ ...member, relationship_other: e.target.value })} />
              {errMsg("relationship_other")}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-accent-soft/40 border border-accent/20 space-y-3">
        <h5 className="font-semibold text-primary text-sm">{t("health.title")}</h5>
        <div>
          <Label className="text-xs">{t("health.is_war_injured")}</Label>
          <RadioGroup className="flex gap-4 mt-1" value={member.is_war_injured ? "yes" : "no"}
            onValueChange={(v) => onChange({ ...member, is_war_injured: v === "yes" })}>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" />{t("health.yes")}</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" />{t("health.no")}</label>
          </RadioGroup>
          {member.is_war_injured && (
            <UploadBlock
              field="injury_report_url"
              index={index}
              path={member.injury_report_url || ""}
              uploading={uploading === "injury_report_url"}
              dragOver={dragOver === "injury_report_url"}
              localPreview={localPreviews.injury_report_url}
              signedPreview={signedPreviews.injury_report_url}
              onUpload={(f) => handleUpload(f, "injury_report_url")}
              onRemove={() => handleRemoveFile("injury_report_url")}
              setDragOver={(v) => setDragOver(v ? "injury_report_url" : null)}
              onDrop={(e) => handleDrop(e, "injury_report_url")}
              requiredText={t("health.report_required")}
              uploadLabel={t("health.upload_report")}
              uploadingLabel={t("health.uploading")}
              hintLabel={t("health.upload_hint")}
              secureLabel={t("health.upload_secure")}
              uploadedLabel={t("health.report_uploaded")}
              replaceLabel={t("health.replace")}
              removeLabel={t("health.remove")}
              error={errors.injury_report_url}
            />
          )}
        </div>
        <div>
          <Label className="text-xs">{t("health.chronic")}</Label>
          <Textarea rows={2} value={member.chronic_diseases}
            onChange={(e) => onChange({ ...member, chronic_diseases: e.target.value })} />
        </div>
        {showFemaleHealth && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={member.is_pregnant} onCheckedChange={(v) => onChange({ ...member, is_pregnant: !!v, pregnancy_report_url: v ? member.pregnancy_report_url : null })} />
                {t("health.is_pregnant")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={member.is_breastfeeding} onCheckedChange={(v) => onChange({ ...member, is_breastfeeding: !!v })} />
                {t("health.is_breastfeeding")}
              </label>
            </div>
            {member.is_pregnant && (
              <div>
                <Label className="text-xs">{t("health_extra.pregnancy_report")} <span className="text-destructive">*</span></Label>
                <UploadBlock
                  field="pregnancy_report_url" index={index}
                  path={member.pregnancy_report_url || ""}
                  uploading={uploading === "pregnancy_report_url"}
                  dragOver={dragOver === "pregnancy_report_url"}
                  localPreview={localPreviews.pregnancy_report_url}
                  signedPreview={signedPreviews.pregnancy_report_url}
                  onUpload={(f) => handleUpload(f, "pregnancy_report_url")}
                  onRemove={() => handleRemoveFile("pregnancy_report_url")}
                  setDragOver={(v) => setDragOver(v ? "pregnancy_report_url" : null)}
                  onDrop={(e) => handleDrop(e, "pregnancy_report_url")}
                  requiredText={t("health_extra.pregnancy_required")}
                  uploadLabel={t("health_extra.pregnancy_report")}
                  uploadingLabel={t("health.uploading")}
                  hintLabel={t("health.upload_hint")}
                  secureLabel={t("health.upload_secure")}
                  uploadedLabel={t("health_extra.pregnancy_uploaded")}
                  replaceLabel={t("health.replace")}
                  removeLabel={t("health.remove")}
                  error={errors.pregnancy_report_url}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <Label className="text-xs">{t("health.notes")}</Label>
          <Textarea rows={2} value={member.health_notes}
            onChange={(e) => onChange({ ...member, health_notes: e.target.value })} />
        </div>
      </div>
      {onSave && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Button type="button" onClick={onSave}
            className="gold-gradient text-accent-foreground shadow-gold gap-2">
            <ShieldCheck className="h-4 w-4" /> {t("form.save_member")}
          </Button>
        </div>
      )}
    </Card>
  );
};

// ----- Reusable upload block -----
const UploadBlock = ({
  field, index, path, uploading, dragOver, localPreview, signedPreview,
  onUpload, onRemove, setDragOver, onDrop,
  requiredText, uploadLabel, uploadingLabel, hintLabel, secureLabel, uploadedLabel, replaceLabel, removeLabel, error,
}: {
  field: string; index: number; path: string;
  uploading: boolean; dragOver: boolean;
  localPreview: string; signedPreview: string;
  onUpload: (f: File) => void; onRemove: () => void;
  setDragOver: (v: boolean) => void; onDrop: (e: React.DragEvent) => void;
  requiredText: string; uploadLabel: string; uploadingLabel: string; hintLabel: string;
  secureLabel: string; uploadedLabel: string; replaceLabel: string; removeLabel: string;
  error?: string;
}) => {
  const inputId = `upload-${field}-${index}`;
  return (
    <div className="mt-2 space-y-2">
      <input type="file" accept="image/*,application/pdf" id={inputId} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      {!path ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
            error ? "border-destructive bg-destructive/5" :
            dragOver ? "border-accent bg-accent-soft/50" : "border-accent/30 bg-background"
          }`}
        >
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <label htmlFor={inputId} className="cursor-pointer gap-2">
              {uploading ? <span className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? uploadingLabel : uploadLabel}
            </label>
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{hintLabel}</p>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-1">
            <ShieldCheck className="h-3 w-3 text-success" /> {secureLabel}
          </p>
          <p className="text-xs text-destructive mt-1">{error || requiredText}</p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-2 rounded-md border border-success/30 bg-success/5">
          {(localPreview || signedPreview) && !path.endsWith(".pdf") ? (
            <a href={signedPreview || localPreview} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={localPreview || signedPreview} alt={uploadLabel}
                className="h-16 w-16 object-cover rounded-md ring-1 ring-success/30" />
            </a>
          ) : (
            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
              <FileImage className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-success">✓ {uploadedLabel}</div>
            <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{path.split("/").pop()}</div>
            <div className="flex gap-1 mt-1.5">
              <Button type="button" variant="outline" size="sm" disabled={uploading} asChild className="h-7 px-2 text-xs">
                <label htmlFor={inputId} className="cursor-pointer gap-1">
                  <Replace className="h-3 w-3" /> {replaceLabel}
                </label>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1">
                <X className="h-3 w-3" /> {removeLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
