"use client";

import { Suspense, useState, type ReactNode } from "react";
import { CreditCard, Database, KeyRound, RotateCcw, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { appConfig } from "@/config/app";
import { authService } from "@/services/auth.service";
import { toUserMessage } from "@/lib/errors";
import { BillingSection, PrivacySection } from "./account-sections";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/cn";
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

  const [sendingReset, setSendingReset] = useState(false);
  async function changePassword() {
    setSendingReset(true);
    try {
      await authService.requestPasswordReset(user.email);
      toast.success("Link enviado", `Abra o e-mail de ${user.email} para escolher a nova senha.`);
    } catch (error) {
      toast.error("Não deu para enviar o link", toUserMessage(error));
    } finally {
      setSendingReset(false);
    }
  }

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
                label="Efeitos sonoros na mesa"
                description="Dados, golpes, portas, armadilhas e fogo. Também dá para silenciar pelo botão na sala."
              />
              <label className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                Qualidade gráfica da mesa 3D
                <select
                  value={prefs.graphics}
                  onChange={(e) => prefs.setGraphics(e.target.value as typeof prefs.graphics)}
                  className="h-8 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60"
                >
                  <option value="auto">Automática (pelo aparelho)</option>
                  <option value="low">Baixa: sem sombras, mais leve no celular</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <label className={cn("flex items-center gap-3 text-sm text-fg-muted", !prefs.diceSounds && "opacity-50")}>
                Volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!prefs.diceSounds}
                  value={prefs.effectsVolume}
                  onChange={(e) => prefs.setEffectsVolume(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-accent-solid)]"
                  aria-label="Volume dos efeitos sonoros"
                />
                <span className="w-10 text-right font-mono text-xs">{Math.round(prefs.effectsVolume * 100)}%</span>
              </label>
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
            <Button variant="secondary" size="sm" loading={sendingReset} disabled={appConfig.dataSource === "mock"} onClick={() => void changePassword()}>
              Alterar senha
            </Button>
            {appConfig.dataSource === "mock" && <span className="text-xs text-fg-subtle">No modo local não há e-mail para o link.</span>}
          </div>
        </Section>

        <div id="plano" className="scroll-mt-20">
          <Section icon={<CreditCard />} title="Plano" description="Seu plano, o uso de hoje no Chronicles e os créditos.">
            <Suspense fallback={<p className="text-sm text-fg-subtle">Carregando plano…</p>}>
              <BillingSection />
            </Suspense>
          </Section>
        </div>

        <Section icon={<ShieldCheck />} title="Privacidade e seus dados" description="Lembretes, uma cópia dos seus dados e a exclusão da conta (LGPD).">
          <PrivacySection />
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
