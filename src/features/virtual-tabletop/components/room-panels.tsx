"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Crown, Dices, EyeOff, Lock, Minus, Plus, ScrollText, Send, Shield, ShieldHalf, Sparkles, Star, Swords, X, Zap } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SheetEditor } from "@/features/character-sheet/components/sheet-editor";
import { Button } from "@/components/ui/button";
import { Badge, ResourceBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { DIE_TYPES } from "@/types/system";
import { supportsAdvantage, type RollMode } from "@/features/dice/dice-engine";
import { formatAttackValue, formatDefense, formatInitiative } from "@/features/combat/model/rules";
import { CHARACTER_GROUP_LABEL, CHARACTER_MODELS, modelFor, type CharacterModel } from "../model/character-models";
import { gridDistance } from "../model/map";
import { currentTurnToken, isDown } from "../model/room-engine";
import type { ChatMessage, MessageVisibility, RoomState, RoomToken } from "../model/types";
import type { RoomActions } from "../hooks/use-room-actions";
import { useRoomStore } from "../store/room.store";

/* ---------- Combat & initiative ---------- */

export function CombatPanel({ room, actions }: { room: RoomState; actions: RoomActions }) {
  const select = useRoomStore((s) => s.select);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const autoEnemies = useRoomStore((s) => s.autoEnemies);
  const running = useRoomStore((s) => s.botsRunning);
  const current = currentTurnToken(room);
  const byId = new Map(room.tokens.map((t) => [t.id, t]));

  const waiting =
    current && (current.controller === "bot" || (current.kind === "enemy" && autoEnemies))
      ? running
        ? `${current.name} está agindo…`
        : "Bots pausados: retome ou avance o turno."
      : current
        ? `Vez de ${current.name}: mova, ataque e avance.`
        : null;

  const row = (token: RoomToken, initiative?: number) => (
    <li key={token.id}>
      <button
        onClick={() => select(token.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
          token.id === current?.id ? "border-accent/60 bg-accent/10" : token.id === selectedId ? "border-line-strong bg-surface-2" : "border-transparent hover:bg-surface-2/60",
          isDown(token) && "opacity-50",
        )}
      >
        {initiative !== undefined && <span className="w-6 text-center font-mono text-sm tabular-nums text-fg-muted">{initiative}</span>}
        <span className="size-7 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: token.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
            {token.name}
            {token.controller === "bot" && <Bot className="size-3.5 text-accent" aria-label="Bot" />}
          </span>
          <ResourceBar value={token.hp.current} max={token.hp.max} color={token.kind === "enemy" ? "var(--color-danger)" : "var(--color-success)"} className="mt-1" />
        </span>
      </button>
    </li>
  );

  if (!room.combat.active) {
    const party = room.tokens.filter((t) => t.kind !== "enemy");
    const enemies = room.tokens.filter((t) => t.kind === "enemy");
    return (
      <div className="flex flex-col gap-4">
        <Button onClick={actions.startCombat} leadingIcon={<Swords className="size-4" />} className="w-full">
          Iniciar combate
        </Button>
        <Group title={`Grupo (${party.length})`}>{party.map((t) => row(t))}</Group>
        <Group title={`Inimigos (${enemies.length})`}>{enemies.map((t) => row(t))}</Group>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Badge tone="accent" dot>
          Rodada {room.combat.round}
        </Badge>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={actions.nextTurn}>
            Próximo turno
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.endCombat()}>
            Encerrar
          </Button>
        </div>
      </div>
      {waiting && <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">{waiting}</p>}
      <ol className="flex flex-col gap-1">
        {room.combat.order.map((o) => {
          const token = byId.get(o.tokenId);
          return token ? row(token, o.initiative) : null;
        })}
      </ol>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{title}</h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

/* ---------- Chat ---------- */

export function ChatPanel({ room, actions, gmId }: { room: RoomState; actions: RoomActions; gmId: string }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState("all");
  const listRef = useRef<HTMLDivElement>(null);
  const recipients = room.tokens.filter((t) => t.kind !== "enemy");
  const count = room.messages.length;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    actions.sendChat(text, recipients.find((r) => r.id === to));
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-2" aria-live="polite">
        {room.messages.length === 0 && <p className="py-8 text-center text-sm text-fg-subtle">Nenhuma mensagem ainda.</p>}
        {room.messages.map((m) => (
          <MessageItem key={m.id} message={m} mine={m.author.id === gmId} />
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-to" className="text-xs text-fg-subtle">
            Para
          </label>
          <select
            id="chat-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-7 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-accent/60"
          >
            <option value="all">Todos (chat geral)</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                Privado · {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={to === "all" ? "Mensagem, /r 1d20+3, /gm 1d20, /w Nome…" : "Mensagem privada…"}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-accent/60"
            aria-label="Mensagem"
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageItem({ message: m, mine }: { message: ChatMessage; mine: boolean }) {
  if (m.kind === "system") {
    return <p className="px-2 py-1 text-center text-xs text-fg-subtle">{m.text}</p>;
  }
  if (m.kind === "epic") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
        <Star className="mt-0.5 size-4 shrink-0 fill-accent text-accent" />
        <span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-accent">Momento épico</span>
          {m.text}
        </span>
      </div>
    );
  }
  return (
    <div className={cn("rounded-lg px-3 py-2", m.kind === "whisper" ? "border border-dashed border-accent/40 bg-accent/5" : mine ? "bg-surface-2" : "bg-surface-2/50")}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px]">
        <span className="size-2 rounded-full" style={{ background: m.author.color }} />
        <span className="font-medium text-fg">{m.author.name}</span>
        {m.kind === "whisper" && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Lock className="size-3" /> {mine ? `para ${m.to?.name}` : "privado"}
          </span>
        )}
        {m.visibility === "gm" && m.kind === "roll" && (
          <span className="inline-flex items-center gap-1 text-fg-subtle">
            <EyeOff className="size-3" /> só mestre
          </span>
        )}
        <span className="ml-auto font-mono text-fg-subtle">{formatTime(m.at)}</span>
      </div>
      {m.roll ? <RollCard message={m} /> : <p className="text-sm leading-relaxed text-fg-muted">{m.text}</p>}
    </div>
  );
}

function RollCard({ message }: { message: ChatMessage }) {
  const r = message.roll!;
  const crit = r.natural === 20;
  const fumble = r.natural === 1;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-fg-subtle">{r.label ?? r.formula}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {r.dice.map((d, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-mono text-xs",
                d.kept ? "bg-surface-3 text-fg" : "bg-surface-3/40 text-fg-subtle line-through",
                d.kept && d.sides === 20 && d.value === 20 && "bg-success/20 text-success",
                d.kept && d.sides === 20 && d.value === 1 && "bg-danger/20 text-danger",
              )}
              title={`d${d.sides}`}
            >
              {d.value}
            </span>
          ))}
          {r.modifier !== 0 && <span className="font-mono text-xs text-fg-subtle">{r.modifier > 0 ? `+${r.modifier}` : r.modifier}</span>}
          {r.mode !== "normal" && <Badge tone="info">{r.mode === "advantage" ? "vantagem" : "desvantagem"}</Badge>}
        </div>
      </div>
      <motion.span
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-semibold",
          crit ? "bg-success/20 text-success" : fumble ? "bg-danger/20 text-danger" : "bg-accent-solid/20 text-accent",
        )}
      >
        {r.total}
      </motion.span>
    </div>
  );
}

