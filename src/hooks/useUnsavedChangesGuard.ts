import { useEffect } from "react";

/**
 * Warns the user (via the browser dialog) when they try to leave the page
 * while `when` is true (unsaved draft).
 *
 * NOTE: We intentionally do NOT use `useBlocker` from react-router here —
 * it requires a Data Router (`createBrowserRouter` + `RouterProvider`),
 * and this app uses the classic `<BrowserRouter>`. Calling `useBlocker`
 * in that context throws an empty-message runtime error that crashes the
 * page with a blank screen (notably when entering edit mode on
 * /my-application). The browser-level `beforeunload` guard still covers
 * tab close / refresh / hard navigation — which is the most important
 * data-loss scenario.
 *
 * The second `confirmAsk` argument is kept for backwards compatibility so
 * existing callers don't need to change.
 */
export function useUnsavedChangesGuard(
  when: boolean,
  _confirmAsk?: unknown,
) {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);
}
