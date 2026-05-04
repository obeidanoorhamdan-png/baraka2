/**
 * Background sync engine — drains the offline outbox into Supabase
 * whenever the device is online. Runs on:
 *   • app start
 *   • `online` event
 *   • every 30 s (safety net for flaky networks)
 *
 * The engine is idempotent: only one drain runs at a time. Per-op
 * progress is reported through onSyncState() so the UI can show a live
 * progress bar (esp. for `app.submit` which writes many family rows).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  listOps,
  deleteOp,
  updateOp,
  onOutboxChange,
  countOps,
  logHistory,
  cacheSet,
  type OutboxOp,
} from "./offlineOutbox";

let draining = false;
let started = false;
let currentOpId: number | null = null;
let currentOpProgress = 0;

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  currentOpId: number | null;
  currentOpProgress: number;
}

const stateListeners = new Set<(s: SyncState) => void>();

async function notifyState() {
  const pending = await countOps();
  const state: SyncState = {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pending,
    syncing: draining,
    currentOpId,
    currentOpProgress,
  };
  stateListeners.forEach((l) => {
    try {
      l(state);
    } catch {
      /* ignore */
    }
  });
}

export function onSyncState(cb: (s: SyncState) => void) {
  stateListeners.add(cb);
  // emit initial state
  notifyState();
  return () => stateListeners.delete(cb);
}

function setProgress(p: number) {
  currentOpProgress = Math.max(0, Math.min(100, Math.round(p)));
  notifyState();
}

/**
 * Submit a fresh application + all family members. Used when the user
 * tapped "Send" while offline.
 */
async function executeAppSubmit(op: OutboxOp): Promise<void> {
  const { application, members } = op.payload || {};
  if (!application || !application.user_id) throw new Error("بيانات الطلب غير مكتملة");
  setProgress(5);
  const { data: app, error } = await supabase
    .from("applications")
    .insert(application)
    .select("id")
    .single();
  if (error) throw error;
  setProgress(40);
  if (Array.isArray(members) && members.length) {
    // Insert family members in batches so a slow connection doesn't time
    // out on a single huge payload.
    const BATCH = 5;
    const rows = members.map((m: any) => ({ ...m, application_id: app.id }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: e2 } = await supabase.from("family_members").insert(slice);
      if (e2) throw e2;
      setProgress(40 + Math.round(((i + slice.length) / rows.length) * 50));
    }
  }
  setProgress(95);
  // Notify the family
  try {
    await supabase.from("notifications").insert({
      user_id: application.user_id,
      title: "✅ تم استلام طلبك",
      body: "تم تسجيل طلبك بنجاح وهو الآن قيد المراجعة من قِبل الإدارة.",
      link: "/my-application",
      kind: "info",
    });
  } catch {
    /* non-fatal */
  }
  // Refresh local cache so the next page load shows the saved data.
  try {
    const { data: refreshed } = await supabase
      .from("applications").select("*").eq("id", app.id).maybeSingle();
    const { data: fm } = await supabase
      .from("family_members").select("*").eq("application_id", app.id);
    if (refreshed) await cacheSet(`app:${application.user_id}`, { app: refreshed, members: fm || [] });
  } catch {
    /* ignore */
  }
  setProgress(100);
}

/**
 * Update an existing application — replace the row + wipe & re-insert
 * all family members.
 */
async function executeAppUpdate(op: OutboxOp): Promise<void> {
  const { applicationId, application, members, userId } = op.payload || {};
  if (!applicationId || !application) throw new Error("بيانات التحديث غير مكتملة");
  setProgress(10);
  const { error } = await supabase.from("applications").update(application).eq("id", applicationId);
  if (error) throw error;
  setProgress(30);
  await supabase.from("family_members").delete().eq("application_id", applicationId);
  setProgress(45);
  if (Array.isArray(members) && members.length) {
    const BATCH = 5;
    const rows = members.map((m: any) => ({ ...m, application_id: applicationId }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: e2 } = await supabase.from("family_members").insert(slice);
      if (e2) throw e2;
      setProgress(45 + Math.round(((i + slice.length) / rows.length) * 45));
    }
  }
  setProgress(95);
  if (userId) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "✏️ تم تحديث بياناتك",
        body: "تم حفظ التعديلات على بيانات عائلتك بنجاح.",
        link: "/my-application",
        kind: "info",
      });
      const { data: refreshed } = await supabase
        .from("applications").select("*").eq("id", applicationId).maybeSingle();
      const { data: fm } = await supabase
        .from("family_members").select("*").eq("application_id", applicationId);
      if (refreshed) await cacheSet(`app:${userId}`, { app: refreshed, members: fm || [] });
    } catch {
      /* ignore */
    }
  }
  setProgress(100);
}

async function executeOp(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case "supabase.insert": {
      const { error } = await (supabase as any).from(op.table!).insert(op.payload);
      if (error) throw error;
      return;
    }
    case "supabase.upsert": {
      const { error } = await (supabase as any).from(op.table!).upsert(op.payload);
      if (error) throw error;
      return;
    }
    case "supabase.update": {
      let q = (supabase as any).from(op.table!).update(op.payload);
      for (const [k, v] of Object.entries(op.match || {})) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) throw error;
      return;
    }
    case "supabase.delete": {
      let q = (supabase as any).from(op.table!).delete();
      for (const [k, v] of Object.entries(op.match || {})) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) throw error;
      return;
    }
    case "supabase.upload": {
      const { error } = await supabase.storage
        .from(op.bucket!)
        .upload(op.path!, op.file!, {
          contentType: op.contentType,
          upsert: true,
        });
      if (error) throw error;
      return;
    }
    case "app.submit":
      return executeAppSubmit(op);
    case "app.update":
      return executeAppUpdate(op);
  }
}

export async function drainOutbox() {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  draining = true;
  notifyState();

  try {
    const ops = await listOps();
    for (const op of ops) {
      currentOpId = op.id ?? null;
      currentOpProgress = 0;
      notifyState();
      try {
        await executeOp(op);
        await deleteOp(op.id!);
        await logHistory({
          status: "success",
          label: op.label || op.kind,
          detail: `${op.kind}${op.table ? ` → ${op.table}` : ""}`,
        });
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        await updateOp({
          ...op,
          attempts: (op.attempts || 0) + 1,
          lastError: errMsg,
        });
        if ((op.attempts || 0) + 1 >= 5) {
          await deleteOp(op.id!);
          await logHistory({
            status: "discarded",
            label: op.label || op.kind,
            detail: `تم تجاهل العملية بعد 5 محاولات فاشلة: ${errMsg}`,
          });
          continue;
        }
        await logHistory({
          status: "error",
          label: op.label || op.kind,
          detail: errMsg,
        });
        break; // stop draining; will retry on next trigger
      }
    }
  } finally {
    currentOpId = null;
    currentOpProgress = 0;
    draining = false;
    notifyState();
  }
}

export function startSyncEngine() {
  if (started) return;
  started = true;

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      notifyState();
      drainOutbox();
    });
    window.addEventListener("offline", () => notifyState());
  }

  // Refresh the badge whenever ops change.
  onOutboxChange(() => {
    notifyState();
    drainOutbox();
  });

  // Safety-net poll every 30 s.
  setInterval(() => drainOutbox(), 30000);

  // Initial drain on boot.
  drainOutbox();
}
