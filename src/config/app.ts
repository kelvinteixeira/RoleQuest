/**
 * Application configuration. `dataSource` selects the repository implementation;
 * switch to "supabase" in Phase 7 once SupabaseRepositories exist.
 */
export type DataSource = "mock" | "supabase";

export const appConfig = {
  name: "Role Quest",
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ?? "mock",
  /** Artificial delay for mock repositories so loading states are exercised. */
  mockLatencyMs: 260,
  mockStorageKey: "rq:mock-db:v1",
  sessionStorageKey: "rq:session:v1",
  demoAccount: { email: "mestre@rolequest.dev", password: "demo1234" },
} as const;

/** Features that are planned but not yet functional. UI must label them clearly. */
export const FEATURE_PHASE = {
  virtualTabletop: 3,
  characterEditor: 2,
  customSystemBuilder: 2,
  textChat: 4,
  audioEngine: 4,
  npcManager: 5,
  chroniclesStudio: 6,
  fileUploads: 7,
  realAuth: 7,
} as const;
