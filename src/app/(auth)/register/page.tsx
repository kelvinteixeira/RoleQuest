import type { Metadata } from "next";
import { GuestGuard } from "@/features/authentication/components/guards";
import { RegisterForm } from "@/features/authentication/components/register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <GuestGuard>
      <RegisterForm />
    </GuestGuard>
  );
}
