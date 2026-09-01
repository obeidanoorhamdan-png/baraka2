// Family accounts sign in with a short code (default: the head of family's birth year).
// The real auth password is derived from that code so it satisfies provider length rules.
export const AUTH_PW_PREFIX = "Baraka2#";

export const toAuthPassword = (code: string) => `${AUTH_PW_PREFIX}${code.trim()}`;

/** Default password for a head of family = birth year (4 digits). */
export const birthYearCode = (birthDate?: string | null) =>
  (birthDate || "").slice(0, 4);

/** Family password rule: exactly 4 digits. */
export const FAMILY_CODE_RE = /^\d{4}$/;

/** Admin password rule: 4+ characters, any letters / digits / symbols. */
export const ADMIN_PW_RE = /^.{4,64}$/;
