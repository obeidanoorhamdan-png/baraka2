import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerFieldProps {
  /** ISO date string YYYY-MM-DD */
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Earliest selectable year. Default 1900 */
  minYear?: number;
  /** Latest selectable year. Default current year */
  maxYear?: number;
  /** Disallow future dates (useful for birth dates / aid delivery dates) */
  disableFuture?: boolean;
  /** Disallow past dates */
  disablePast?: boolean;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /** Auto-open the calendar when mounted (great for security questions) */
  autoOpen?: boolean;
}

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseIso = (v?: string): Date | undefined => {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
};

const formatArabic = (d: Date) => {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return toIso(d);
  }
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * Birth-date / generic date picker that opens a calendar overlay.
 * Designed for users who struggle with the native "type=date" formats.
 * Includes year + month dropdowns so navigating decades is fast.
 */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = "اختر التاريخ",
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  disableFuture,
  disablePast,
  className,
  invalid,
  disabled,
  id,
  autoOpen,
}) => {
  const selected = parseIso(value);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(selected ?? new Date(maxYear, 0, 1));

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  // Auto-open shortly after mount so users immediately see the calendar
  // (eliminates confusion about a "small arrow" — the picker opens itself).
  React.useEffect(() => {
    if (!autoOpen || disabled) return;
    const t = setTimeout(() => setOpen(true), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const years = React.useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const disabledMatcher = React.useMemo(() => {
    return (d: Date) => {
      if (disableFuture && d > today) return true;
      if (disablePast && d < today) return true;
      const y = d.getFullYear();
      if (y < minYear || y > maxYear) return true;
      return false;
    };
  }, [disableFuture, disablePast, minYear, maxYear]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onClick={() => setOpen(true)}
          className={cn(
            "w-full justify-between text-start font-normal h-11 gap-2",
            !selected && "text-muted-foreground",
            invalid && "border-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <span className="flex-1 text-start">{selected ? formatArabic(selected) : placeholder}</span>
          <CalendarIcon className="h-5 w-5 text-primary opacity-90 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-50 bg-popover"
        align="start"
        side="bottom"
      >
        <div className="p-3 space-y-3">
          {/* Year + Month quick selectors — critical for birth dates */}
          <div className="flex gap-2">
            <select
              aria-label="السنة"
              value={month.getFullYear()}
              onChange={(e) => {
                const y = Number(e.target.value);
                setMonth(new Date(y, month.getMonth(), 1));
              }}
              className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              aria-label="الشهر"
              value={month.getMonth()}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(new Date(month.getFullYear(), m, 1));
              }}
              className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {MONTHS_AR.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>

          <Calendar
            mode="single"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => {
              if (d) {
                onChange(toIso(d));
                setOpen(false);
              }
            }}
            disabled={disabledMatcher}
            showOutsideDays
            classNames={{ caption: "hidden" }}
            className="pointer-events-auto"
          />

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              مسح التاريخ
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
