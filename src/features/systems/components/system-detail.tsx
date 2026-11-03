"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import type { SystemTemplate } from "@/types/system";
import { SystemEmblem, systemStyle } from "./system-identity";

type Tab = "overview" | "sheet" | "combat" | "rules";

const LICENSE_LABEL: Record<SystemTemplate["licensing"]["basis"], string> = {
  "open-license": "Licença aberta",
  compatibility: "Compatibilidade",
  original: "Original",
};

const INVENTORY_LABEL = { weight: "Por peso", slots: "Por espaços", list: "Lista livre" } as const;

/** Read-only view of a template. Editing comes with the system builder (Phase 2). */
export function SystemDetail({ system }: { system: SystemTemplate }) {
  const [tab, setTab] = useState<Tab>("overview");
  const groups = groupBy(system.attributes, (a) => a.group ?? "Atributos");

  return (
    <div className="flex flex-col gap-5" style={systemStyle(system.theme)}>
      <div className="flex items-start gap-4">
        <SystemEmblem theme={system.theme} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">{system.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {system.genres.map((g) => (
              <Badge key={g}>{g}</Badge>
            ))}
            <Badge tone="system">{LICENSE_LABEL[system.licensing.basis]}</Badge>
          </div>
        </div>
      </div>

      <Tabs
        size="sm"
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Visão geral" },
          { value: "sheet", label: "Ficha" },
          { value: "combat", label: "Dados e combate" },
          { value: "rules", label: "Regras e modelos" },
        ]}
      />

      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-fg-muted">{system.description}</p>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Dado principal" value={system.dice.primaryDie.toUpperCase()} />
            <Stat label="Atributos" value={system.attributes.length} />
            <Stat label="Perícias" value={system.skills.length} />
            <Stat label="Progressão" value={system.progression.label} />
          </dl>
          <p className="flex gap-2 rounded-lg border border-line bg-surface-2/50 p-3 text-xs leading-relaxed text-fg-subtle">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {system.licensing.note} Nomes de sistemas são marcas de seus titulares; Role Quest não é afiliado a eles.
          </p>
        </div>
      )}

      {tab === "sheet" && (
        <div className="flex flex-col gap-5">
          {Object.entries(groups).map(([group, attrs]) => (
            <Section key={group} title={group}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {attrs.map((a) => (
                  <div key={a.key} className="rounded-lg border border-line bg-surface-2/50 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs font-semibold text-system">{a.abbreviation}</span>
                      <span className="font-mono text-[10px] text-fg-subtle">
                        {a.min}–{a.max}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm">{a.label}</p>
                  </div>
                ))}
              </div>
            </Section>
          ))}
          <Section title="Recursos">
            <div className="flex flex-col gap-2">
              {system.resources.map((r) => (
                <div key={r.key} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-6 rounded-full" style={{ background: r.color }} />
                  <span className="flex-1">{r.label}</span>
                  {r.derivedFrom && <span className="text-xs text-fg-subtle">{r.derivedFrom}</span>}
                </div>
              ))}
            </div>
          </Section>
          {system.skills.length > 0 && (
            <Section title={`Perícias (${system.skills.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {system.skills.map((s) => (
                  <span key={s.key} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-fg-muted">
                    {s.label}
                  </span>
                ))}
              </div>
            </Section>
          )}
          <Section title="Inventário">
            <p className="text-sm text-fg-muted">
              {INVENTORY_LABEL[system.inventory.model]} · {system.inventory.capacityLabel}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">Moedas: {system.inventory.currencies.join(", ")}</p>
          </Section>
          {system.customFields.length > 0 && (
            <Section title="Campos personalizados">
              <div className="flex flex-wrap gap-1.5">
                {system.customFields.map((f) => (
                  <span key={f.key} className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted">
                    {f.label} <span className="text-fg-subtle">· {f.type}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {tab === "combat" && (
        <div className="flex flex-col gap-5">
          <Section title="Rolagem">
            <code className="block rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm text-system">{system.dice.defaultFormula}</code>
            <p className="mt-2 text-sm text-fg-muted">{system.dice.notes}</p>
            {system.dice.criticalRule && <p className="mt-1 text-xs text-fg-subtle">Críticos: {system.dice.criticalRule}</p>}
            {system.dice.supportsAdvantage && <Badge tone="system" className="mt-2">Vantagem / desvantagem</Badge>}
          </Section>
          <Section title="Combate">
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Iniciativa" value={<code className="font-mono text-xs">{system.combat.initiativeFormula}</code>} />
              <Stat label="Defesa" value={system.combat.defenseLabel} />
              <Stat label="Grade" value={`1 quadrado = ${system.combat.gridCellDistance} ${system.combat.distanceUnit === "squares" ? "quadrado" : system.combat.distanceUnit}`} />
              <Stat label="Ações por turno" value={system.combat.actionEconomy.join(" · ")} />
            </dl>
          </Section>
          <Section title={`Condições (${system.conditions.length})`}>
            <ul className="flex flex-col gap-2">
              {system.conditions.map((c) => (
                <li key={c.key} className="text-sm">
                  <span className="font-medium">{c.label}</span> <span className="text-fg-subtle">— {c.description}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "rules" && (
        <div className="flex flex-col gap-5">
          <Section title="Regras configuráveis">
            {system.rules.length === 0 ? (
              <p className="text-sm text-fg-subtle">Nenhuma regra opcional definida.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {system.rules.map((r) => (
                  <li key={r.key} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{r.label}</span>
                      <span className="block text-xs text-fg-subtle">{r.description}</span>
                    </span>
                    <Badge tone={r.enabledByDefault ? "success" : "neutral"}>{r.enabledByDefault ? "Ativa" : "Opcional"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Modelos de campanha">
            {system.campaignTemplates.map((t) => (
              <div key={t.id} className="mb-2 text-sm">
                <span className="font-medium">{t.name}</span> <span className="text-fg-subtle">— {t.description}</span>
              </div>
            ))}
          </Section>
          <Section title="Modelos de mapa">
            <div className="flex flex-wrap gap-1.5">
              {system.mapTemplates.map((m) => (
                <span key={m.id} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-fg-muted">
                  {m.name} <span className="font-mono text-fg-subtle">{m.columns}×{m.rows}</span>
                </span>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wider text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{value}</dd>
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[key(item)] ??= []).push(item);
    return acc;
  }, {});
}
