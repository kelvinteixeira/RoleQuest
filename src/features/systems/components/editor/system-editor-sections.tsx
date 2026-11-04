"use client";

import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { DIE_TYPES, type CustomFieldType, type DieType, type ProgressionConfig, type SystemGlyph, type SystemTemplate } from "@/types/system";
import { RESOURCE_COLORS } from "@/features/systems/templates/shared";
import { MECHANICS, newClass, newKey, SYSTEM_LIMITS, type SystemErrors } from "../../model/system-editor";
import { ListTextField, NumberField, RowList, SelectField, TextField, Toggle } from "./editor-fields";

export type EditorSectionProps = {
  system: SystemTemplate;
  errors: SystemErrors;
  /** Replace part of the system. */
  set: (patch: Partial<SystemTemplate>) => void;
};

const keysOf = (items: { key: string }[]) => items.map((i) => i.key);

/** Accent colours for custom systems (hue → accent + cover gradient). */
const ACCENTS = [20, 50, 85, 140, 190, 230, 270, 302, 330].map((h) => ({
  accent: `oklch(0.7 0.17 ${h})`,
  gradient: [`oklch(0.32 0.1 ${h})`, `oklch(0.15 0.02 ${h})`] as [string, string],
}));

const GLYPHS: { value: SystemGlyph; label: string }[] = [
  { value: "sparkles", label: "Brilho" },
  { value: "sword", label: "Espada" },
  { value: "shield", label: "Escudo" },
  { value: "eye", label: "Olho" },
  { value: "flame", label: "Chama" },
  { value: "moon", label: "Lua" },
  { value: "star", label: "Estrela" },
  { value: "ghost", label: "Fantasma" },
  { value: "droplet", label: "Gota" },
  { value: "cpu", label: "Circuito" },
  { value: "dices", label: "Dados" },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "counter", label: "Contador" },
  { value: "select", label: "Lista de opções" },
  { value: "checkbox", label: "Caixa de marcar" },
  { value: "list", label: "Lista de itens" },
];

const PROGRESSION: { value: ProgressionConfig["model"]; label: string }[] = [
  { value: "levels", label: "Níveis" },
  { value: "experience-points", label: "Pontos de experiência" },
  { value: "milestones", label: "Marcos" },
  { value: "character-points", label: "Pontos de personagem" },
];

export function IdentitySection({ system, errors, set }: EditorSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField label="Nome" value={system.name} onChange={(name) => set({ name })} error={errors.name} maxLength={SYSTEM_LIMITS.name} />
        <TextField label="Nome curto" value={system.shortName} onChange={(shortName) => set({ shortName })} error={errors.shortName} maxLength={SYSTEM_LIMITS.shortName} hint="Etiquetas e fichas." />
      </div>
      <TextField label="Frase de apresentação" value={system.tagline} onChange={(tagline) => set({ tagline })} maxLength={120} />
      <Textarea label="Descrição" value={system.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={800} />
      <ListTextField label="Gêneros" value={system.genres} onChange={(genres) => set({ genres })} hint="Separe por vírgulas. Usado também pelos geradores do mestre (fantasia, horror, cyberpunk…)." />
      <div>
        <p className="mb-1.5 text-xs text-fg-muted">Cor</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.accent}
              type="button"
              aria-label={`Cor ${a.accent}`}
              aria-pressed={system.theme.accent === a.accent}
              onClick={() => set({ theme: { ...system.theme, accent: a.accent, gradient: a.gradient } })}
              className={cn("size-8 rounded-full border-2 transition-transform", system.theme.accent === a.accent ? "scale-110 border-white" : "border-transparent")}
              style={{ background: a.accent }}
            />
          ))}
        </div>
      </div>
      <SelectField label="Símbolo" value={system.theme.glyph} onChange={(glyph) => set({ theme: { ...system.theme, glyph } })} options={GLYPHS} className="sm:max-w-60" />
    </div>
  );
}

