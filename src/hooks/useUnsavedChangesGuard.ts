import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Warns the user (via the browser dialog and an in-app confirm callback)
 * when they try to leave the page while `when` is true (unsaved draft).
 *
 * - `confirmAsk` should return a boolean Promise (true = leave, false = stay).
 *   Pass our existing ConfirmDialog `useConfirm()` function.
 */
export function useUnsavedChangesGuard(
  when: boolean,
  confirmAsk: (opts: { title: string; description: string; confirmText: string; cancelText: string; variant?: any }) => Promise<boolean>,
) {
  // 1) Browser-level: tab close, refresh, history navigation outside SPA.
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  // 2) In-app navigation: react-router blocker + confirm dialog.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return when && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    (async () => {
      const ok = await confirmAsk({
        title: "هل تريد المغادرة؟",
        description: "لديك تغييرات لم تُحفظ بعد. ستفقد ما أدخلته إذا غادرت الآن.",
        confirmText: "مغادرة بدون حفظ",
        cancelText: "البقاء في الصفحة",
        variant: "warning",
      });
      if (ok) blocker.proceed?.();
      else blocker.reset?.();
    })();
  }, [blocker, confirmAsk]);
}
