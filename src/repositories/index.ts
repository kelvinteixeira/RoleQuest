import { appConfig } from "@/config/app";
import type { Repositories } from "./contracts";
import { mockRepositories } from "./mock";

/**
 * Single entry point to the data layer. Services call `repositories()`;
 * nothing else should import a concrete implementation.
 */
export function repositories(): Repositories {
  switch (appConfig.dataSource) {
    case "mock":
      return mockRepositories;
    case "supabase":
      // Phase 7: return createSupabaseRepositories(getSupabaseClient());
      throw new Error("Supabase repositories are not implemented yet (Phase 7). Set NEXT_PUBLIC_DATA_SOURCE=mock.");
  }
}

export type * from "./contracts";