/* ---------- Dice roller ---------- */

export function DicePanel({ actions }: { actions: RoomActions }) {
  const [pool, setPool] = useState<Record<string, number>>({});
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<RollMode>("normal");
  const [visibility, setVisibility] = useState<MessageVisibility>("public");

  const terms = DIE_TYPES.filter((d) => pool[d]).map((d) => `${pool[d]}${d}`);
  const formula = terms.length ? `${terms.join("+")}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}` : "";
  const canAdvantage = !!formula && supportsAdvantage(formula);

  function rollNow() {
    if (!formula) return;
    if (actions.rollDice(formula, { mode: canAdvantage ? mode : "normal", visibility })) {
      setPool({});
      setModifier(0);
      setMode("normal");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        {DIE_TYPES.map((d) => (
          <button
            key={d}
            onClick={() => setPool((p) => ({ ...p, [d]: (p[d] ?? 0) + 1 }))}
            onContextMenu={(e) => {
              e.preventDefault();
              setPool((p) => ({ ...p, [d]: Math.max(0, (p[d] ?? 0) - 1) }));
            }}
            className="relative flex h-14 flex-col items-center justify-center rounded-xl border border-line bg-surface-2/60 transition-colors hover:border-accent/50 hover:bg-surface-2"
            title="Clique para adicionar · botão direito para remover"
          >
            <Dices className="size-4 text-fg-subtle" />
            <span className="mt-0.5 font-mono text-xs uppercase">{d}</span>
            {!!pool[d] && (
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-accent-solid font-mono text-[10px] text-accent-fg">
                {pool[d]}
              </span>
            )}
          </button>
        ))}
        <div className="flex h-14 flex-col items-center justify-center rounded-xl border border-line">
          <span className="text-[10px] text-fg-subtle">mod.</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setModifier((m) => m - 1)} aria-label="Diminuir modificador" className="text-fg-subtle hover:text-fg">
              <Minus className="size-3" />
            </button>
            <span className="w-6 text-center font-mono text-xs tabular-nums">{modifier >= 0 ? `+${modifier}` : modifier}</span>
            <button onClick={() => setModifier((m) => m + 1)} aria-label="Aumentar modificador" className="text-fg-subtle hover:text-fg">
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["normal", "advantage", "disadvantage"] as const).map((m) => (
          <Chip key={m} active={mode === m} disabled={m !== "normal" && !canAdvantage} onClick={() => setMode(m)}>
            {m === "normal" ? "Normal" : m === "advantage" ? "Vantagem" : "Desvantagem"}
          </Chip>
        ))}
        <span className="mx-1 w-px bg-line" />
        <Chip active={visibility === "public"} onClick={() => setVisibility("public")}>
          Pública
        </Chip>
        <Chip active={visibility === "gm"} onClick={() => setVisibility("gm")}>
          <EyeOff className="size-3" /> Só mestre
        </Chip>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex h-10 flex-1 items-center rounded-lg bg-surface-2 px-3 font-mono text-sm text-accent">{formula || "Escolha os dados"}</code>
        {formula && (
          <Button variant="ghost" size="icon" aria-label="Limpar" onClick={() => setPool({})}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      <Button size="lg" onClick={rollNow} disabled={!formula} leadingIcon={<Dices className="size-4" />}>
        Rolar
      </Button>
      <p className="text-[11px] text-fg-subtle">O resultado aparece no chat. Vantagem e desvantagem valem para um único d20.</p>
    </div>
  );
}

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-40",
        active ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Selected token ---------- */

