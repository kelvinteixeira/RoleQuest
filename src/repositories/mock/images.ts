import { createId } from "@/lib/id";
import type { MapImageRepository } from "../contracts";

/**
 * Map pictures in the browser's IndexedDB (localStorage is far too small for
 * images). Falls back to memory where IndexedDB is missing (server, tests,
 * some private windows). Supabase Storage replaces this in Phase 7.
 */
const DB_NAME = "rq-images";
const STORE = "images";
const memory = new Map<string, Blob>();
let connection: Promise<IDBDatabase | null> | null = null;

/** One shared connection for the page (opening one per call leaks them). */
function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  connection ??= new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema: let it, and reconnect next time.
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      resolve(db);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return connection;
}

/**
 * Runs one request and settles when its transaction is done: a write only
 * counts once committed (a full disk aborts the transaction after the request succeeded).
 */
function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("Gravação cancelada (espaço do navegador cheio?)"));
  });
}

export const mockImages: MapImageRepository = {
  async put(blob) {
    const id = createId("img");
    const db = await open();
    if (db) await run(db, "readwrite", (s) => s.put(blob, id));
    else memory.set(id, blob);
    return id;
  },
  async get(id) {
    const db = await open();
    if (!db) return memory.get(id) ?? null;
    return (await run<Blob | undefined>(db, "readonly", (s) => s.get(id))) ?? null;
  },
};
