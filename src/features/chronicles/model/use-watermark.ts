"use client";

import { useAsync } from "@/hooks/use-async";
import { accountService } from "@/services/account.service";

/** Whether this campaign's episodes carry the free plan's mark (decided by the campaign owner's plan). */
export function useWatermark(campaignId: string): boolean {
  return useAsync(() => accountService.watermarkFor(campaignId), [campaignId]).data ?? false;
}
