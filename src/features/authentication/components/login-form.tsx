"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { appConfig } from "@/config/app";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { hasErrors } from "@/lib/validation";
import { validateSignIn } from "@/services/auth.service";
import { useAuth } from "../hooks/use-auth";
import { FormAlert } from "./form-alert";

/** Only same-origin relative paths are accepted as post-login redirects. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"form" | "demo" | null>(null);

  async function submit(credentials: typeof values, source: "form" | "demo") {
    setFormError(null);
    const fieldErrors = validateSignIn(credentials);
    setErrors(fieldErrors as Record<string, string>);
    if (hasErrors(fieldErrors)) return;

    setPending(source);
    try {
      const profile = await signIn(credentials.email, credentials.password);
      router.replace(profile.onboardingCompleted ? safeNext() : "/onboarding");
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      setFormError(toUserMessage(error));
      setPending(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(values, "form");
  }

  function signInWithDemo() {
    const demo = { email: appConfig.demoAccount.email, password: appConfig.demoAccount.password };
    setValues(demo);
    void submit(demo, "demo");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 text-sm text-fg-muted">Sua mesa está esperando. Entre para continuar a campanha.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          leadingIcon={<Mail />}
          placeholder="voce@exemplo.com"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={errors.email}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            leadingIcon={<Lock />}
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            error={errors.password}
          />
          <Link href="/forgot-password" className="self-end text-xs text-fg-subtle hover:text-accent">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" loading={pending === "form"} disabled={pending !== null} trailingIcon={<ArrowRight className="size-4" />}>
          Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-fg-subtle">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={signInWithDemo}
        loading={pending === "demo"}
        disabled={pending !== null}
        leadingIcon={<Sparkles className="size-4 text-accent" />}
      >
        Explorar com a conta de demonstração
      </Button>

      <p className="mt-8 text-center text-sm text-fg-muted">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
