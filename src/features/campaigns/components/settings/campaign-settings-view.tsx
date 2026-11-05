"use client";

import { useRef, useState } from "react";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import Link from "next/link";
import { ArrowLeft, Crown, MailPlus, Save, Scale, Settings2, UserMinus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Avatar, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CAMPAIGN_STATUS, NARRATION_STYLES, WORLD_TONES } from "@/constants/campaign";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { campaignAdminService, validateSettings, type CampaignSettings } from "@/services/campaign-admin.service";
import { campaignService, CAMPAIGN_LIMITS, type CampaignOverview } from "@/services/campaign.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { CampaignStatus, InviteStatus } from "@/types/campaign";

type Tab = "general" | "rules" | "players";

const INVITE_STATUS: Record<InviteStatus, { label: string; tone: "info" | "success" | "neutral" | "warning" }> = {
  pending: { label: "Pendente", tone: "info" },
  accepted: { label: "Aceito", tone: "success" },
  declined: { label: "Recusado", tone: "neutral" },
  revoked: { label: "Cancelado", tone: "warning" },
};

/**
 * Campaign settings for the GM: information and narrator, table rules
 * (what players may do) and the people at the table (roles, removal, invites).
 */
export function CampaignSettingsView({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const overview = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);

  if (overview.status === "error" && !overview.data) {
    return (
      <PageContainer>
        <ErrorState error={overview.error} onRetry={overview.reload} />
      </PageContainer>
    );
  }
  if (!overview.data) return <LoadingState label="Abrindo as configurações…" />;
  if (!can(overview.data.role, "campaign:manage")) {
    return (
      <PageContainer>
        <ErrorState error={new Error("Só o mestre da campanha altera as configurações.")} />
      </PageContainer>
    );
  }
  return <Settings overview={overview.data} reload={overview.reload} />;
}

const toSettings = (o: CampaignOverview): CampaignSettings => ({
  name: o.campaign.name,
  tagline: o.campaign.tagline,
  status: o.campaign.status,
  world: o.campaign.world,
  gameMaster: o.campaign.gameMaster,
  playerPolicy: o.campaign.playerPolicy,
});

