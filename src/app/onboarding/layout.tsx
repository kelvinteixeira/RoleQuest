import { Logo } from "@/components/brand/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col px-5 py-6 sm:px-10">
      <Logo />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">{children}</main>
    </div>
  );
}
