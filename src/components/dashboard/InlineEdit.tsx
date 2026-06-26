import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "number" | "tel" | "date" | "select" | "switch";

interface Option { v: string; l: string }

interface Props {
  value: any;
  type?: FieldType;
  options?: Option[];
  placeholder?: string;
  dir?: "ltr" | "rtl";
  numeric?: boolean;
  maxLength?: number;
  /** Custom display renderer (e.g. formatted date). */
  display?: (v: any) => ReactNode;
  /** Persist the new value. Return true on success. */
  onSave: (v: any) => Promise<boolean>;
  className?: string;
}

const labelFor = (options: Option[] | undefined, v: any) =>
  options?.find((o) => o.v === v)?.l ?? v;

export const InlineEdit = ({
  value, type = "text", options, placeholder = "اضغط للإضافة",
  dir, numeric, maxLength, display, onSave, className,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(value ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value ?? ""); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async (next: any) => {
    const normalized = next === "" ? null : next;
    if (normalized === (value ?? null)) { setEditing(false); return; }
    setSaving(true);
    const ok = await onSave(normalized);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } else {
      setDraft(value ?? "");
    }
    setEditing(false);
  };

  // Switch saves immediately, never enters "editing" text mode.
  if (type === "switch") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Switch
          checked={!!value}
          disabled={saving}
          onCheckedChange={async (c) => { setSaving(true); await onSave(c); setSaving(false); }}
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  if (editing) {
    if (type === "select") {
      return (
        <Select
          open
          value={value ?? ""}
          onValueChange={(v) => commit(v)}
          onOpenChange={(o) => { if (!o) setEditing(false); }}
        >
          <SelectTrigger className="h-9 w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {options?.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        ref={inputRef}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        dir={dir}
        value={draft ?? ""}
        placeholder={placeholder}
        className="h-9"
        onChange={(e) => {
          let v = e.target.value;
          if (numeric) v = v.replace(/\D/g, "");
          if (maxLength) v = v.slice(0, maxLength);
          setDraft(v);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(draft); }
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
      />
    );
  }

  const isEmpty = value === null || value === undefined || value === "";
  const shown = isEmpty
    ? placeholder
    : display
      ? display(value)
      : type === "select"
        ? labelFor(options, value)
        : value;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      dir={dir}
      className={cn(
        "group inline-flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-right",
        "border border-transparent transition-colors hover:border-accent/40 hover:bg-accent-soft/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isEmpty && "text-muted-foreground/70 italic",
        className,
      )}
    >
      <span className="min-w-0 truncate font-semibold text-foreground">{shown}</span>
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : saved ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-accent" />
      )}
    </button>
  );
};
