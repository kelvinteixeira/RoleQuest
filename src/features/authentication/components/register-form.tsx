"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { hasErrors } from "@/lib/validation";
import { PASSWORD_MIN_LENGTH, validateSignUp } from "@/services/auth.service";
import { useAuth } from "../hooks/use-auth";
import { FormAlert } from "./form-alert";

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return { score, label: ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][score] };
}

export function RegisterForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value });
  const strength = passwordStrength(values.password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fieldErrors = validateSignUp(values);
    setErrors(fieldErrors as Record<string, string>);
    if (hasErrors(fieldErrors)) return;

    setPending(true);
    try {
      await signUp(values);
      router.replace("/onboarding");
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      setFormError(toUserMessage(error));
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Crie sua conta</h1>
      <p className="mt-2 text-sm text-fg-muted">Mestre numa campanha, jogador em outra. Uma conta para todas as mesas.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input label="Nome de exibição" autoComplete="nickname" leadingIcon={<User />} value={values.displayName} onChange={set("displayName")} error={errors.displayName} />
        <Input label="E-mail" type="email" autoComplete="email" leadingIcon={<Mail />} value={values.email} onChange={set("email")} error={errors.email} />
        <div className="flex flex-col gap-2">
          <Input
            label="Senha"
            type="password"
            autoComplete="new-password"
            leadingIcon={<Lock />}
            value={values.password}
            onChange={set("password")}
            error={errors.password}
            hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
          />
          {values.password && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: i < strength.score ? ["var(--color-danger)", "var(--color-warning)", "var(--color-warning)", "var(--color-success)"][strength.score - 1] : "var(--color-surface-3)" }}
                  />
                ))}
              </div>
              <span className="w-20 text-right text-[11px] text-fg-subtle">{strength.label}</span>
            </div>
          )}
        </div>
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          leadingIcon={<Lock />}
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" loading={pending} trailingIcon={<ArrowRight className="size-4" />}>
          Criar conta
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-fg-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