export function DiceSection({ system, errors, set }: EditorSectionProps) {
  const mechanic = MECHANICS.find((m) => m.id === system.dice.mechanic) ?? MECHANICS[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Como os testes são rolados" value={system.dice.mechanic} onChange={(m) => set({ dice: { ...system.dice, mechanic: m } })} options={MECHANICS.map((m) => ({ value: m.id, label: m.label }))} />
        <SelectField label="Dado principal" value={system.dice.primaryDie} onChange={(d: DieType) => set({ dice: { ...system.dice, primaryDie: d } })} options={DIE_TYPES.map((d) => ({ value: d, label: d }))} />
      </div>
      <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">{mechanic.hint} É isto que a ficha e a mesa usam nos testes e no combate.</p>
      <TextField label="Rolagem (como aparece para os jogadores)" value={system.dice.defaultFormula} onChange={(defaultFormula) => set({ dice: { ...system.dice, defaultFormula } })} error={errors["dice.defaultFormula"]} placeholder="1d20 + atributo" maxLength={60} />
      <Toggle label="Vantagem e desvantagem (rolar dois e ficar com o melhor/pior)" checked={system.dice.supportsAdvantage} onChange={(supportsAdvantage) => set({ dice: { ...system.dice, supportsAdvantage } })} />
      <TextField label="Regra de crítico" value={system.dice.criticalRule ?? ""} onChange={(criticalRule) => set({ dice: { ...system.dice, criticalRule: criticalRule || undefined } })} maxLength={120} />
      <Textarea label="Notas sobre os dados" value={system.dice.notes} onChange={(e) => set({ dice: { ...system.dice, notes: e.target.value } })} rows={2} maxLength={400} />
    </div>
  );
}

export function AttributesSection({ system, errors, set }: EditorSectionProps) {
  return (
    <>
      {errors.attributes && <p className="mb-2 text-sm text-danger">{errors.attributes}</p>}
      <RowList
        items={system.attributes}
        onChange={(attributes) => set({ attributes })}
        itemKey={(a) => a.key}
        itemLabel={(a) => a.label || "atributo"}
        max={SYSTEM_LIMITS.attributes}
        addLabel="Adicionar atributo"
        onAdd={() => set({ attributes: [...system.attributes, { key: newKey("Atributo", keysOf(system.attributes)), label: "Atributo", abbreviation: "ATR", min: 0, max: 10, defaultValue: 1 }] })}
        render={(a, i, update) => (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_80px_repeat(3,70px)]">
            <TextField label="Nome" value={a.label} onChange={(label) => update({ label })} error={errors[`attributes.${i}.label`]} maxLength={30} className="col-span-2 sm:col-span-1" />
            <TextField label="Sigla" value={a.abbreviation} onChange={(abbreviation) => update({ abbreviation: abbreviation.toUpperCase() })} error={errors[`attributes.${i}.abbreviation`]} maxLength={SYSTEM_LIMITS.abbreviation} />
            <NumberField label="Mín." value={a.min} onChange={(min) => update({ min })} />
            <NumberField label="Máx." value={a.max} onChange={(max) => update({ max })} />
            <NumberField label="Inicial" value={a.defaultValue} onChange={(defaultValue) => update({ defaultValue })} />
            {errors[`attributes.${i}.range`] && <p className="col-span-full text-[11px] text-danger">{errors[`attributes.${i}.range`]}</p>}
          </div>
        )}
      />
    </>
  );
}

