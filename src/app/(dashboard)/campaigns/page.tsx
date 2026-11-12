import type { Metadata } from "next";
import { CampaignsView } from "@/features/campaigns/components/campaigns-view";

export const metadata: Metadata = { title: "Campanhas" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function CampaignsPage() {
  return <CampaignsView />;
}
