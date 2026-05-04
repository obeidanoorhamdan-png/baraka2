// Centralised date formatting so birth dates (and any ISO date) appear
// consistently across the app in clear Arabic ("01 يوليو 2004") regardless
// of how they are stored (ISO `YYYY-MM-DD`, full ISO timestamps, or Date).

const AR_FORMATTER = new Intl.DateTimeFormat("ar-EG", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const AR_SHORT_FORMATTER = new Intl.DateTimeFormat("ar-EG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const parse = (input?: string | Date | null): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  // Accept YYYY-MM-DD or full ISO. Build local date for plain dates so
  // timezone shift doesn't push to the previous day.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Long Arabic format: "01 يوليو 2004". Empty input → fallback. */
export const formatBirthDate = (input?: string | Date | null, fallback = "—"): string => {
  const d = parse(input);
  return d ? AR_FORMATTER.format(d) : fallback;
};

/** Short Arabic numeric: "01/07/2004". */
export const formatDateShort = (input?: string | Date | null, fallback = "—"): string => {
  const d = parse(input);
  return d ? AR_SHORT_FORMATTER.format(d) : fallback;
};
