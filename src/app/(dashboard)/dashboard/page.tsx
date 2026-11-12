import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Painel" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
