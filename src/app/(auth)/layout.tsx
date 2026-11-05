import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";
import { AuthShowcase } from "@/features/authentication/components/auth-showcase";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="self-start" aria-label="Role Quest — início">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
        {appConfig.dataSource === "mock" && (
          <p className="text-center text-xs text-fg-subtle">Modo local · seus dados ficam neste navegador.</p>
        )}
      </div>
      <AuthShowcase />
    </div>
  );
}
