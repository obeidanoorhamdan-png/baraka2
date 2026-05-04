import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar.json";

// Site is Arabic-only by design. We keep i18next for the existing t() calls
// throughout the app, but no language detection or switching is exposed.
i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
  },
  lng: "ar",
  fallbackLng: "ar",
  supportedLngs: ["ar"],
  interpolation: { escapeValue: false },
});

// Force RTL Arabic on the document.
try {
  localStorage.setItem("i18nextLng", "ar");
} catch {}
document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

export default i18n;
