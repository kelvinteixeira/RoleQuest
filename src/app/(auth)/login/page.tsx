import type { Metadata } from "next";
import { GuestGuard } from "@/features/authentication/components/guards";
import { LoginForm } from "@/features/authentication/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <GuestGuard>
      <LoginForm />
    </GuestGuard>
  );
}
