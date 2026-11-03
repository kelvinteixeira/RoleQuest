import { appConfig } from "@/config/app";
import { resetMockDatabase } from "@/repositories/mock";

/** Maintenance actions that only exist while data lives in the browser. */
export const localDataService = {
  isAvailable(): boolean {
    return appConfig.dataSource === "mock";
  },

  /** Restores the demo dataset. Accounts created locally are removed. */
  reset(): void {
    if (!localDataService.isAvailable()) throw new Error("Local data reset is only available in mock mode.");
    resetMockDatabase();
  },
};
