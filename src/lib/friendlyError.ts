// Maps low-level backend / network errors into short, human-friendly Arabic
// messages. Pass the raw error object (or string) and a key hint for the
// operation context (e.g. "save_draft", "submit", "auth").
export function friendlyError(err: any, ctx?: string): string {
  const raw = (err?.message || err?.error_description || err?.error || err || "").toString();
  const lower = raw.toLowerCase();

  // Network / fetch
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("offline")) {
    return "تعذّر الاتصال بالإنترنت. تأكد من اتصالك ثم حاول مجدداً.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.";
  }

  // Auth
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "رقم الهوية أو الإجابة غير صحيحة.";
  }
  if (lower.includes("jwt") || lower.includes("not authenticated") || lower.includes("auth session missing")) {
    return "انتهت جلستك. يرجى تسجيل الدخول مجدداً.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.";
  }

  // Database constraints
  if (lower.includes("duplicate") || lower.includes("unique") || lower.includes("23505")) {
    return "هذه البيانات مسجلة مسبقاً (رقم هوية مكرر).";
  }
  if (lower.includes("foreign key") || lower.includes("23503")) {
    return "بيانات مرتبطة مفقودة. حدّث الصفحة وحاول مجدداً.";
  }
  if (lower.includes("violates row-level security") || lower.includes("permission denied") || lower.includes("rls")) {
    return "ليست لديك صلاحية لتنفيذ هذا الإجراء.";
  }
  if (lower.includes("not null") || lower.includes("null value")) {
    return "هناك حقل مطلوب فارغ. تحقق من البيانات وأعد المحاولة.";
  }

  // Storage
  if (lower.includes("payload too large") || lower.includes("file size")) {
    return "حجم الملف كبير جداً. اختر صورة أصغر.";
  }
  if (lower.includes("invalid file") || lower.includes("mime")) {
    return "نوع الملف غير مدعوم.";
  }

  // Context-specific fallbacks
  switch (ctx) {
    case "save_draft":
      return "تعذر حفظ المسودة. حاول مجدداً.";
    case "submit":
      return "تعذر إرسال الطلب. تحقق من البيانات وحاول مجدداً.";
    case "load":
      return "تعذر تحميل البيانات. حدّث الصفحة وحاول مجدداً.";
    case "auth":
      return "تعذر إتمام عملية الدخول.";
  }
  return raw || "حدث خطأ غير متوقع. حاول مجدداً.";
}
