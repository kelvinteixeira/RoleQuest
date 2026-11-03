import type { Metadata } from "next";
import { CampaignsView } from "@/features/campaigns/components/campaigns-view";

export const metadata: Metadata = { title: "Campanhas" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function CampaignsPage() {
  return <CampaignsView />;
}