const CONDITIONS = ["Atordoado", "Envenenado", "Amedrontado", "Contido", "Invisível"];

export function TokenInspector({ room, token, actions }: { room: RoomState; token: RoomToken; actions: RoomActions }) {
  const select = useRoomStore((s) => s.select);
  const [amount, setAmount] = useState(5);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attackId, setAttackId] = useState<string | null>(null);
  const { rules } = room;
  const chosen = token.stats.attacks.find((a) => a.id === attackId) ?? token.stats.attacks[0];
  const foesInReach = chosen
    ? room.tokens.filter((t) => !isDown(t) && !isDown(token) && (token.kind === "enemy" ? t.kind !== "enemy" : t.kind === "enemy") && gridDistance(t, token) <= chosen.range)
    : [];

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={token.id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-line bg-surface-2/50 p-3"
        aria-label={`Token selecionado: ${token.name}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 size-9 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: token.color }} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {token.name}
              {token.controller === "bot" && <Badge tone="accent">bot</Badge>}
              {token.kind === "enemy" && <Badge tone="danger">inimigo</Badge>}
            </p>
            <p className="truncate text-xs text-fg-subtle">
              {token.concept} · {token.ownerName}
            </p>
          </div>
          <button onClick={() => select(null)} aria-label="Fechar" className="text-fg-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
          Aparência
          <select
            value={modelFor(token).id}
            onChange={(e) => actions.setAppearance(token, e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-accent/60"
          >
            {(Object.keys(CHARACTER_GROUP_LABEL) as CharacterModel["group"][]).map((group) => (
              <optgroup key={group} label={CHARACTER_GROUP_LABEL[group]}>
                {CHARACTER_MODELS.filter((m) => m.group === group).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <ResourceBar className="mt-3" label="Pontos de vida" value={token.hp.current} max={token.hp.max} color={token.kind === "enemy" ? "var(--color-danger)" : "var(--color-success)"} />
        <div className="mt-2 flex items-center gap-1.5">
          <Button size="sm" variant="danger" onClick={() => actions.adjustHp(token, -amount)}>
            Dano
          </Button>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            className="h-8 w-14 rounded-md border border-line bg-surface-2 text-center font-mono text-sm outline-none focus:border-accent/60"
            aria-label="Quantidade"
          />
          <Button size="sm" variant="secondary" onClick={() => actions.adjustHp(token, amount)} className="text-success">
            Cura
          </Button>
        </div>

        <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          <Stat icon={<Shield className="size-3" />} label="Def" title={rules.defenseLabel} value={formatDefense(rules, token.stats.defense)} />
          <Stat icon={<ShieldHalf className="size-3" />} label="Arm." title="Armadura: reduz o dano" value={token.stats.armor} />
          <Stat icon={<Zap className="size-3" />} label="Inic." title="Iniciativa" value={formatInitiative(rules, token.stats)} />
          <Stat icon={<Sparkles className="size-3" />} label="Desl." title="Deslocamento por turno" value={`${token.stats.speed}□`} />
        </dl>

        {token.stats.attacks.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1" role="radiogroup" aria-label="Ataque">
            {token.stats.attacks.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === chosen?.id}
                onClick={() => setAttackId(a.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                  a.id === chosen?.id ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-fg-muted hover:text-fg",
                )}
              >
                <Swords className="size-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="font-mono text-accent">{formatAttackValue(rules, a)}</span>
                <span className="font-mono text-fg-subtle">{a.damage}</span>
                <span className="text-fg-subtle">{a.range > 1 ? `${a.range}□` : "c.a.c."}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-fg-subtle">Sem ataques{token.characterId ? " na ficha (aba Combate)." : "."}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {CONDITIONS.map((c) => (
            <Chip key={c} active={token.conditions.includes(c)} onClick={() => actions.toggleCondition(token, c)}>
              {c}
            </Chip>
          ))}
          {token.conditions.includes("Caído") && <Badge tone="danger">Caído</Badge>}
        </div>

        {token.controller !== "bot" && chosen && foesInReach.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {foesInReach.map((foe) => (
              <Button key={foe.id} size="sm" variant="secondary" leadingIcon={<Swords className="size-3.5" />} onClick={() => actions.attackWith(token, foe, chosen.id)}>
                Atacar {foe.name}
              </Button>
            ))}
          </div>
        )}
        {token.characterId && (
          <Button size="sm" variant="secondary" className="mt-3 w-full" leadingIcon={<ScrollText className="size-3.5" />} onClick={() => setSheetOpen(true)}>
            Abrir ficha
          </Button>
        )}
        {token.characterId && (
          <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Ficha · ${token.name}`} description="Testes rolados aqui vão para o chat da mesa." placement="right">
            <SheetEditor characterId={token.characterId} embedded onRoll={(check) => actions.postCheck(token, check)} onChange={(data) => actions.applySheetSoon(token.id, data)} />
          </Modal>
        )}
        {token.controller === "gm" && token.kind !== "enemy" && <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-fg-subtle"><Crown className="size-3" /> Controlado pelo mestre</p>}
      </motion.section>
    </AnimatePresence>
  );
}

function Stat({ icon, label, value, title }: { icon: React.ReactNode; label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-md bg-surface-3/60 px-1 py-1.5" title={title}>
      <dt className="flex items-center justify-center gap-1 text-[10px] text-fg-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-xs">{value}</dd>
    </div>
  );
}
