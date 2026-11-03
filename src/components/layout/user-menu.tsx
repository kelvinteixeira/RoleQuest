"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useAuth, useCurrentUser } from "@/features/authentication/hooks/use-auth";

export function UserMenu({ compact = false, placement = "top" }: { compact?: boolean; placement?: "top" | "bottom" }) {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on route change and on outside click / Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2",
          compact && "justify-center",
        )}
      >
        <Avatar name={user.displayName} color={user.avatarColor} src={user.avatarUrl} size="sm" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.displayName}</span>
              <span className="block truncate text-xs text-fg-subtle">@{user.username}</span>
            </span>
            <ChevronsUpDown className="size-3.5 text-fg-subtle" />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: placement === "top" ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "absolute z-40 w-56 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1 shadow-2xl",
              placement === "top" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
            )}
          >
            <div className="border-b border-line px-2.5 py-2">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            </div>
            <div className="py-1">
              <MenuLink href="/settings" icon={<UserRound />}>
                Meu perfil
              </MenuLink>
              <MenuLink href="/settings#preferencias" icon={<Settings />}>
                Preferências
              </MenuLink>
            </div>
            <button
              role="menuitem"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger hover:bg-danger/10 [&_svg]:size-4"
            >
              <LogOut /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg [&_svg]:size-4"
    >
      {icon}
      {children}
    </Link>
  );
}
