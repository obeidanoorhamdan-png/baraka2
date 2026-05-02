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
  health_notes: "",
});

export const MemberCard = ({
  index,
  member,
  userId,
  onChange,
  onRemove,
}: {
  index: number;
  member: Member;
  userId: string;
  onChange: (m: Member) => void;
  onRemove: () => void;
}) => {
  const { t } = useTranslation();
  const confirmAsk = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [signedPreview, setSignedPreview] = useState<string>("");
  const [localPreview, setLocalPreview] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const age = calculateAge(member.birth_date);
  const showFemaleHealth = member.gender === "female" && age >= 12 && age <= 55;

  useEffect(() => {
    let active = true;
    if (member.injury_report_url && !localPreview) {
      supabase.storage
        .from("medical-reports")
        .createSignedUrl(member.injury_report_url, 3600)
        .then(({ data }) => { if (active && data?.signedUrl) setSignedPreview(data.signedUrl); });
    } else {
      setSignedPreview("");
    }
    return () => { active = false; };
  }, [member.injury_report_url, localPreview]);

  const handleUpload = async (rawFile: File) => {
    if (!rawFile) return;
    setUploading(true);
    try {
      const prepared = await prepareUpload(rawFile);
      const ext = prepared.file.type === "application/pdf" ? "pdf"
        : (prepared.file.type === "image/heic" || prepared.file.type === "image/heif") ? "heic"
        : "jpg";
      const path = `${userId}/${Date.now()}-${index}.${ext}`;
      const { error } = await supabase.storage.from("medical-reports").upload(path, prepared.file, {
        upsert: true,
        contentType: prepared.file.type,
      });
      if (error) throw error;
      onChange({ ...member, injury_report_url: path });
      setLocalPreview(prepared.preview);
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
      else toast.error(e?.message || t("toast.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (!member.injury_report_url) return;
    if (!confirm(t("confirm.remove_file"))) return;
    await supabase.storage.from("medical-reports").remove([member.injury_report_url]);
    onChange({ ...member, injury_report_url: null });
    setLocalPreview("");
    setSignedPreview("");
    toast.success(t("toast.file_removed"));
  };

  return (
    <Card className="p-4 md:p-5 shadow-card border-accent/20 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-primary">{t("family.person")} #{index + 1}</h4>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => { if (confirm(t("confirm.remove_person"))) onRemove(); }}
          className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>{t("form.full_name")} <span className="text-destructive">*</span></Label>
          <Input value={member.full_name} placeholder="الاسم الأول الأب الجد العائلة"
            onChange={(e) => onChange({ ...member, full_name: e.target.value })} />
        </div>
        <div>
          <Label>{t("form.national_id")}</Label>
          <Input inputMode="numeric" maxLength={9} value={member.national_id}
            placeholder="9 أرقام (اختياري للأطفال)"
            onChange={(e) => onChange({ ...member, national_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
        </div>
        <div>
          <Label>{t("form.birth_date")}</Label>
          <Input type="date" value={member.birth_date} onChange={(e) => onChange({ ...member, birth_date: e.target.value })} />
          {member.birth_date && <div className="text-xs text-muted-foreground mt-1">{t("form.age")}: {age} {t("form.years")}</div>}
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
          <Label>{t("family.relationship")}</Label>
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
            <Input className="mt-2" placeholder={t("form.specify")} value={member.relationship_other || ""}
              onChange={(e) => onChange({ ...member, relationship_other: e.target.value })} />
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
            <div className="mt-2 space-y-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                id={`upload-${index}`}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              {!member.injury_report_url ? (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                    <label htmlFor={`upload-${index}`} className="cursor-pointer gap-2">
                      <Upload className="h-4 w-4" />
                      {uploading ? t("health.uploading") : t("health.upload_report")}
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("health.upload_hint")}</p>
                  <p className="text-xs text-destructive">{t("health.report_required")}</p>
                </>
              ) : (
                <div className="flex items-start gap-3 p-2 rounded-md border border-success/30 bg-success/5">
                  {(localPreview || signedPreview) && !member.injury_report_url.endsWith(".pdf") ? (
                    <a href={signedPreview || localPreview} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={localPreview || signedPreview}
                        alt={t("health.upload_report")}
                        className="h-16 w-16 object-cover rounded-md ring-1 ring-success/30"
                      />
                    </a>
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <FileImage className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-success">✓ {t("health.report_uploaded")}</div>
                    <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
                      {member.injury_report_url.split("/").pop()}
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <Button type="button" variant="outline" size="sm" disabled={uploading} asChild className="h-7 px-2 text-xs">
                        <label htmlFor={`upload-${index}`} className="cursor-pointer gap-1">
                          <Replace className="h-3 w-3" /> {t("health.replace")}
                        </label>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1">
                        <X className="h-3 w-3" /> {t("health.remove")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">{t("health.chronic")}</Label>
          <Textarea rows={2} value={member.chronic_diseases}
            onChange={(e) => onChange({ ...member, chronic_diseases: e.target.value })} />
        </div>
        {showFemaleHealth && (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={member.is_pregnant} onCheckedChange={(v) => onChange({ ...member, is_pregnant: !!v })} />
              {t("health.is_pregnant")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={member.is_breastfeeding} onCheckedChange={(v) => onChange({ ...member, is_breastfeeding: !!v })} />
              {t("health.is_breastfeeding")}
            </label>
          </div>
        )}
        <div>
          <Label className="text-xs">{t("health.notes")}</Label>
          <Textarea rows={2} value={member.health_notes}
            onChange={(e) => onChange({ ...member, health_notes: e.target.value })} />
        </div>
      </div>
    </Card>
  );
};