function Settings({ overview, reload }: { overview: CampaignOverview; reload: () => Promise<void> }) {
  const user = useCurrentUser();
  const campaignId = overview.campaign.id;
  const [tab, setTab] = useState<Tab>("general");
  const [draft, setDraft] = useState<CampaignSettings>(() => toSettings(overview));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const players = overview.members.filter((m) => m.role === "player").length;
  const errors = { ...validateSettings(draft, players), ...serverErrors };
  const revision = useRef(0);
  const set = (patch: Partial<CampaignSettings>) => {
    revision.current += 1;
    setDirty(true);
    setServerErrors({});
    setDraft((d) => ({ ...d, ...patch }));
  };

  useUnsavedGuard(dirty);

  async function save() {
    setSaving(true);
    const started = revision.current;
    try {
      await campaignAdminService.updateSettings(campaignId, user, draft);
      if (revision.current === started) setDirty(false);
      toast.success("Campanha atualizada");
      await reload();
    } catch (e) {
      setServerErrors(fieldErrorsOf(e));
      toast.error("Não foi possível salvar", toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const saveBar = (
    <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
      {Object.keys(errors).length > 0 && <span className="min-w-0 flex-1 truncate text-sm text-danger">{Object.values(errors)[0]}</span>}
      <Button onClick={() => void save()} loading={saving} disabled={!dirty || Object.keys(errors).length > 0} leadingIcon={<Save className="size-4" />}>
        Salvar alterações
      </Button>
    </div>
  );

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-4" /> {overview.campaign.name}
      </Link>
      <PageHeader eyebrow="Configurações" title={overview.campaign.name} description="Informações da campanha, regras da mesa e quem joga." />
      <Tabs
        value={tab}
        onChange={(t) => setTab(t)}
        className="mb-5"
        items={[
          { value: "general", label: <Label icon={<Settings2 className="size-4" />} text="Geral" /> },
          { value: "rules", label: <Label icon={<Scale className="size-4" />} text="Regras da mesa" /> },
          { value: "players", label: <Label icon={<Users className="size-4" />} text="Jogadores" />, count: overview.members.length },
        ]}
      />

      {tab === "general" && (
        <Card className="flex max-w-3xl flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Input label="Nome" value={draft.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} maxLength={CAMPAIGN_LIMITS.nameMax} />
            <Select label="Situação" value={draft.status} onChange={(e) => set({ status: e.target.value as CampaignStatus })}>
              {(Object.keys(CAMPAIGN_STATUS) as CampaignStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS[s].label}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Chamada" value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} error={errors.tagline} maxLength={160} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nome do mundo" value={draft.world.name} onChange={(e) => set({ world: { ...draft.world, name: e.target.value } })} error={errors["world.name"]} maxLength={60} />
            <Input label="Onde começa" value={draft.world.startingLocation} onChange={(e) => set({ world: { ...draft.world, startingLocation: e.target.value } })} error={errors["world.startingLocation"]} maxLength={80} />
          </div>
          <Textarea label="Premissa" value={draft.world.premise} onChange={(e) => set({ world: { ...draft.world, premise: e.target.value } })} error={errors["world.premise"]} rows={3} maxLength={600} />
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-fg-muted">Tom</legend>
            <div className="flex flex-wrap gap-1.5">
              {WORLD_TONES.map((t) => {
                const on = draft.world.tone.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ world: { ...draft.world, tone: on ? draft.world.tone.filter((x) => x !== t) : [...draft.world.tone, t] } })}
                    className={cn("h-7 rounded-full border px-2.5 text-xs transition-colors", on ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg")}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {errors["world.tone"] && <p className="mt-1 text-xs text-danger">{errors["world.tone"]}</p>}
          </fieldset>
          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <Input label="Como você assina na mesa" value={draft.gameMaster.narratorName} onChange={(e) => set({ gameMaster: { ...draft.gameMaster, narratorName: e.target.value } })} error={errors["gameMaster.narratorName"]} maxLength={40} />
            <Select label="Estilo de narração" value={draft.gameMaster.narrationStyle} onChange={(e) => set({ gameMaster: { ...draft.gameMaster, narrationStyle: e.target.value } })}>
              {NARRATION_STYLES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Notas do mestre" hint="Só os mestres da campanha veem." value={draft.gameMaster.notes} onChange={(e) => set({ gameMaster: { ...draft.gameMaster, notes: e.target.value } })} error={errors["gameMaster.notes"]} rows={3} maxLength={1000} />
          {saveBar}
        </Card>
      )}

      {tab === "rules" && (
        <Card className="flex max-w-3xl flex-col gap-5 p-5">
          <Input
            label="Vagas de jogador"
            type="number"
            min={1}
            max={CAMPAIGN_LIMITS.maxPlayers}
            value={Number.isFinite(draft.playerPolicy.maxPlayers) ? draft.playerPolicy.maxPlayers : ""}
            onChange={(e) => set({ playerPolicy: { ...draft.playerPolicy, maxPlayers: e.target.value === "" ? Number.NaN : Number(e.target.value) } })}
            error={errors["playerPolicy.maxPlayers"]}
            hint={`${players} jogador(es) na mesa agora. Convites pendentes também ocupam vaga até serem respondidos.`}
            containerClassName="sm:max-w-60"
          />
          <Switch
            checked={draft.playerPolicy.playersCanEditSheets}
            onChange={(v) => set({ playerPolicy: { ...draft.playerPolicy, playersCanEditSheets: v } })}
            label="Jogadores editam as próprias fichas"
            description="Desligado, só você altera as fichas (os jogadores ainda as veem e rolam testes)."
          />
          <Switch
            checked={draft.playerPolicy.playersCanMoveOwnToken}
            onChange={(v) => set({ playerPolicy: { ...draft.playerPolicy, playersCanMoveOwnToken: v } })}
            label="Jogadores movem o próprio token"
            description="Desligado, só o mestre move os tokens na mesa."
          />
          <Switch
            checked={draft.playerPolicy.allowPrivateMessages}
            onChange={(v) => set({ playerPolicy: { ...draft.playerPolicy, allowPrivateMessages: v } })}
            label="Mensagens privadas com o mestre"
            description="Sussurros entre um jogador e você no chat da mesa."
          />
          <Switch
            checked={draft.playerPolicy.rollsPublicByDefault}
            onChange={(v) => set({ playerPolicy: { ...draft.playerPolicy, rollsPublicByDefault: v } })}
            label="Rolagens públicas por padrão"
            description="Desligado, as rolagens dos jogadores aparecem primeiro só para você."
          />
          <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-fg-subtle">
            Hoje a mesa roda neste navegador; com o multiplayer real (fase de comunicação) estas regras também valem para o que cada jogador pode fazer na sala.
          </p>
          {saveBar}
        </Card>
      )}

      {tab === "players" && <Players overview={overview} reload={reload} />}
    </PageContainer>
  );
}

function Players({ overview, reload }: { overview: CampaignOverview; reload: () => Promise<void> }) {
  const user = useCurrentUser();
  const campaignId = overview.campaign.id;
  const invites = useAsync(() => campaignAdminService.listInvites(campaignId, user), [campaignId, user.id]);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const ownerId = overview.campaign.ownerId;
  const isOwner = user.id === ownerId;
  const players = overview.members.filter((m) => m.role === "player").length;
  const pending = (invites.data ?? []).filter((i) => i.status === "pending").length;
  const seats = overview.campaign.playerPolicy.maxPlayers - players - pending;

  async function act(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await action();
      toast.success(done);
      await Promise.all([reload(), invites.reload()]);
    } catch (e) {
      toast.error("Não deu certo", toUserMessage(e));
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Na mesa" icon={<Users />} description={`${players}/${overview.campaign.playerPolicy.maxPlayers} jogadores · mestres podem ser mais de um`} />
        <ul className="flex flex-col divide-y divide-line">
          {overview.members.map(({ profile, role, character }) => {
            const memberIsOwner = profile.id === ownerId;
            // Only the campaign's creator changes roles or removes other GMs; co-GMs manage players.
            const canChangeRole = isOwner && !memberIsOwner;
            const canRemove = !memberIsOwner && profile.id !== user.id && (role === "player" || isOwner);
            return (
              <li key={profile.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={profile.displayName} color={profile.avatarColor} src={profile.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {profile.displayName}
                    {role === "game_master" && <Crown className="size-3 text-accent" aria-hidden />}
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {character ? `${character.name} · ${character.concept}` : role === "game_master" ? "Mestre" : "Sem personagem"}
                    {memberIsOwner && " · criou a campanha"}
                  </p>
                </div>
                <Badge tone={role === "game_master" ? "accent" : "neutral"}>{ROLE_LABEL[role]}</Badge>
                {(canChangeRole || canRemove) && (
                  <div className="flex gap-1">
                    {canChangeRole && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={role === "game_master" ? `Tornar ${profile.displayName} jogador` : `Tornar ${profile.displayName} mestre`}
                      loading={busy === `role:${profile.id}`}
                      onClick={() => void act(`role:${profile.id}`, () => campaignAdminService.setMemberRole(campaignId, user, profile.id, role === "game_master" ? "player" : "game_master"), role === "game_master" ? `${profile.displayName} agora é jogador` : `${profile.displayName} agora também é mestre`)}
                    >
                      {role === "game_master" ? "Tornar jogador" : "Tornar mestre"}
                    </Button>
                    )}
                    {canRemove &&
                      (confirmRemove === profile.id ? (
                        <>
                          <Button size="sm" variant="danger" autoFocus aria-label={`Confirmar remoção de ${profile.displayName}`} loading={busy === `remove:${profile.id}`} onClick={() => void act(`remove:${profile.id}`, () => campaignAdminService.removeMember(campaignId, user, profile.id), `${profile.displayName} saiu da campanha`)}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(profile.id)} aria-label={`Remover ${profile.displayName}`} leadingIcon={<UserMinus className="size-3.5" />}>
                          Remover
                        </Button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="px-5 pb-4 text-xs text-fg-subtle">Ao remover alguém, o personagem continua com a pessoa, só sai da campanha.</p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Convidar" icon={<MailPlus />} description={seats > 0 ? `${seats} vaga(s) livre(s)` : "Sem vagas livres: aumente o limite em Regras da mesa."} />
          <form
            className="flex flex-col gap-3 p-5 pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSending(true);
              setInviteError(null);
              try {
                const sent = await campaignAdminService.invite(campaignId, user, emails.split(/[\s,;]+/), message);
                toast.success(sent.length ? `${sent.length} convite(s) enviado(s)` : "Esses e-mails já têm convite pendente");
                setEmails("");
                await invites.reload();
              } catch (err) {
                setInviteError(fieldErrorsOf(err).emails ?? toUserMessage(err));
              } finally {
                setSending(false);
              }
            }}
          >
            <Textarea label="E-mails" value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="ana@exemplo.com, bruno@exemplo.com" error={inviteError} />
            <Input label="Mensagem" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} optional />
            <Button type="submit" loading={sending} disabled={!emails.trim() || seats <= 0}>
              Enviar convites
            </Button>
            <p className="text-xs text-fg-subtle">No modo local o convite aparece no painel de quem tiver conta com esse e-mail neste navegador.</p>
          </form>
        </Card>

        <Card>
          <CardHeader title="Convites" description={invites.data ? `${pending} pendente(s)` : "Carregando…"} />
          <ul className="flex flex-col gap-1 p-3 pt-2">
            {(invites.data ?? []).length === 0 && <li className="px-2 py-3 text-sm text-fg-subtle">Nenhum convite ainda.</li>}
            {(invites.data ?? []).map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{i.email}</span>
                  <span className="block text-[11px] text-fg-subtle">{formatRelative(i.createdAt)}</span>
                </span>
                <Badge tone={INVITE_STATUS[i.status].tone}>{INVITE_STATUS[i.status].label}</Badge>
                {i.status === "pending" && (
                  <Button size="icon-sm" variant="ghost" loading={busy === `revoke:${i.id}`} onClick={() => void act(`revoke:${i.id}`, () => campaignAdminService.revokeInvite(campaignId, user, i.id), "Convite cancelado")} aria-label={`Cancelar convite de ${i.email}`} title="Cancelar convite">
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}
