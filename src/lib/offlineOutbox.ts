/**
 * Offline outbox — durable queue of pending mutations stored in IndexedDB.
 *
 * Each operation describes a Supabase write (insert / update / delete /
 * upload) plus the data needed to replay it once the device is back online.
 *
 * Design notes:
 *   • IndexedDB is used (not localStorage) so we can store File/Blob
 *     uploads safely and avoid the 5 MB string limit.
 *   • The outbox is processed FIFO. A single failed op blocks the queue
 *     until it's resolved or removed manually — we surface this in the
 *     UI banner.
 *   • Files are kept inside the operation record itself; no separate
 *     blob store needed.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OutboxKind =
  | "supabase.insert"
  | "supabase.update"
  | "supabase.delete"
  | "supabase.upsert"
  | "supabase.upload";

export interface OutboxOp {
  id?: number;
  kind: OutboxKind;
  table?: string; // for table mutations
  bucket?: string; // for storage uploads
  path?: string; // for storage uploads
  match?: Record<string, any>; // filter for update / delete
  payload?: any; // row data
  file?: Blob; // for storage uploads
  contentType?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** Optional human-readable label shown in the UI ("حفظ مسودة الطلب"). */
  label?: string;
}

interface OutboxSchema extends DBSchema {
  ops: {
    key: number;
    value: OutboxOp;
    indexes: { byCreatedAt: number };
  };
  cache: {
    key: string;
    value: { key: string; value: any; updatedAt: number };
  };
  history: {
    key: number;
    value: SyncHistoryEntry;
    indexes: { byTime: number };
  };
}

export interface SyncHistoryEntry {
  id?: number;
  time: number;
  status: "success" | "error" | "discarded";
  label: string;
  detail?: string;
}

const DB_NAME = "baraka2-offline";
const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase<OutboxSchema>> | null = null;

function getDB() {
  if (!dbp) {
    dbp = openDB<OutboxSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("ops")) {
          const store = db.createObjectStore("ops", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("byCreatedAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("history")) {
          const h = db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
          h.createIndex("byTime", "time");
        }
      },
    });
  }
  return dbp;
}

export async function enqueueOp(op: Omit<OutboxOp, "createdAt" | "attempts">) {
  const db = await getDB();
  const id = await db.add("ops", {
    ...op,
    createdAt: Date.now(),
    attempts: 0,
  });
  notifyOutboxChanged();
  return id as number;
}

export async function listOps(): Promise<OutboxOp[]> {
  const db = await getDB();
  return db.getAllFromIndex("ops", "byCreatedAt");
}

export async function deleteOp(id: number) {
  const db = await getDB();
  await db.delete("ops", id);
  notifyOutboxChanged();
}

export async function updateOp(op: OutboxOp) {
  const db = await getDB();
  await db.put("ops", op);
  notifyOutboxChanged();
}

export async function clearAllOps() {
  const db = await getDB();
  await db.clear("ops");
  notifyOutboxChanged();
}

export async function countOps(): Promise<number> {
  const db = await getDB();
  return db.count("ops");
}

/* ---------------- key/value cache for offline reads ---------------- */

export async function cacheSet(key: string, value: any) {
  const db = await getDB();
  await db.put("cache", { key, value, updatedAt: Date.now() });
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const db = await getDB();
  const row = await db.get("cache", key);
  return (row?.value as T) ?? null;
}

export async function cacheDelete(key: string) {
  const db = await getDB();
  await db.delete("cache", key);
}

/* ---------------- pub/sub for UI updates ---------------- */

const listeners = new Set<() => void>();
export function onOutboxChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifyOutboxChanged() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}
