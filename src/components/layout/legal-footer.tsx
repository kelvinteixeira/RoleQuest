import Link from "next/link";
import { cn } from "@/lib/cn";

/** Terms, privacy and plans: on the landing page, sign-in and the legal pages. */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <nav aria-label="Informações legais" className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-fg-subtle", className)}>
      <Link href="/plans" className="hover:text-fg">
        Planos
      </Link>
      <Link href="/terms" className="hover:text-fg">
        Termos de uso
      </Link>
      <Link href="/privacy" className="hover:text-fg">
        Privacidade
      </Link>
      <span>© Role Quest</span>
    </nav>
  );
}
