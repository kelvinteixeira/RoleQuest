import { appConfig } from "@/config/app";
import { withDemoSheet } from "@/mocks/fixtures/demo-sheets";
import { createSeed, type MockSeed } from "@/mocks/fixtures/seed";
import { seedGmTools } from "@/mocks/fixtures/gm-tools";

/** v2: demo characters ship with filled-in sheets. v3: campaign map library. v4: GM tools (NPCs, encounters, journal). v5: invite links replace e-mail invites. v6: Chronicles episodes. v7: audio library. */
const SCHEMA_VERSION = 7;

export type MockDatabase = MockSeed & { version: number };

/**
 * Brings a stored database to the current schema without losing local data;
 * null when it is too old to upgrade (a fresh seed is used instead).
 */
export function upgradeDatabase(stored: MockDatabase): MockDatabase | null {
  if (stored.version === SCHEMA_VERSION) return stored;
  let db = stored;
  if (db.version === 1) {
    // Only characters that were never edited get the demo sheet.
    db = { ...db, version: 2, characters: db.characters.map((c) => (c.sheet ? c : withDemoSheet(c))) };
  }
  if (db.version === 2) db = { ...db, version: 3, maps: db.maps ?? [] };
  // The demo GM tools are added for the seeded campaigns; local data is kept.
  if (db.version === 3) db = { ...db, version: 4, ...seedGmTools(new Date()) };
  if (db.version === 4) {
    const { invites: _emailInvites, ...rest } = db as MockDatabase & { invites?: unknown };
    void _emailInvites;
    db = { ...rest, version: 5, inviteLinks: rest.campaigns.map((c) => ({ campaignId: c.id, code: crypto.randomUUID().replace(/-/g, ""), createdAt: new Date().toISOString() })) };
  }
  if (db.version === 5) db = { ...db, version: 6, episodes: db.episodes ?? [] };
  if (db.version === 6) db = { ...db, version: 7, audioTracks: db.audioTracks ?? [] };
  return db.version === SCHEMA_VERSION ? db : null;
}

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
        const stored = JSON.parse(raw) as MockDatabase;
        const upgraded = upgradeDatabase(stored);
        if (upgraded) {
          db = upgraded;
          if (upgraded !== stored) persist();
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
