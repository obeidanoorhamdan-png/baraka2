import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Trash2, RefreshCw, X, History, Loader2, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listOps,
  listHistory,
  deleteOp,
  clearHistory,
  onOutboxChange,
  purgeAllLocal,
  estimateLocalUsage,
  type OutboxOp,
  type SyncHistoryEntry,
} from "@/lib/offlineOutbox";
import { drainOutbox, onSyncState, type SyncState } from "@/lib/syncEngine";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} ب`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(2)} م.ب`;
};

/**
 * Sync log + pending operations viewer. Lets the user see exactly which
 * changes are queued, retry them, delete a stuck op, or wipe all local
 * data when the app is misbehaving.
 */
export const SyncLogDialog = ({ open, onOpenChange }: Props) => {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({ online: true, pending: 0, syncing: false, currentOpId: null, currentOpProgress: 0 });
  const [usage, setUsage] = useState<{ ops: number; cache: number; history: number; total: number } | null>(null);
  const confirmAsk = useConfirm();

  const refresh = async () => {
    setLoading(true);
    const [o, h, u] = await Promise.all([listOps(), listHistory(), estimateLocalUsage()]);
    setOps(o);
    setHistory(h);
    setUsage(u);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const off1 = onOutboxChange(() => { refresh(); });
    const off2 = onSyncState(setSyncState);
    return () => { off1(); off2(); };
  }, [open]);

  const removeOp = async (id: number, label: string) => {
    const ok = await confirmAsk({
      title: "حذف العملية المعلقة",
      description: `سيتم حذف "${label}" نهائياً من طابور المزامنة. هل أنت متأكد؟`,
      confirmText: "حذف",
      variant: "danger",
    });
    if (!ok) return;
    await deleteOp(id);
    toast.success("تم حذف العملية");
  };

  const purgeAll = async () => {
    const ok = await confirmAsk({
      title: "تنظيف البيانات المحلية",
      description:
        "سيتم حذف جميع البيانات المخزنة على هذا الجهاز (المسودات، الكاش، الطابور، السجل). البيانات على الخادم لن تتأثر. هل تريد المتابعة؟",
      confirmText: "حذف الكل",
      variant: "danger",
    });
    if (!ok) return;
    await purgeAllLocal();
    toast.success("تم تنظيف البيانات المحلية");
    setTimeout(() => window.location.reload(), 800);
  };

  const fmtTime = (t: number) => new Date(t).toLocaleString("ar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary flex items-center gap-2">
            <History className="h-5 w-5 text-accent" /> سجل المزامنة
          </DialogTitle>
          <DialogDescription>
            استعرض العمليات المعلقة بانتظار رفعها، أعد المحاولة، أو نظّف البيانات المحلية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Connection summary */}
          <Card className={`p-3 flex items-center justify-between gap-3 flex-wrap ${
            syncState.online ? "bg-success/5 border-success/30" : "bg-destructive/10 border-destructive/30"
          }`}>
            <div className="text-sm">
              <span className="font-bold text-primary">حالة الاتصال:</span>{" "}
              {syncState.online ? (
                <span className="text-success font-semibold">متصل ✓</span>
              ) : (
                <span className="text-destructive font-semibold">خارج الاتصال</span>
              )}
            </div>
            {syncState.pending > 0 && (
              <div className="text-xs text-muted-foreground">
                {syncState.pending} عملية في الطابور
              </div>
            )}
          </Card>

          {/* Pending operations */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-warning" />
                العمليات المعلقة ({ops.length})
              </h3>
              {ops.length > 0 && (
                <Button
                  size="sm"
                  className="brand-gradient text-primary-foreground gap-1.5"
                  onClick={async () => {
                    await drainOutbox();
                    toast.info("بدأت المزامنة...");
                  }}
                  disabled={!syncState.online || syncState.syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncState.syncing ? "animate-spin" : ""}`} />
                  مزامنة الآن
                </Button>
              )}
            </div>
            {loading ? (
              <Card className="p-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </Card>
            ) : ops.length === 0 ? (
              <Card className="p-4 text-center bg-success/5 border-success/30 text-success font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> لا توجد عمليات معلقة — كل شيء متزامن
              </Card>
            ) : (
              <div className="space-y-2">
                {ops.map((op) => {
                  const isCurrent = syncState.currentOpId === op.id && syncState.syncing;
                  return (
                    <Card key={op.id} className={`p-3 ${isCurrent ? "border-accent bg-accent-soft/30" : "border-warning/30 bg-warning/5"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-1.5 shrink-0 mt-0.5 ${isCurrent ? "bg-accent/20" : "bg-warning/15"}`}>
                          {op.lastError ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : isCurrent ? (
                            <RefreshCw className="h-4 w-4 text-accent animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-warning" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-primary">
                            {op.label || op.kind}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {fmtTime(op.createdAt)}
                            {op.attempts > 0 && (
                              <span className="ms-2 text-destructive">
                                · {op.attempts} محاولة فاشلة
                              </span>
                            )}
                          </div>
                          {isCurrent && (
                            <div className="mt-2">
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-accent to-success transition-all"
                                  style={{ width: `${syncState.currentOpProgress}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-accent font-bold mt-0.5">{syncState.currentOpProgress}%</div>
                            </div>
                          )}
                          {op.lastError && !isCurrent && (
                            <div className="text-xs text-destructive mt-1 break-words">
                              {op.lastError}
                            </div>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeOp(op.id!, op.label || op.kind)}
                          disabled={isCurrent}
                          title="حذف العملية"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* History */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <History className="h-4 w-4 text-accent" />
                سجل آخر العمليات ({history.length})
              </h3>
              {history.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await clearHistory();
                    toast.success("تم مسح السجل");
                  }}
                >
                  <X className="h-3.5 w-3.5" /> مسح السجل
                </Button>
              )}
            </div>
            {history.length === 0 ? (
              <Card className="p-4 text-center text-muted-foreground text-sm">
                لا يوجد سجل بعد
              </Card>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {history.map((h, idx) => {
                  const tone =
                    h.status === "success"
                      ? "border-success/30 bg-success/5"
                      : h.status === "error"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-muted bg-muted/30";
                  const Icon =
                    h.status === "success"
                      ? CheckCircle2
                      : h.status === "error"
                      ? AlertTriangle
                      : Trash2;
                  const iconTone =
                    h.status === "success"
                      ? "text-success"
                      : h.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground";
                  return (
                    <div key={h.id ?? idx} className={`flex items-start gap-2 p-2 rounded-md border ${tone}`}>
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconTone}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-primary">{h.label}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtTime(h.time)}</div>
                        {h.detail && (
                          <div className="text-xs text-muted-foreground mt-0.5 break-words">
                            {h.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Local storage maintenance */}
          <section>
            <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              التخزين المحلي
            </h3>
            <Card className="p-3 bg-muted/30 border-border">
              {usage ? (
                <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                  <div>
                    <div className="text-muted-foreground">الطابور</div>
                    <div className="font-bold text-primary">{fmtBytes(usage.ops)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">الكاش</div>
                    <div className="font-bold text-primary">{fmtBytes(usage.cache)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">السجل</div>
                    <div className="font-bold text-primary">{fmtBytes(usage.history)}</div>
                  </div>
                </div>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={purgeAll}
                className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                تنظيف جميع البيانات المحلية
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                يحذف المسودات والكاش والطابور — البيانات على الخادم لن تتأثر.
              </p>
            </Card>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
