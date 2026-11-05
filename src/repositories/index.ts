import { appConfig } from "@/config/app";
import type { Repositories } from "./contracts";
import { mockRepositories } from "./mock";
import { supabaseRepositories } from "./supabase";

/**
 * Single entry point to the data layer. Services call `repositories()`;
 * nothing else should import a concrete implementation.
 * NEXT_PUBLIC_DATA_SOURCE=supabase switches to the database (see docs/SUPABASE.md).
 */
export function repositories(): Repositories {
  switch (appConfig.dataSource) {
    case "mock":
      return mockRepositories;
    case "supabase":
      return supabaseRepositories;
  }
}

export type * from "./contracts";
