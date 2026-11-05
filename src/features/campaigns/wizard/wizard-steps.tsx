"use client";

import type { ReactNode } from "react";
import { Check, Minus, Plus, Wand2 } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { NARRATION_STYLES, VISUAL_STYLES, WORLD_TONES } from "@/constants/campaign";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration } from "@/lib/format";
import { CAMPAIGN_LIMITS } from "@/services/campaign.service";
import { systemService } from "@/services/system.service";
import { coverGradient, SystemEmblem, SystemGlyphIcon, systemStyle } from "@/features/systems/components/system-identity";
import { getBuiltInSystem } from "@/features/systems/templates";
import { DIE_TYPES } from "@/types/system";
import type { CampaignDraft } from "./wizard-model";
import { toScheduledIso } from "./wizard-model";

export type StepProps = {
  draft: CampaignDraft;
  errors: Record<string, string>;
  update: <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => void;
};

/* ---------- 1. Nome ---------- */

export function NameStep({ draft, errors, update }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Nome da campanha"
        autoFocus
        placeholder="Ex.: As Cinzas de Valdrith"
        value={draft.name}
        onChange={(e) => update("name", e.target.value)}
        error={errors.name}
        maxLength={CAMPAIGN_LIMITS.nameMax}
        className="h-12 font-display text-lg"
        hint={`${draft.name.trim().length}/${CAMPAIGN_LIMITS.nameMax}`}
      />
      <Textarea
        label="Chamada"
        optional
        rows={3}
        placeholder="Uma frase que faça os jogadores quererem estar na mesa."
        value={draft.tagline}
        onChange={(e) => update("tagline", e.target.value)}
        error={errors.tagline}
        hint="Aparece nos cards da campanha e nos convites."
      />
    </div>
  );
}

/* ---------- 2. Sistema ---------- */

