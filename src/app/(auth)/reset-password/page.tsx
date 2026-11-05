import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/authentication/components/reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