export function ResourcesSection({ system, errors, set }: EditorSectionProps) {
  const colors = Object.values(RESOURCE_COLORS);
  return (
    <RowList
      items={system.resources}
      onChange={(resources) => set({ resources })}
      itemKey={(r) => r.key}
      itemLabel={(r) => r.label || "recurso"}
      max={SYSTEM_LIMITS.resources}
      addLabel="Adicionar recurso"
      empty="Sem recursos. O primeiro recurso é usado como pontos de vida na mesa."
      onAdd={() => set({ resources: [...system.resources, { key: newKey("Recurso", keysOf(system.resources)), label: "Recurso", color: colors[system.resources.length % colors.length], defaultMax: 10, showOnToken: false }] })}
      render={(r, i, update) => (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_90px_minmax(0,2fr)]">
            <TextField label={i === 0 ? "Nome (vida na mesa)" : "Nome"} value={r.label} onChange={(label) => update({ label })} error={errors[`resources.${i}.label`]} maxLength={30} className="col-span-2 sm:col-span-1" />
            <NumberField label="Máximo inicial" value={r.defaultMax} onChange={(defaultMax) => update({ defaultMax })} error={errors[`resources.${i}.defaultMax`]} />
            <TextField label="De onde vem" value={r.derivedFrom ?? ""} onChange={(d) => update({ derivedFrom: d || undefined })} placeholder="Corpo × 5 + nível" maxLength={60} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5" role="group" aria-label={`Cor de ${r.label}`}>
              {colors.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={r.color === c} onClick={() => update({ color: c })} className={cn("size-5 rounded-full border-2", r.color === c ? "border-white" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
            <Toggle label="Barra no token" checked={r.showOnToken} onChange={(showOnToken) => update({ showOnToken })} />
          </div>
        </div>
      )}
    />
  );
}

export function SkillsSection({ system, errors, set }: EditorSectionProps) {
  return (
    <RowList
      items={system.skills}
      onChange={(skills) => set({ skills })}
      itemKey={(k) => k.key}
      itemLabel={(k) => k.label || "perícia"}
      max={SYSTEM_LIMITS.skills}
      addLabel="Adicionar perícia"
      empty="Sem perícias: os testes usam só os atributos."
      onAdd={() => set({ skills: [...system.skills, { key: newKey("Perícia", keysOf(system.skills)), label: "Perícia", attributeKey: system.attributes[0]?.key }] })}
      render={(k, i, update) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField label="Nome" value={k.label} onChange={(label) => update({ label })} error={errors[`skills.${i}.label`]} maxLength={40} />
          <SelectField
            label="Atributo"
            value={k.attributeKey ?? ""}
            onChange={(attributeKey) => update({ attributeKey: attributeKey || undefined })}
            options={[{ value: "", label: "Nenhum" }, ...system.attributes.map((a) => ({ value: a.key, label: `${a.label} (${a.abbreviation})` }))]}
          />
        </div>
      )}
    />
  );
}

export function ClassesSection({ system, errors, set }: EditorSectionProps) {
  const classes = system.classes ?? [];
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Como o sistema chama as classes" value={system.classesLabel ?? "Classe"} onChange={(classesLabel) => set({ classesLabel })} error={errors.classesLabel} placeholder="Classe, Arquétipo, Origem…" maxLength={20} className="sm:max-w-60" />
      <RowList
        items={classes}
        onChange={(next) => set({ classes: next })}
        itemKey={(c) => c.key}
        itemLabel={(c) => c.label || "classe"}
        max={SYSTEM_LIMITS.classes}
        addLabel={`Adicionar ${(system.classesLabel || "classe").toLowerCase()}`}
        empty="Sem classes: os personagens se definem só pelo conceito."
        onAdd={() => set({ classes: [...classes, newClass(`Nova ${(system.classesLabel || "classe").toLowerCase()}`, keysOf(classes))] })}
        render={(c, i, update) => (
          <div className="flex flex-col gap-3">
            <TextField label="Nome" value={c.label} onChange={(label) => update({ label })} error={errors[`classes.${i}.label`]} maxLength={30} />
            <Textarea label="Descrição" value={c.description} onChange={(e) => update({ description: e.target.value })} rows={2} maxLength={400} />
            {system.resources.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-fg-muted">Bônus no máximo inicial</p>
                <div className="flex flex-wrap gap-2">
                  {system.resources.map((r) => (
                    <NumberField
                      key={r.key}
                      label={r.label}
                      className="w-24"
                      value={c.resourceBonus[r.key] ?? 0}
                      onChange={(v) => update({ resourceBonus: { ...c.resourceBonus, [r.key]: v } })}
                    />
                  ))}
                </div>
                {errors[`classes.${i}.resourceBonus`] && <p className="mt-1 text-[11px] text-danger">{errors[`classes.${i}.resourceBonus`]}</p>}
              </div>
            )}
            {system.skills.length > 0 && (
              <fieldset>
                <legend className="mb-1 text-xs text-fg-muted">Perícias treinadas</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {system.skills.map((k) => (
                    <Toggle
                      key={k.key}
                      label={k.label}
                      checked={c.skillKeys.includes(k.key)}
                      onChange={(on) => update({ skillKeys: on ? [...c.skillKeys, k.key] : c.skillKeys.filter((x) => x !== k.key) })}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            <ListTextField label="Habilidades iniciais" value={c.abilities} onChange={(abilities) => update({ abilities })} hint="Separe por vírgulas. Entram na ficha ao escolher a classe." />
          </div>
        )}
      />
    </div>
  );
}

export function ProgressionSection({ system, errors, set }: EditorSectionProps) {
  const p = system.progression;
  const levels = p.levels ?? [];
  const usesPoints = p.model === "experience-points" || p.model === "character-points";
  const setP = (patch: Partial<ProgressionConfig>) => set({ progression: { ...p, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Modelo" value={p.model} onChange={(model) => setP({ model })} options={PROGRESSION} />
        <TextField label="Nome na ficha" value={p.label} onChange={(label) => setP({ label })} maxLength={20} />
        <NumberField label="Máximo" value={p.max} onChange={(max) => setP({ max: Number.isNaN(max) ? undefined : max })} error={errors["progression.max"]} />
      </div>
      <div>
        <p className="mb-2 text-xs text-fg-muted">Tabela de progressão {usesPoints ? "(pontos necessários e o que se ganha)" : "(o que se ganha em cada nível)"}</p>
        {errors["progression.levels"] && <p className="mb-2 text-sm text-danger">{errors["progression.levels"]}</p>}
        <RowList
          items={levels}
          reorder={false}
          onChange={(next) => setP({ levels: next })}
          itemKey={(l, i) => `lvl-${i}`}
          itemLabel={(l) => `nível ${l.level}`}
          max={SYSTEM_LIMITS.levels}
          addLabel="Adicionar nível"
          empty="Sem tabela: o nível é só um número na ficha."
          onAdd={() => {
            const last = levels[levels.length - 1];
            setP({ levels: [...levels, { level: (last?.level ?? 0) + 1, threshold: usesPoints ? (last?.threshold ?? 0) + 1000 : undefined, perks: "" }] });
          }}
          render={(l, i, update) => (
            <div className="grid gap-2 sm:grid-cols-[70px_110px_minmax(0,1fr)]">
              <NumberField label="Nível" value={l.level} onChange={(level) => update({ level })} error={errors[`progression.levels.${i}.level`]} />
              {usesPoints ? (
                <NumberField label="Pontos" value={l.threshold} onChange={(t) => update({ threshold: Number.isNaN(t) ? undefined : t })} error={errors[`progression.levels.${i}.threshold`]} />
              ) : (
                <span />
              )}
              <TextField label="Ganhos" value={l.perks} onChange={(perks) => update({ perks })} placeholder="+1 atributo, nova habilidade…" maxLength={160} />
            </div>
          )}
        />
      </div>
    </div>
  );
}

export function ConditionsSection({ system, errors, set }: EditorSectionProps) {
  return (
    <RowList
      items={system.conditions}
      onChange={(conditions) => set({ conditions })}
      itemKey={(c) => c.key}
      itemLabel={(c) => c.label || "condição"}
      addLabel="Adicionar condição"
      onAdd={() => set({ conditions: [...system.conditions, { key: newKey("Condição", keysOf(system.conditions)), label: "Condição", description: "" }] })}
      render={(c, i, update) => (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <TextField label="Nome" value={c.label} onChange={(label) => update({ label })} error={errors[`conditions.${i}.label`]} maxLength={30} />
          <TextField label="Efeito" value={c.description} onChange={(description) => update({ description })} maxLength={160} />
        </div>
      )}
    />
  );
}

export function CustomFieldsSection({ system, errors, set }: EditorSectionProps) {
  return (
    <RowList
      items={system.customFields}
      onChange={(customFields) => set({ customFields })}
      itemKey={(f) => f.key}
      itemLabel={(f) => f.label || "campo"}
      max={SYSTEM_LIMITS.customFields}
      addLabel="Adicionar campo"
      empty="Campos extras aparecem na ficha (ex.: Antecedente, Lealdade, Divindade)."
      onAdd={() => set({ customFields: [...system.customFields, { key: newKey("Campo", keysOf(system.customFields)), label: "Campo", type: "text", section: "Extras" }] })}
      render={(f, i, update) => (
        <div className="grid gap-2 sm:grid-cols-3">
          <TextField label="Nome" value={f.label} onChange={(label) => update({ label })} error={errors[`customFields.${i}.label`]} maxLength={30} />
          <SelectField label="Tipo" value={f.type} onChange={(type) => update({ type, options: type === "select" ? (f.options?.length ? f.options : ["Opção 1", "Opção 2"]) : f.options })} options={FIELD_TYPES} />
          <TextField label="Seção da ficha" value={f.section} onChange={(section) => update({ section })} maxLength={30} />
          {f.type === "select" && (
            <div className="sm:col-span-3">
              <ListTextField label="Opções" value={f.options ?? []} onChange={(options) => update({ options })} />
              {errors[`customFields.${i}.options`] && <p className="mt-1 text-[11px] text-danger">{errors[`customFields.${i}.options`]}</p>}
            </div>
          )}
        </div>
      )}
    />
  );
}

export function CombatInventorySection({ system, errors, set }: EditorSectionProps) {
  const c = system.combat;
  const inv = system.inventory;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Iniciativa (como aparece)" value={c.initiativeFormula} onChange={(initiativeFormula) => set({ combat: { ...c, initiativeFormula } })} error={errors["combat.initiativeFormula"]} maxLength={60} />
        <TextField label="Nome da defesa" value={c.defenseLabel} onChange={(defenseLabel) => set({ combat: { ...c, defenseLabel } })} maxLength={30} />
        <ListTextField label="Ações por turno" value={c.actionEconomy} onChange={(actionEconomy) => set({ combat: { ...c, actionEconomy } })} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Unidade"
            value={c.distanceUnit}
            onChange={(distanceUnit) => set({ combat: { ...c, distanceUnit } })}
            options={[
              { value: "squares", label: "Quadrados" },
              { value: "m", label: "Metros" },
              { value: "ft", label: "Pés" },
            ]}
          />
          <NumberField label="Por quadrado" value={c.gridCellDistance} onChange={(gridCellDistance) => set({ combat: { ...c, gridCellDistance } })} error={errors["combat.gridCellDistance"]} />
        </div>
      </div>
      <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <SelectField
          label="Inventário"
          value={inv.model}
          onChange={(model) => set({ inventory: { ...inv, model } })}
          options={[
            { value: "list", label: "Lista simples" },
            { value: "weight", label: "Por peso" },
            { value: "slots", label: "Por espaços" },
          ]}
        />
        <TextField label="Nome da capacidade" value={inv.capacityLabel} onChange={(capacityLabel) => set({ inventory: { ...inv, capacityLabel } })} maxLength={30} />
        <ListTextField label="Moedas" value={inv.currencies} onChange={(currencies) => set({ inventory: { ...inv, currencies } })} />
        <ListTextField label="Espaços de equipamento" value={inv.equipmentSlots} onChange={(equipmentSlots) => set({ inventory: { ...inv, equipmentSlots } })} />
      </div>
    </div>
  );
}