export function SystemStep({ draft, errors, update }: StepProps) {
  const systems = systemService.listBuiltIn();
  const selected = draft.systemMode === "builtin" ? getBuiltInSystem(draft.builtinId) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {systems.map((s) => {
          const active = draft.systemMode === "builtin" && draft.builtinId === s.id;
          return (
            <ChoiceCard
              key={s.id}
              active={active}
              onClick={() => {
                update("systemMode", "builtin");
                update("builtinId", s.id as CampaignDraft["builtinId"]);
              }}
              style={systemStyle(s.theme)}
              activeClass="border-system/60 bg-system/10"
            >
              <SystemEmblem theme={s.theme} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{s.shortName}</span>
                <span className="block truncate text-[11px] text-fg-subtle">{s.genres[0]}</span>
              </span>
            </ChoiceCard>
          );
        })}
        <ChoiceCard active={draft.systemMode === "custom"} onClick={() => update("systemMode", "custom")} activeClass="border-accent/60 bg-accent/10">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Wand2 className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">Sistema próprio</span>
            <span className="block truncate text-[11px] text-fg-subtle">Crie do seu jeito</span>
          </span>
        </ChoiceCard>
      </div>

      {selected ? (
        <div className="rounded-xl border border-line bg-surface-2/40 p-4" style={systemStyle(selected.theme)}>
          <p className="text-sm font-medium">{selected.name}</p>
          <p className="mt-1 text-sm text-fg-muted">{selected.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <code className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-system">{selected.dice.defaultFormula}</code>
            <Badge>{selected.attributes.map((a) => a.abbreviation).join(" · ")}</Badge>
            <Badge>{selected.resources.map((r) => r.label).join(" · ")}</Badge>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-accent/25 bg-accent/5 p-4">
          <Input
            label="Nome do sistema"
            placeholder="Ex.: Crônicas do Abismo"
            value={draft.custom.name}
            onChange={(e) => update("custom", { ...draft.custom, name: e.target.value })}
            error={errors["system.name"]}
            maxLength={40}
          />
          <Textarea
            label="Universo e temática"
            optional
            rows={2}
            placeholder="Fantasia sombria em ilhas flutuantes, magia rara e perigosa…"
            value={draft.custom.theme}
            onChange={(e) => update("custom", { ...draft.custom, theme: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Dado principal</span>
            <div className="flex flex-wrap gap-1.5">
              {DIE_TYPES.map((die) => (
                <button
                  key={die}
                  type="button"
                  aria-pressed={draft.custom.primaryDie === die}
                  onClick={() => update("custom", { ...draft.custom, primaryDie: die })}
                  className={cn(
                    "h-8 min-w-12 rounded-lg border px-2 font-mono text-xs uppercase transition-colors",
                    draft.custom.primaryDie === die ? "border-accent/60 bg-accent-solid text-accent-fg" : "border-line text-fg-muted hover:border-line-strong",
                  )}
                >
                  {die}
                </button>
              ))}
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            Começa com 3 atributos, vida e energia. Depois, em Sistemas, o editor ajusta atributos, perícias, classes, progressão e campos da ficha.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- 3. Estilo visual ---------- */

export function StyleStep({ draft, update, theme }: StepProps & { theme: Parameters<typeof systemStyle>[0] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {VISUAL_STYLES.map((style) => {
        const active = draft.visualStyleId === style.id;
        return (
          <button
            key={style.id}
            type="button"
            aria-pressed={active}
            onClick={() => update("visualStyleId", style.id)}
            className={cn(
              "group overflow-hidden rounded-xl border text-left transition-colors",
              active ? "border-accent/60 ring-2 ring-accent/20" : "border-line hover:border-line-strong",
            )}
          >
            <div className="relative h-20" style={{ background: coverGradient(style.gradient) }}>
              <div className="bg-tabletop-grid absolute inset-0 opacity-50" />
              <span className="absolute bottom-2 right-3" style={systemStyle(theme)}>
                <SystemGlyphIcon glyph={theme.glyph} className="size-8 text-system opacity-30" />
              </span>
              {active && (
                <span className="absolute left-3 top-3 flex size-5 items-center justify-center rounded-full bg-accent-solid text-accent-fg">
                  <Check className="size-3" />
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2.5 rounded-full" style={{ background: style.accent }} />
                {style.name}
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle">{style.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 4. Mestre ---------- */

export function MasterStep({ draft, errors, update }: StepProps) {
  const gm = draft.gameMaster;
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Nome do narrador"
        value={gm.narratorName}
        onChange={(e) => update("gameMaster", { ...gm, narratorName: e.target.value })}
        error={errors["gameMaster.narratorName"]}
        hint="Assina as mensagens do mestre na mesa. Pode ser você ou uma persona, como “O Cronista”."
        maxLength={40}
      />
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-fg-muted">Estilo de narração</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {NARRATION_STYLES.map((n) => (
            <ChoiceCard
              key={n.id}
              active={gm.narrationStyle === n.id}
              onClick={() => update("gameMaster", { ...gm, narrationStyle: n.id })}
              activeClass="border-accent/60 bg-accent/8"
              className="items-start"
            >
              <span>
                <span className="block text-sm font-medium">{n.label}</span>
                <span className="block text-xs text-fg-subtle">{n.description}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <Textarea
        label="Anotações do mestre"
        optional
        rows={3}
        placeholder="Ideias, segredos, ganchos. Só você vê."
        value={gm.notes}
        onChange={(e) => update("gameMaster", { ...gm, notes: e.target.value })}
        hint="Privado: jogadores nunca recebem este conteúdo."
      />
    </div>
  );
}

/* ---------- 5. Jogadores ---------- */

export function PlayersStep({ draft, errors, update }: StepProps) {
  const policy = draft.playerPolicy;
  const setPolicy = (patch: Partial<typeof policy>) => update("playerPolicy", { ...policy, ...patch });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Vagas de jogador</p>
          <p className="text-xs text-fg-subtle">Sem contar o mestre. Máximo de {CAMPAIGN_LIMITS.maxPlayers}.</p>
          {errors["playerPolicy.maxPlayers"] && <p className="mt-1 text-xs text-danger">{errors["playerPolicy.maxPlayers"]}</p>}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/60 p-1">
          <StepperButton label="Menos vagas" disabled={policy.maxPlayers <= 1} onClick={() => setPolicy({ maxPlayers: policy.maxPlayers - 1 })}>
            <Minus className="size-3.5" />
          </StepperButton>
          <span className="w-8 text-center font-mono text-lg tabular-nums" aria-live="polite">
            {policy.maxPlayers}
          </span>
          <StepperButton label="Mais vagas" disabled={policy.maxPlayers >= CAMPAIGN_LIMITS.maxPlayers} onClick={() => setPolicy({ maxPlayers: policy.maxPlayers + 1 })}>
            <Plus className="size-3.5" />
          </StepperButton>
        </div>
      </div>

      <p className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-fg-muted">
        Ao criar a campanha você recebe um <strong className="text-fg">link de convite</strong> para mandar aos jogadores (WhatsApp, Discord…). Ele fica em Configurações → Jogadores.
      </p>

      <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Permissões dos jogadores</p>
        <Switch checked={policy.playersCanEditSheets} onChange={(v) => setPolicy({ playersCanEditSheets: v })} label="Editar a própria ficha" />
        <Switch checked={policy.playersCanMoveOwnToken} onChange={(v) => setPolicy({ playersCanMoveOwnToken: v })} label="Mover o próprio token no mapa" />
        <Switch checked={policy.allowPrivateMessages} onChange={(v) => setPolicy({ allowPrivateMessages: v })} label="Mensagens privadas com o mestre" />
        <Switch
          checked={policy.rollsPublicByDefault}
          onChange={(v) => setPolicy({ rollsPublicByDefault: v })}
          label="Rolagens públicas por padrão"
          description="O mestre sempre pode rolar em segredo."
        />
      </div>
    </div>
  );
}

/* ---------- 6. Mundo ---------- */

const MAX_TONES = 4;

export function WorldStep({ draft, errors, update }: StepProps) {
  const world = draft.world;
  const setWorld = (patch: Partial<typeof world>) => update("world", { ...world, ...patch });

  function toggleTone(tone: string) {
    const has = world.tone.includes(tone);
    if (!has && world.tone.length >= MAX_TONES) return;
    setWorld({ tone: has ? world.tone.filter((t) => t !== tone) : [...world.tone, tone] });
  }

  return (
    <div className="flex flex-col gap-5">
      <Input label="Nome do mundo ou cenário" optional placeholder="Ex.: Valdrith" value={world.name} onChange={(e) => setWorld({ name: e.target.value })} error={errors["world.name"]} maxLength={60} />
      <Textarea
        label="Premissa"
        optional
        rows={4}
        placeholder="O que está em jogo quando a história começa?"
        value={world.premise}
        onChange={(e) => setWorld({ premise: e.target.value })}
        error={errors["world.premise"]}
        hint={`${world.premise.length}/600`}
      />
      <fieldset>
        <legend className="mb-2 flex w-full justify-between text-xs font-medium text-fg-muted">
          <span>Tom da campanha</span>
          <span className="font-mono text-[11px] text-fg-subtle">
            {world.tone.length}/{MAX_TONES}
          </span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {WORLD_TONES.map((tone) => {
            const active = world.tone.includes(tone);
            return (
              <button
                key={tone}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTone(tone)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                  active ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {tone}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Input label="Ponto de partida" optional placeholder="Onde os personagens estão na primeira cena?" value={world.startingLocation} onChange={(e) => setWorld({ startingLocation: e.target.value })} />
    </div>
  );
}

/* ---------- 7. Primeira sessão + revisão ---------- */

const DURATIONS = [120, 180, 240, 300];

export function SessionStep({ draft, errors, update, systemName }: StepProps & { systemName: string }) {
  const fs = draft.firstSession;
  const setSession = (patch: Partial<typeof fs>) => update("firstSession", { ...fs, ...patch });
  const scheduled = toScheduledIso(fs.date, fs.time);
  const style = VISUAL_STYLES.find((s) => s.id === draft.visualStyleId);

  return (
    <div className="flex flex-col gap-6">
      <Switch
        checked={draft.scheduleFirstSession}
        onChange={(v) => update("scheduleFirstSession", v)}
        label="Agendar a primeira sessão agora"
        description="Sem sessão agendada, a campanha começa como “Em preparação”."
      />

      {draft.scheduleFirstSession && (
        <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <Input label="Título" value={fs.title} onChange={(e) => setSession({ title: e.target.value })} error={errors["firstSession.title"]} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Data" type="date" value={fs.date} onChange={(e) => setSession({ date: e.target.value })} error={errors["firstSession.scheduledAt"]} />
            <Input label="Horário" type="time" value={fs.time} onChange={(e) => setSession({ time: e.target.value })} />
            <Select label="Duração" value={fs.durationMinutes} onChange={(e) => setSession({ durationMinutes: Number(e.target.value) })}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Notas da sessão" optional rows={2} placeholder="Sessão zero: alinhar expectativas e criar personagens." value={fs.notes} onChange={(e) => setSession({ notes: e.target.value })} />
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface-2/40 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">Revisão</p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Review label="Campanha" value={draft.name || "—"} />
          <Review label="Sistema" value={systemName} />
          <Review label="Estilo visual" value={style?.name ?? "—"} />
          <Review label="Narrador" value={draft.gameMaster.narratorName || "—"} />
          <Review label="Jogadores" value={`${draft.playerPolicy.maxPlayers} vagas · convite por link`} />
          <Review label="Mundo" value={[draft.world.name, draft.world.tone.join(", ")].filter(Boolean).join(" · ") || "—"} />
          <Review label="Primeira sessão" value={draft.scheduleFirstSession ? (scheduled ? formatDateTime(scheduled) : "Data incompleta") : "Não agendada"} />
        </dl>
      </section>
    </div>
  );
}

/* ---------- Shared bits ---------- */

function ChoiceCard({
  active,
  onClick,
  children,
  className,
  activeClass,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  activeClass: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors",
        active ? activeClass : "border-line bg-surface hover:border-line-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

function StepperButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-fg">{value}</dd>
    </div>
  );
}
