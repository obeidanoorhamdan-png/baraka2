/**
 * Background sync engine — drains the offline outbox into Supabase
 * whenever the device is online. Runs on:
 *   • app start
 *   • `online` event
 *   • every 30 s (safety net for flaky networks)
 *
 * The engine is idempotent: only one drain runs at a time.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  listOps,
  deleteOp,
  updateOp,
  onOutboxChange,
  countOps,
  type OutboxOp,
} from "./offlineOutbox";

let draining = false;
let started = false;

const stateListeners = new Set<(s: { online: boolean; pending: number; syncing: boolean }) => void>();

async function notifyState() {
  const pending = await countOps();
  const state = {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pending,
    syncing: draining,
  };
  stateListeners.forEach((l) => {
    try {
      l(state);
    } catch {
      /* ignore */
    }
  });
}

export function onSyncState(cb: (s: { online: boolean; pending: number; syncing: boolean }) => void) {
  stateListeners.add(cb);
  // emit initial state
  notifyState();
  return () => stateListeners.delete(cb);
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
      try {
        await executeOp(op);
        await deleteOp(op.id!);
      } catch (e: any) {
        // Increment attempts and stop the queue. Keeping the failing op at
        // the head ensures FIFO ordering and prevents silent data loss.
        await updateOp({
          ...op,
          attempts: (op.attempts || 0) + 1,
          lastError: e?.message || String(e),
        });
        // After 5 failed attempts, treat the op as permanently broken so
        // the rest of the queue can keep flowing.
        if ((op.attempts || 0) + 1 >= 5) {
          await deleteOp(op.id!);
          continue;
        }
        break; // stop draining; will retry on next trigger
      }
    }
  } finally {
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
