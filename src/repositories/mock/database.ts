import { appConfig } from "@/config/app";
import { createSeed, type MockSeed } from "@/mocks/fixtures/seed";

const SCHEMA_VERSION = 1;

type MockDatabase = MockSeed & { version: number };

let db: MockDatabase | null = null;

function fresh(): MockDatabase {
  return { version: SCHEMA_VERSION, ...createSeed() };
}

function persist(): void {
  if (typeof window === "undefined" || !db) return;
  try {
    window.localStorage.setItem(appConfig.mockStorageKey, JSON.stringify(db));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
}

/** In-memory database, lazily hydrated from localStorage (browser) or the seed (server). */
export function getDb(): MockDatabase {
  if (db) return db;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(appConfig.mockStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDatabase;
        if (parsed.version === SCHEMA_VERSION) {
          db = parsed;
          return db;
        }
      }
    } catch {
      // Corrupted payload: fall through to a fresh seed.
    }
  }
  db = fresh();
  persist();
  return db;
}

/** Call after every mutation. */
export function commit(): void {
  persist();
}

export function resetMockDatabase(): void {
  db = fresh();
  persist();
}

/**
 * Simulates network latency and returns a deep copy so callers can never
 * mutate the database by accident (same guarantee a real backend gives).
 */
export function respond<T>(value: T): Promise<T> {
  const copy = value === undefined ? value : (structuredClone(value) as T);
  return new Promise((resolve) => setTimeout(() => resolve(copy), appConfig.mockLatencyMs));
}

export function nowIso(): string {
  return new Date().toISOString();
}
