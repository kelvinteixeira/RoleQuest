"use client";

import { useRouter } from "next/navigation";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { toast } from "@/stores/toast.store";
import { useAuth, useCurrentUser } from "../hooks/use-auth";
import { currentNext, safeNextPath } from "../model/next-path";

export function Onboarding() {
  const user = useCurrentUser();
  const { setProfile } = useAuth();
  const router = useRouter();

  return (
    <div className="w-full">
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">Configuração inicial</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Prepare seu perfil</h1>
      <p className="mt-2 mb-8 text-sm text-fg-muted">É assim que mestres e jogadores vão te ver nas mesas. Dá para mudar depois.</p>
      <ProfileForm
        profile={user}
        submitLabel="Concluir e ir para o painel"
        onSaved={(profile) => {
          setProfile(profile);
          toast.success("Perfil pronto", "Bem-vindo ao Role Quest.");
          router.replace(safeNextPath(currentNext()));
        }}
      />
    </div>
  );
}
