/**
 * Service worker registration with safety guards:
 * - Skip when running inside an iframe (Lovable preview)
 * - Skip on Lovable preview hostnames
 * - Skip in development
 * - Auto-unregister stale workers in unsafe contexts
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") === false && host.includes("localhost");

  const isDev = import.meta.env.DEV;

  if (isInIframe || isPreviewHost || isDev) {
    // Clean up any previously-installed SW so the iframe preview never
    // serves stale content.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    return;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // The PWA plugin auto-generates /sw.js and the registration helper
      // via virtual:pwa-register. We do a manual registration to keep the
      // iframe guard above explicit and easy to audit.
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
  }
}
