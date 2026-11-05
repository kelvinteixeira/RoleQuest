import { Clapperboard, Dices, LayoutDashboard, Library, ScrollText, Settings, UsersRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, the item is shown but disabled and labelled with its phase. */
  plannedPhase?: number;
  /** Shown in the mobile bottom bar. */
  mobile?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard, mobile: true },
  { href: "/campaigns", label: "Campanhas", icon: ScrollText, mobile: true },
  { href: "/characters", label: "Personagens", icon: UsersRound, mobile: true },
  { href: "/systems", label: "Sistemas", icon: Dices, mobile: true },
  { href: "/library", label: "Biblioteca", icon: Library },
  { href: "/studio", label: "Chronicles Studio", icon: Clapperboard },
];

export const SECONDARY_NAV: NavItem[] = [{ href: "/settings", label: "Configurações", icon: Settings }];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/campaigns") return pathname.startsWith("/campaigns") || pathname.startsWith("/campaign/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
