import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
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

          <DayPicker
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
            className="pointer-events-auto"
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              caption: "hidden",
              nav: "flex items-center justify-between",
              nav_button: cn(
                buttonVariants({ variant: "outline" }),
                "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
              ),
              nav_button_previous: "",
              nav_button_next: "",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.75rem]",
              row: "flex w-full mt-1",
              cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
              day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-40",
              day_disabled: "text-muted-foreground opacity-30",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
            }}
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
