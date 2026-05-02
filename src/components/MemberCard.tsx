import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, UserPlus, Upload, FileImage } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
  const age = calculateAge(member.birth_date);
  const showFemaleHealth = member.gender === "female" && age >= 12 && age <= 55;

  const handleUpload = async (file: File) => {
    if (!file) return;
    const okType = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type) || file.type === "application/pdf";
    if (!okType) { toast.error(t("toast.invalid_file_type")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("toast.file_too_large")); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${userId}/${Date.now()}-${index}.${ext}`;
    const { error } = await supabase.storage.from("medical-reports").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    onChange({ ...member, injury_report_url: path });
    toast.success(t("toast.report_uploaded"));
  };

  return (
    <Card className="p-4 md:p-5 shadow-card border-accent/20 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-primary">{t("family.person")} #{index + 1}</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:bg-destructive/10">
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
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                <label htmlFor={`upload-${index}`} className="cursor-pointer gap-2">
                  <Upload className="h-4 w-4" />
                  {uploading ? "..." : t("health.upload_report")}
                </label>
              </Button>
              {member.injury_report_url && (
                <div className="flex items-center gap-1 text-xs text-success">
                  <FileImage className="h-3.5 w-3.5" /> {member.injury_report_url.split("/").pop()}
                </div>
              )}
              {!member.injury_report_url && (
                <p className="text-xs text-destructive">{t("health.report_required")}</p>
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
