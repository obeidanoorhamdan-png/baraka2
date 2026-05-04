import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, CloudUpload, History } from "lucide-react";
import { onSyncState, drainOutbox } from "@/lib/syncEngine";
import { SyncLogDialog } from "./SyncLogDialog";

/**
 * Floating status pill — sits at the bottom of the screen and tells the
 * user whether they are online, how many changes are waiting to sync, and
 * lets them retry or open the full sync log.
 */
export const OfflineStatusBar = () => {
  const [state, setState] = useState({ online: true, pending: 0, syncing: false });
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    const off = onSyncState(setState);
    return () => { off(); };
  }, []);

  // Hide entirely when everything is synced and we're online — no clutter
  // for the happy path. The user can still open the log via the sync icon
  // in any page header that includes it (or programmatically).
  const hidden = state.online && state.pending === 0 && !state.syncing;

  const offline = !state.online;
  const tone = offline
    ? "bg-destructive text-destructive-foreground"
    : state.syncing
    ? "bg-accent text-accent-foreground"
    : state.pending > 0
    ? "bg-warning text-warning-foreground"
    : "bg-success text-white";

  const Icon = offline ? CloudOff : state.syncing ? RefreshCw : state.pending > 0 ? CloudUpload : CheckCircle2;

  const label = offline
    ? `أنت خارج الاتصال — التعديلات تُحفظ محلياً وسترفع تلقائياً`
    : state.syncing
    ? `جاري المزامنة... (${state.pending} عنصر)`
    : state.pending > 0
    ? `${state.pending} تعديل بانتظار المزامنة`
    : `تمت المزامنة`;

  return (
    <>
      {!hidden && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] max-w-[95vw] animate-fade-in"
        >
          <div
            className={`flex items-center gap-2 rounded-full ${tone} shadow-lg px-3 py-2 text-sm font-bold border border-white/20 backdrop-blur`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${state.syncing ? "animate-spin" : ""}`} />
            <span className="truncate max-w-[55vw]">{label}</span>
            {!offline && state.pending > 0 && !state.syncing && (
              <button
                type="button"
                onClick={() => drainOutbox()}
                className="ms-1 rounded-full bg-white/25 hover:bg-white/40 transition-colors px-2 py-0.5 text-xs font-extrabold"
              >
                مزامنة
              </button>
            )}
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="ms-1 rounded-full bg-white/25 hover:bg-white/40 transition-colors p-1"
              title="سجل المزامنة"
            >
              <History className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <SyncLogDialog open={logOpen} onOpenChange={setLogOpen} />
    </>
  );
};
