"use client";

import { useState } from "react";
import { Coins, Dices, Hotel, ScrollText, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { NpcAttitude, NpcInput } from "@/types/gm";
import { ATTITUDE_LABEL } from "../model/npc";
import { generateHook, generateName, generateNpc, generatePlace, generateTreasure, SETTING_LABEL, THREAT_LABEL, type Setting, type ThreatLevel } from "../model/generators";
import type { GmTools } from "../hooks/use-gm-tools";

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

/** Quick ideas while preparing or improvising: names, NPCs, places, treasure, plot hooks. */
export function GeneratorsPanel({ campaignId, initialSetting, tools, onNpcSaved }: { campaignId: string; initialSetting: Setting; tools: GmTools; onNpcSaved: (id: string) => void }) {
  const [setting, setSetting] = useState<Setting>(initialSetting);
  const [threat, setThreat] = useState<ThreatLevel>("common");
  const [attitude, setAttitude] = useState<NpcAttitude>("neutral");
  const [npc, setNpc] = useState<NpcInput | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [place, setPlace] = useState<string | null>(null);
  const [treasure, setTreasure] = useState<string[]>([]);
  const [hook, setHook] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-subtle">Cenário</span>
        {(Object.keys(SETTING_LABEL) as Setting[]).map((s) => (
          <Chip key={s} active={setting === s} onClick={() => setSetting(s)}>
            {SETTING_LABEL[s]}
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="NPC rápido" icon={<UserRound />} description="Nome, conceito, jeito, desejo e segredo." />
          <div className="flex flex-col gap-3 p-5 pt-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(THREAT_LABEL) as ThreatLevel[]).map((t) => (
                <Chip key={t} active={threat === t} onClick={() => setThreat(t)}>
                  {THREAT_LABEL[t]}
                </Chip>
              ))}
              <span className="mx-1 w-px bg-line" />
              {(Object.keys(ATTITUDE_LABEL) as NpcAttitude[]).map((a) => (
                <Chip key={a} active={attitude === a} onClick={() => setAttitude(a)}>
                  {ATTITUDE_LABEL[a]}
                </Chip>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setNpc(generateNpc(campaignId, setting, newSeed(), { threat, attitude }))} leadingIcon={<Dices className="size-4" />}>
              Gerar NPC
            </Button>
            {npc && (
              <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-sm" aria-live="polite">
                <p className="font-semibold">{npc.name}</p>
                <p className="text-fg-muted">{npc.description}</p>
                <p className="mt-1 text-xs text-fg-subtle">{npc.secretNotes}</p>
                <p className="mt-1 font-mono text-[11px] text-fg-subtle">
                  PV {npc.stats.hp} · Def {npc.stats.defense} · +{npc.stats.attackBonus} · {npc.stats.damage}
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  loading={saving}
                  onClick={async () => {
                    setSaving(true);
                    // The service sets the campaign itself.
                    const saved = await tools.saveNpc(npc);
                    setSaving(false);
                    if (saved) onNpcSaved(saved.id);
                  }}
                  leadingIcon={<UserPlus className="size-3.5" />}
                >
                  Salvar como NPC
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Nomes" icon={<ScrollText />} description="Cinco de uma vez." />
          <div className="flex flex-col gap-3 p-5 pt-3">
            <Button variant="secondary" onClick={() => setNames(Array.from({ length: 5 }, () => generateName(setting, newSeed())))} leadingIcon={<Dices className="size-4" />}>
              Gerar nomes
            </Button>
            {names.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-live="polite">
                {names.map((n, i) => (
                  <li key={`${n}-${i}`} className="rounded-md bg-surface-2 px-2 py-1 text-sm">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Lugar" icon={<Hotel />} description="Taverna, bar, hotel… com um dono marcante." />
          <div className="flex flex-col gap-3 p-5 pt-3">
            <Button variant="secondary" onClick={() => setPlace(generatePlace(setting, newSeed()))} leadingIcon={<Dices className="size-4" />}>
              Gerar lugar
            </Button>
            {place && (
              <p className="rounded-lg bg-surface-2/60 p-3 text-sm" aria-live="polite">
                {place}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tesouro e ganchos" icon={<Coins />} description="O que tem no baú e por que alguém se importa." />
          <div className="flex flex-col gap-3 p-5 pt-3">
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setTreasure(generateTreasure(setting, newSeed(), 3))}>
                Tesouro
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setHook(generateHook(setting, newSeed()))}>
                Gancho
              </Button>
            </div>
            <div aria-live="polite" className="flex flex-col gap-2">
              {treasure.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-fg-muted">
                  {treasure.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              {hook && <p className="rounded-lg bg-surface-2/60 p-3 text-sm">{hook}</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors", active ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg")}
    >
      {children}
    </button>
  );
}
