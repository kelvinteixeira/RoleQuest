"use client";

import { useState, type ReactNode } from "react";
import { Database, KeyRound, RotateCcw, SlidersHorizontal, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PhaseBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/format";
import { localDataService } from "@/services/local-data.service";
import { usePreferencesStore } from "@/stores/preferences.store";
import { toast } from "@/stores/toast.store";
import { useAuth, useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { ProfileForm } from "./profile-form";

export function SettingsView() {
  const user = useCurrentUser();
  const { setProfile, signOut } = useAuth();
  const prefs = usePreferencesStore();
  const [confirmReset, setConfirmReset] = useState(false);

  async function resetData() {
    localDataService.reset();
    setConfirmReset(false);
    toast.info("Dados de demonstração restaurados", "Entre novamente para continuar.");
    await signOut();
  }

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Configurações" description="Perfil, preferências deste dispositivo e conta." />

      <div className="flex flex-col gap-6">
        <Section icon={<UserRound />} title="Perfil" description="Como você aparece para mestres e jogadores.">
          <ProfileForm
            key={user.updatedAt}
            profile={user}
            submitLabel="Salvar perfil"
            onSaved={(profile) => {
              setProfile(profile);
              toast.success("Perfil atualizado");
            }}
          />
        </Section>

        <div id="preferencias" className="scroll-mt-20">
          <Section icon={<SlidersHorizontal />} title="Preferências" description="Salvas apenas neste dispositivo.">
            <div className="flex flex-col gap-5">
              <Switch
                checked={prefs.reduceMotion}
                onChange={prefs.setReduceMotion}
                label="Reduzir animações"
                description="Desativa transições e animações decorativas da interface."
              />
              <Switch
                checked={prefs.sidebarCollapsed}
                onChange={prefs.setSidebarCollapsed}
                label="Menu lateral recolhido"
                description="Mais espaço para o conteúdo em telas menores."
              />
              <Switch
                checked={prefs.diceSounds}
                onChange={prefs.setDiceSounds}
                label={
                  <span className="flex items-center gap-2">
                    Sons dos dados <PhaseBadge phase={3} />
                  </span>
                }
                description="Preferência guardada agora; aplicada quando o rolador de dados chegar."
              />
            </div>
          </Section>
        </div>

        <Section icon={<KeyRound />} title="Conta">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg-subtle">E-mail</dt>
              <dd className="mt-0.5">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Membro desde</dt>
              <dd className="mt-0.5">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled title="Alteração de senha e e-mail — Fase 7 (Supabase Auth)">
              Alterar senha
            </Button>
            <PhaseBadge phase={7} />
          </div>
        </Section>

        {localDataService.isAvailable() && (
          <Section icon={<Database />} title="Dados locais" description="Enquanto o backend não está integrado, tudo fica no armazenamento deste navegador.">
            <Button variant="danger" size="sm" leadingIcon={<RotateCcw className="size-3.5" />} onClick={() => setConfirmReset(true)}>
              Restaurar dados de demonstração
            </Button>
          </Section>
        )}
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Restaurar dados de demonstração?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void resetData()}>
              Restaurar
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Campanhas, convites e contas criadas neste navegador serão apagados e o conjunto de demonstração original volta. Você será desconectado.
        </p>
      </Modal>
    </PageContainer>
  );
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} description={description} />
      <div className="p-5">{children}</div>
    </Card>
  );
}
