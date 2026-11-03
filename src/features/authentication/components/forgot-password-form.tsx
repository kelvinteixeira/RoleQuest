"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { toUserMessage } from "@/lib/errors";
import { authService } from "@/services/auth.service";
import { FormAlert } from "./form-alert";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await authService.requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-2 text-sm text-fg-muted">Informe o e-mail da sua conta para receber um link de redefinição.</p>

      {sentTo ? (
        <div className="mt-8 flex flex-col gap-4">
          <FormAlert tone="success">
            Se existir uma conta para <strong>{sentTo}</strong>, o link de redefinição será enviado.
          </FormAlert>
          <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-fg-subtle">
            Modo local: nenhum e-mail é enviado de verdade. O envio será feito pelo Supabase Auth na Fase 7.
          </p>
          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Usar outro e-mail
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            leadingIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" size="lg" loading={pending}>
            Enviar link
          </Button>
        </form>
      )}

      <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>
    </div>
  );
}
