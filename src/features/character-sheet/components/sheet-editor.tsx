"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Cloud, Eye, Loader2 } from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { AVATAR_COLORS } from "@/constants/campaign";
import { cn } from "@/lib/cn";
import type { RollMode } from "@/features/dice/dice-engine";
import { SystemTag } from "@/features/systems/components/system-identity";
import type { EditableCharacter } from "@/services/character.service";
import { checkHint, resolveCheck, type CheckRequest, type CheckResult } from "../model/checks";
import { applyClass, levelPerks } from "../model/sheet";
import { useCharacterSheet, type SaveStatus } from "../hooks/use-character-sheet";
import { AbilitiesSection, AttributesSection, CustomFieldsSection, InventorySection, SkillsSection, StorySection, type SectionProps } from "./sheet-sections";
import { CombatSection } from "./combat-section";
import { DndSection } from "./dnd-section";
import { isDnd, syncDerived } from "@/features/systems/dnd5e/rules";

type Tab = "main" | "combat" | "skills" | "abilities" | "inventory" | "custom" | "story";

/**
 * Full character sheet. Used on its own page and, embedded, inside the game
 * room (where `onRoll` publishes checks to the table chat and `onChange`
 * keeps the token's combat block in step with the sheet).
 */
export function SheetEditor({
  characterId,
  embedded = false,
  onRoll,
  onRequestCheck,
  onChange,
  liveHp,
  actions,
}: {
  characterId: string;
  embedded?: boolean;
  onRoll?: (check: CheckResult, character: EditableCharacter["character"]) => void;
  /** At a table hosted by the GM, checks are rolled there: the sheet only asks. */
  onRequestCheck?: (request: CheckRequest) => void;
  /** Called with the edited character after every local change. */
  onChange?: (data: EditableCharacter) => void;
  /** Current HP at the table; shown on the sheet as it changes (the room saves it). */
  liveHp?: number;
  actions?: (data: EditableCharacter) => React.ReactNode;
}) {
  const { data, error, reload, status, saveError, updateSheet, updateIdentity, patchLocal } = useCharacterSheet(characterId);
  const [tab, setTab] = useState<Tab>("main");
  const [mode, setMode] = useState<RollMode>("normal");
  const [last, setLast] = useState<{ id: number; check: CheckResult } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (data) onChangeRef.current?.(data);
  }, [data]);

  // Follow the table's HP only when it changes there, so an HP typed on the sheet is not undone.
  const appliedHp = useRef<number | undefined>(undefined);
  const loaded = !!data;
  useEffect(() => {
    if (liveHp === undefined || !data || appliedHp.current === liveHp) return;
    appliedHp.current = liveHp;
    const key = data.system.resources[0]?.key;
    const resource = key ? data.character.sheet.resources[key] : undefined;
    if (!key || !resource) return;
    const current = Math.min(liveHp, resource.max);
    if (resource.current !== current) patchLocal((s) => ({ ...s, resources: { ...s.resources, [key]: { ...s.resources[key], current } } }));
    // `data` is read for the current values only; reacting to it would undo edits made on the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveHp, loaded]);

  // D&D 5e: max HP, hit dice, spell slots and speed follow class, level and CON (when automatic).
  const level = data?.character.level ?? null;
  const dndSheet = data && isDnd(data.system) && data.canEdit ? data.character.sheet : null;
  useEffect(() => {
    if (dndSheet && syncDerived(dndSheet, level) !== dndSheet) updateSheet((s) => syncDerived(s, level));
  }, [dndSheet, level, updateSheet]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingState label="Abrindo ficha…" />;

  const { character, system, campaign, canEdit, canSeePrivate } = data;
  const readOnly = !canEdit;

  function check(req: CheckRequest) {
    if (onRequestCheck) return onRequestCheck({ ...req, mode: system.dice.supportsAdvantage ? mode : "normal" });
    const result = resolveCheck(system, character.sheet, character.level, { ...req, mode: system.dice.supportsAdvantage ? mode : "normal" });
    setLast({ id: Date.now(), check: result });
    onRoll?.(result, character);
  }

  const props: SectionProps = { system, sheet: character.sheet, readOnly, update: updateSheet, onCheck: check };

  return (
    <div className="flex flex-col gap-5">
      <header className={cn("flex flex-col gap-4", !embedded && "sm:flex-row sm:items-start")}>
        <PortraitPicker color={character.portraitColor} name={character.name} readOnly={readOnly} onChange={(portraitColor) => updateIdentity({ portraitColor })} />
        <div className="min-w-0 flex-1">
          <input
            aria-label="Nome do personagem"
            readOnly={readOnly}
            value={character.name}
            onChange={(e) => updateIdentity({ name: e.target.value })}
            className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-fg outline-none sm:text-3xl"
          />
          <input
            aria-label="Conceito"
            readOnly={readOnly}
            placeholder="Ancestralidade, classe, papel…"
            value={character.concept}
            onChange={(e) => updateIdentity({ concept: e.target.value })}
            className="mt-1 w-full bg-transparent text-sm text-fg-muted outline-none placeholder:text-fg-subtle"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SystemTag theme={system.theme} label={system.shortName} />
            <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
              {system.progression.label}
              <input
                type="number"
                aria-label={system.progression.label}
                readOnly={readOnly}
                min={0}
                max={system.progression.max ?? 999}
                value={character.level ?? 0}
                onChange={(e) => updateIdentity({ level: Math.max(0, Number(e.target.value) || 0) })}
                title={levelPerks(system, character.level) ?? undefined}
                className="h-7 w-14 rounded-md border border-line bg-surface-2/60 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
              />
            </label>
            {levelPerks(system, character.level) && <span className="text-xs text-fg-subtle">· {levelPerks(system, character.level)}</span>}
            {!!system.classes?.length && (
              <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
                {system.classesLabel || "Classe"}
                <select
                  aria-label={system.classesLabel || "Classe"}
                  disabled={readOnly}
                  value={character.sheet.classKey ?? ""}
                  onChange={(e) => updateSheet((s) => applyClass(system, s, e.target.value || null))}
                  className="h-7 rounded-md border border-line bg-surface-2/60 px-1.5 text-sm text-fg outline-none focus:border-accent/60"
                >
                  <option value="">—</option>
                  {system.classes.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {campaign ? (
              embedded ? (
                <Badge>{campaign.name}</Badge>
              ) : (
                <Link href={`/campaign/${campaign.id}`} className="text-xs text-fg-subtle hover:text-accent">
                  em {campaign.name}
                </Link>
              )
            ) : (
              <span className="text-xs text-fg-subtle">sem campanha</span>
            )}
            <SaveIndicator status={status} error={saveError} readOnly={readOnly} />
          </div>
        </div>
        {!embedded && actions?.(data)}
      </header>

      <div className={cn("grid gap-5", !embedded && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="min-w-0">
          <Tabs
            size="sm"
            className="mb-4"
            value={tab}
            onChange={setTab}
            items={[
              { value: "main", label: "Ficha" },
              { value: "combat", label: "Combate", count: character.sheet.combat.attacks.length || undefined },
              { value: "skills", label: "Perícias", count: system.skills.length || undefined },
              { value: "abilities", label: "Habilidades", count: character.sheet.abilities.length || undefined },
              { value: "inventory", label: "Inventário", count: character.sheet.inventory.length || undefined },
              { value: "custom", label: "Campos" },
              { value: "story", label: "História" },
            ]}
          />
          {tab === "main" && (
            <div className="flex flex-col gap-4">
              {isDnd(system) && <DndSection {...props} level={character.level} />}
              <AttributesSection {...props} />
            </div>
          )}
          {tab === "combat" && <CombatSection {...props} level={character.level} />}
          {tab === "skills" && <SkillsSection {...props} />}
          {tab === "abilities" && <AbilitiesSection {...props} />}
          {tab === "inventory" && <InventorySection {...props} />}
          {tab === "custom" && <CustomFieldsSection {...props} />}
          {tab === "story" && <StorySection {...props} canSeePrivate={canSeePrivate} />}
        </div>

        <aside className={cn("flex flex-col gap-3", embedded ? "order-first" : "xl:sticky xl:top-6 xl:self-start")}>
          <RollPanel last={last} hint={checkHint(system)} supportsAdvantage={system.dice.supportsAdvantage} mode={mode} onMode={setMode} postsToChat={!!onRoll} />
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ status, error, readOnly }: { status: SaveStatus; error: string | null; readOnly: boolean }) {
  if (readOnly)
    return (
      <Badge>
        <Eye className="size-3" /> somente leitura
      </Badge>
    );
  const map = {
    idle: { icon: <Cloud className="size-3" />, text: "Salvamento automático", tone: "text-fg-subtle" },
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: "Salvando…", tone: "text-fg-muted" },
    saved: { icon: <Check className="size-3" />, text: "Salvo", tone: "text-success" },
    error: { icon: <AlertCircle className="size-3" />, text: error ?? "Erro ao salvar", tone: "text-danger" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", map.tone)} role="status">
      {map.icon}
      {map.text}
    </span>
  );
}

function PortraitPicker({ color, name, readOnly, onChange }: { color: string; name: string; readOnly: boolean; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button type="button" disabled={readOnly} onClick={() => setOpen((v) => !v)} aria-label="Cor do retrato" className="rounded-2xl disabled:cursor-default">
        <Avatar name={name || "?"} color={color} size="xl" className="rounded-2xl" />
      </button>
      {open && !readOnly && (
        <div className="absolute left-0 top-full z-20 mt-2 flex gap-1.5 rounded-xl border border-line-strong bg-surface-2 p-2 shadow-xl">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface-2", c === color && "ring-2 ring-fg/70")}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TONE: Record<CheckResult["tone"], string> = {
  success: "text-success",
  critical: "text-success",
  failure: "text-danger",
  fumble: "text-danger",
  neutral: "text-accent",
};

function RollPanel({
  last,
  hint,
  supportsAdvantage,
  mode,
  onMode,
  postsToChat,
}: {
  last: { id: number; check: CheckResult } | null;
  hint: string;
  supportsAdvantage: boolean;
  mode: RollMode;
  onMode: (m: RollMode) => void;
  postsToChat: boolean;
}) {
  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Última rolagem</h3>
        {postsToChat && <span className="text-[10px] text-fg-subtle">publicada no chat</span>}
      </div>
      <AnimatePresence mode="wait">
        {last ? (
          <motion.div key={last.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-3">
            <motion.span
              initial={{ scale: 0.4, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 font-mono text-2xl font-semibold", TONE[last.check.tone])}
            >
              {last.check.result.total}
            </motion.span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{last.check.label}</p>
              <p className="font-mono text-[11px] text-fg-subtle">
                {last.check.result.formula} · [{last.check.result.dice.map((d) => (d.kept ? d.value : `~${d.value}~`)).join(", ")}]
              </p>
              {last.check.outcome && <p className={cn("text-xs font-medium", TONE[last.check.tone])}>{last.check.outcome}</p>}
            </div>
          </motion.div>
        ) : (
          <p className="mt-3 text-sm text-fg-subtle">Clique no dado ao lado de um atributo ou perícia.</p>
        )}
      </AnimatePresence>
      <p className="mt-3 text-[11px] text-fg-subtle">{hint}</p>
      {supportsAdvantage && (
        <div className="mt-2 flex gap-1">
          {(["normal", "advantage", "disadvantage"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              aria-pressed={mode === m}
              className={cn("h-7 flex-1 rounded-md border text-[11px]", mode === m ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted")}
            >
              {m === "normal" ? "Normal" : m === "advantage" ? "Vantagem" : "Desvantagem"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
