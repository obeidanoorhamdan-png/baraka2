// Shared input validation
export const ID_RE = /^\d{9}$/;
export const PHONE_RE = /^(059|056)\d{7}$/;

// Full name = at least 4 non-empty parts (allow Arabic/Latin letters and spaces)
export const isFullName = (v: string) => {
  const parts = v.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 4 && parts.every((p) => p.length >= 2);
};

export const sanitizeDigits = (v: string) => v.replace(/\D/g, "");
