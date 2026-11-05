"use client";

import { useAsync } from "@/hooks/use-async";
import { dashboardService } from "@/services/dashboard.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";

export function useDashboard() {
  const user = useCurrentUser();
  const state = useAsync(() => dashboardService.load(user), [user.id]);
  return { ...state, user };
}
