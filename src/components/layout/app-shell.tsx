"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { PhaseBadge } from "@/components/ui/primitives";
import { isActive, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/components/navigation/nav-items";
import { cn } from "@/lib/cn";
import { usePreferencesStore } from "@/stores/preferences.store";
import { UserMenu } from "./user-menu";

/**
 * Authenticated layout: collapsible sidebar on desktop, top bar + bottom tab
 * bar on mobile. Pages render inside <main> and own their headers.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = usePreferencesStore((s) => s.sidebarCollapsed);
  const toggle = usePreferencesStore((s) => s.toggleSidebar);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/60 transition-[width] duration-200 md:flex",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
          <Link href="/dashboard" aria-label="Painel">
            <Logo compact={collapsed} />
          </Link>
          {!collapsed && (
            <button onClick={toggle} className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Recolher menu">
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        <div className={cn("px-3 pb-2", collapsed && "px-2.5")}>
          <ButtonLink
            href="/campaigns/new"
            size={collapsed ? "icon" : "md"}
            className="w-full"
            leadingIcon={<Plus className="size-4" />}
            aria-label="Criar nova campanha"
          >
            {!collapsed && "Nova campanha"}
          </ButtonLink>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Principal">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} collapsed={collapsed} />
          ))}
          <div className="my-2 h-px bg-line" />
          {SECONDARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-line p-2">
          {collapsed && (
            <button
              onClick={toggle}
              className="mb-1 flex h-9 w-full items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              aria-label="Expandir menu"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}
          <UserMenu compact={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur md:hidden">
          <Link href="/dashboard" aria-label="Painel">
            <Logo />
          </Link>
          <UserMenu compact placement="bottom" />
        </header>
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>

      <MobileTabBar />
    </div>
  );
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const base = cn(
    "group relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors",
    collapsed ? "justify-center px-0" : "px-2.5",
  );

  if (item.plannedPhase) {
    return (
      <span className={cn(base, "cursor-not-allowed text-fg-subtle/70")} title={`${item.label} — disponível na Fase ${item.plannedPhase}`} aria-disabled>
        <Icon className="size-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <PhaseBadge phase={item.plannedPhase} />
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(base, active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2/60 hover:text-fg")}
    >
      {active && <span className="absolute inset-y-2 -left-3 w-0.5 rounded-r bg-accent" aria-hidden />}
      <Icon className={cn("size-4 shrink-0", active && "text-accent")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const items = PRIMARY_NAV.filter((i) => i.mobile);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navegação"
    >
      {items.slice(0, 2).map((item) => (
        <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
      <Link href="/campaigns/new" className="flex flex-col items-center justify-center gap-1 py-2" aria-label="Nova campanha">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent-solid text-accent-fg shadow-lg shadow-accent-solid/30">
          <Plus className="size-5" />
        </span>
      </Link>
      {items.slice(2, 4).map((item) => (
        <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium", active ? "text-accent" : "text-fg-subtle")}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}
