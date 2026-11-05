"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { PASSWORD_MIN_LENGTH, authService } from "@/services/auth.service";
import { useSessionStore } from "@/stores/session.store";
import { FormAlert } from "./form-alert";

/** Opened from the reset e-mail: Supabase signs the user in for recovery; here they pick the new password. */
export function ResetPasswordForm() {
  const router = useRouter();
  const setAuth = useSessionStore((s) => s.setAuth);
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    setPending(true);
    try {
      const { session, profile } = await authService.completePasswordReset(values);
      setAuth(session, profile);
      router.replace(profile.onboardingCompleted ? "/dashboard" : "/onboarding");
    } catch (error) {
      const fields = fieldErrorsOf(error);
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(toUserMessage(error));
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Nova senha</h1>
      <p className="mt-2 text-sm text-fg-muted">Escolha a nova senha da sua conta.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          leadingIcon={<Lock />}
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
          hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        />
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          leadingIcon={<Lock />}
          value={values.confirmPassword}
          onChange={(e) => setValues({ ...values, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" loading={pending}>
          Salvar e entrar
        </Button>
      </form>

      <Link href="/forgot-password" className="mt-8 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Pedir outro link
      </Link>
    </div>
  );
}
