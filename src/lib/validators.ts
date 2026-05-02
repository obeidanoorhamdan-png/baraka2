// Shared input validation
export const ID_RE = /^\d{9}$/;
export const PHONE_RE = /^(059|056)\d{7}$/;

// Full name = at least 4 non-empty parts (Arabic / Latin letters), each ≥ 2 chars,
// and only letters / spaces / hyphens / apostrophes (no digits or symbols).
const NAME_PART_RE = /^[A-Za-z\u0600-\u06FF'’\-]+$/;
export const isFullName = (v: string) => {
  const parts = v.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 4) return false;
  return parts.every((p) => p.length >= 2 && NAME_PART_RE.test(p));
};

export const sanitizeDigits = (v: string) => v.replace(/\D/g, "");

// Build the synthetic email used internally for an account based on national_id.
// The end-user never sees or types this — they sign in with national_id only.
export const idToEmail = (nid: string) => `${nid}@baraka2.local`;

// Admin reserved national_id
export const ADMIN_NID = "000000000";
