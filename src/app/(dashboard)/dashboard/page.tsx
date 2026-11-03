import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Painel" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
