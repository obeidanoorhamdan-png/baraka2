import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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
  /** Kept for backwards compatibility — ignored in this implementation. */
  autoOpen?: boolean;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const pad = (n: number) => String(n).padStart(2, "0");

const parse = (v?: string): { y: string; m: string; d: string } => {
  if (!v) return { y: "", m: "", d: "" };
  const [y, m, d] = v.split("-");
  return { y: y || "", m: m || "", d: d || "" };
};

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * Robust birth-date / generic date picker built from three native <select>
 * dropdowns (day / month / year). We intentionally avoid react-day-picker
 * here — that library has repeatedly crashed in production with
 * "Cannot access 'Oe' before initialization" inside its internal hooks,
 * which leaves the user with a blank screen. Native selects:
 *   • cannot crash the React tree,
 *   • give the OS-native picker on mobile (the user explicitly asked for a
 *     dropdown, not a popup),
 *   • work in RTL Arabic without extra wiring.
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
}) => {
  const { y, m, d } = parse(value);

  const years = React.useMemo(() => {
    const arr: number[] = [];
    const cap = disableFuture ? Math.min(maxYear, new Date().getFullYear()) : maxYear;
    const floor = disablePast ? Math.max(minYear, new Date().getFullYear()) : minYear;
    for (let yr = cap; yr >= floor; yr--) arr.push(yr);
    return arr;
  }, [minYear, maxYear, disableFuture, disablePast]);

  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  const dayCount = !isNaN(yNum) && !isNaN(mNum) ? daysInMonth(yNum, mNum) : 31;
  const days = React.useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const emit = (ny: string, nm: string, nd: string) => {
    // Allow partial selection — keep whatever the user picked so far,
    // and only emit a full ISO date once all three parts exist.
    if (!ny && !nm && !nd) {
      onChange("");
      return;
    }
    if (ny && nm && nd) {
      const max = daysInMonth(parseInt(ny, 10), parseInt(nm, 10));
      const safeD = Math.min(parseInt(nd, 10), max);
      onChange(`${ny}-${pad(parseInt(nm, 10))}-${pad(safeD)}`);
    } else {
      // Partial — store as a sentinel so the selects keep showing the user's
      // choices. Parent treats anything not matching YYYY-MM-DD as "empty".
      onChange(`${ny || "____"}-${nm || "__"}-${nd || "__"}`);
    }
  };

  const baseSelect = cn(
    "h-11 rounded-md border bg-background px-2 text-sm font-medium",
    "focus:outline-none focus:ring-2 focus:ring-primary/40",
    invalid ? "border-destructive" : "border-input",
    disabled && "opacity-50 cursor-not-allowed",
  );

  return (
    <div
      id={id}
      className={cn("flex items-stretch gap-2", className)}
      onBlur={onBlur}
    >
      <div className="flex items-center justify-center px-2 rounded-md bg-accent-soft/40 text-primary shrink-0">
        <CalendarIcon className="h-5 w-5" />
      </div>
      <select
        aria-label="اليوم"
        disabled={disabled}
        value={d}
        onChange={(e) => emit(y, m, e.target.value)}
        className={cn(baseSelect, "flex-1 min-w-0")}
      >
        <option value="">يوم</option>
        {days.map((n) => (
          <option key={n} value={pad(n)}>{n}</option>
        ))}
      </select>
      <select
        aria-label="الشهر"
        disabled={disabled}
        value={m}
        onChange={(e) => emit(y, e.target.value, d)}
        className={cn(baseSelect, "flex-[1.4] min-w-0")}
      >
        <option value="">شهر</option>
        {MONTHS_AR.map((name, idx) => (
          <option key={idx} value={pad(idx + 1)}>{name}</option>
        ))}
      </select>
      <select
        aria-label="السنة"
        disabled={disabled}
        value={y}
        onChange={(e) => emit(e.target.value, m, d)}
        className={cn(baseSelect, "flex-1 min-w-0")}
      >
        <option value="">سنة</option>
        {years.map((yr) => (
          <option key={yr} value={String(yr)}>{yr}</option>
        ))}
      </select>
    </div>
  );
};
