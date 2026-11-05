/**
 * Rules for editing a custom system: keys, validation, keeping references
 * consistent when something is removed, and copies of built-in systems.
 * Pure functions.
 */
import { createId } from "@/lib/id";
import type { BuiltInSystemId, ClassDefinition, CustomSystemId, ResolutionMechanic, SystemTemplate } from "@/types/system";

export const SYSTEM_LIMITS = { name: 40, shortName: 14, attributes: 12, resources: 8, skills: 60, classes: 20, levels: 30, customFields: 30, abbreviation: 4 } as const;

/** A key from a label ("Força Bruta" → "forca-bruta"), unique among `taken`. */
export function keyFromLabel(label: string, taken: Iterable<string>): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "campo";
  const used = new Set(taken);
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  return key;
}

/**
 * Key for a new attribute/skill/resource/class/field: from the label plus a
 * short random tail, so a key removed earlier is never reused (sheets keep
 * values under old keys, and a new "Fé" must not inherit a deleted "Mana").
 */
export function newKey(label: string, taken: Iterable<string>): string {
  const tail = Math.random().toString(36).slice(2, 6);
  return keyFromLabel(`${label} ${tail}`, taken);
}

/**
 * How checks are rolled. The sheet and the table use this (not the formula
 * text, which is only how the roll is described to players).
 */
export const MECHANICS: { id: ResolutionMechanic; label: string; hint: string }[] = [
  { id: "custom", label: "Dado principal + valor", hint: "Rola o dado principal e soma atributo/perícia." },
  { id: "d20-plus-modifier", label: "d20 + modificador", hint: "Atributos viram modificador; 20 natural é crítico." },
  { id: "d20-pool-keep-highest", label: "Vários d20, fica o maior", hint: "Atributo = quantidade de d20; soma a perícia." },
  { id: "d100-roll-under", label: "d100 abaixo do valor", hint: "Sucesso tirando igual ou menos; níveis de sucesso." },
  { id: "3d6-roll-under", label: "3d6 abaixo do valor", hint: "Sucesso tirando igual ou menos que o nível." },
  { id: "d10-dice-pool", label: "Parada de d10", hint: "Atributo + perícia = d10s; 6+ é sucesso." },
  { id: "d6-plus-attribute", label: "1d6 + atributo", hint: "Rolagem curta e simples." },
  { id: "d10-plus-stat-skill", label: "1d10 + atributo + perícia", hint: "10 explode, 1 implode." },
];

/** Formulas are descriptive (shown on sheets and system pages), so they only need to be present and short. */
const FORMULA_MAX = 60;

export type SystemErrors = Record<string, string>;

/** Field errors keyed by path ("attributes.0.label"); empty when the system can be saved. */
export function validateSystem(s: SystemTemplate): SystemErrors {
  const e: SystemErrors = {};
  const need = (path: string, ok: boolean, message: string) => {
    if (!ok && !e[path]) e[path] = message;
  };

  need("name", !!s.name.trim(), "Dê um nome ao sistema.");
  need("name", s.name.trim().length <= SYSTEM_LIMITS.name, `Até ${SYSTEM_LIMITS.name} caracteres.`);
  need("shortName", s.shortName.trim().length <= SYSTEM_LIMITS.shortName, `Até ${SYSTEM_LIMITS.shortName} caracteres.`);
  need("dice.defaultFormula", !!s.dice.defaultFormula.trim() && s.dice.defaultFormula.length <= FORMULA_MAX, `Descreva a rolagem (até ${FORMULA_MAX} caracteres).`);
  need("combat.initiativeFormula", !!s.combat.initiativeFormula.trim() && s.combat.initiativeFormula.length <= FORMULA_MAX, `Descreva a iniciativa (até ${FORMULA_MAX} caracteres).`);
  need("combat.gridCellDistance", s.combat.gridCellDistance > 0 && s.combat.gridCellDistance <= 100, "Entre 0,1 e 100.");

  need("attributes", s.attributes.length >= 1, "Pelo menos um atributo.");
  need("attributes", s.attributes.length <= SYSTEM_LIMITS.attributes, `No máximo ${SYSTEM_LIMITS.attributes} atributos.`);
  s.attributes.forEach((a, i) => {
    need(`attributes.${i}.label`, !!a.label.trim(), "Dê um nome.");
    need(`attributes.${i}.abbreviation`, !!a.abbreviation.trim() && a.abbreviation.trim().length <= SYSTEM_LIMITS.abbreviation, `1 a ${SYSTEM_LIMITS.abbreviation} letras.`);
    need(`attributes.${i}.range`, Number.isFinite(a.min) && Number.isFinite(a.max) && a.min <= a.max, "Mínimo maior que o máximo.");
    need(`attributes.${i}.range`, a.defaultValue >= a.min && a.defaultValue <= a.max, "O inicial precisa estar entre o mínimo e o máximo.");
  });

  need("resources", s.resources.length <= SYSTEM_LIMITS.resources, `No máximo ${SYSTEM_LIMITS.resources} recursos.`);
  s.resources.forEach((r, i) => {
    need(`resources.${i}.label`, !!r.label.trim(), "Dê um nome.");
    need(`resources.${i}.defaultMax`, Number.isFinite(r.defaultMax) && r.defaultMax >= 0 && r.defaultMax <= 9999, "Entre 0 e 9999.");
  });

  const attrKeys = new Set(s.attributes.map((a) => a.key));
  const skillKeys = new Set(s.skills.map((k) => k.key));
  const resourceKeys = new Set(s.resources.map((r) => r.key));
  need("skills", s.skills.length <= SYSTEM_LIMITS.skills, `No máximo ${SYSTEM_LIMITS.skills} perícias.`);
  s.skills.forEach((k, i) => {
    need(`skills.${i}.label`, !!k.label.trim(), "Dê um nome.");
    need(`skills.${i}.attributeKey`, !k.attributeKey || attrKeys.has(k.attributeKey), "Atributo removido.");
  });

  const classes = s.classes ?? [];
  need("classes", classes.length <= SYSTEM_LIMITS.classes, `No máximo ${SYSTEM_LIMITS.classes} classes.`);
  classes.forEach((c, i) => {
    need(`classes.${i}.label`, !!c.label.trim(), "Dê um nome.");
    need(`classes.${i}.skillKeys`, c.skillKeys.every((k) => skillKeys.has(k)), "Perícia removida.");
    need(`classes.${i}.resourceBonus`, Object.entries(c.resourceBonus).every(([k, v]) => resourceKeys.has(k) && Number.isFinite(v) && Math.abs(v) <= 999), "Bônus inválido.");
  });

  const levels = s.progression.levels ?? [];
  // Points only matter (and are only shown) for XP / character-point progressions.
  const usesPoints = s.progression.model === "experience-points" || s.progression.model === "character-points";
  need("progression.levels", levels.length <= SYSTEM_LIMITS.levels, `No máximo ${SYSTEM_LIMITS.levels} níveis.`);
  levels.forEach((l, i) => {
    const prev = levels[i - 1];
    need(`progression.levels.${i}.level`, Number.isInteger(l.level) && l.level >= 1 && (!prev || l.level > prev.level), "Níveis em ordem crescente, a partir de 1.");
    need(`progression.levels.${i}.level`, s.progression.max === undefined || l.level <= s.progression.max, "Nível acima do máximo.");
    if (usesPoints)
      need(
        `progression.levels.${i}.threshold`,
        l.threshold === undefined || (Number.isFinite(l.threshold) && l.threshold >= 0 && (prev?.threshold === undefined || l.threshold >= prev.threshold)),
        "Pontos em ordem crescente.",
      );
  });
  if (s.progression.max !== undefined) need("progression.max", Number.isInteger(s.progression.max) && s.progression.max >= 1 && s.progression.max <= 99, "Entre 1 e 99.");

  s.customFields.forEach((f, i) => {
    need(`customFields.${i}.label`, !!f.label.trim(), "Dê um nome.");
    need(`customFields.${i}.options`, f.type !== "select" || (f.options?.filter((o) => o.trim()).length ?? 0) >= 2, "Uma lista precisa de pelo menos duas opções.");
    need(`customFields.${i}.options`, f.type !== "select" || new Set(f.options).size === (f.options?.length ?? 0), "Opções repetidas.");
  });
  s.conditions.forEach((c, i) => need(`conditions.${i}.label`, !!c.label.trim(), "Dê um nome."));
  need("classesLabel", s.classesLabel === undefined || !!s.classesLabel.trim(), "Dê um nome (ex.: Classe).");
  return e;
}

/**
 * After removing an attribute, skill or resource, references to it are
 * dropped (skills lose the attribute link, classes the skill/resource) so
 * the system stays valid and sheets keep working.
 */
export function pruneReferences(s: SystemTemplate): SystemTemplate {
  const attrKeys = new Set(s.attributes.map((a) => a.key));
  const skillKeys = new Set(s.skills.map((k) => k.key));
  const resourceKeys = new Set(s.resources.map((r) => r.key));
  return {
    ...s,
    skills: s.skills.map((k) => (k.attributeKey && !attrKeys.has(k.attributeKey) ? { ...k, attributeKey: undefined } : k)),
    classes: s.classes?.map((c) => ({
      ...c,
      skillKeys: c.skillKeys.filter((k) => skillKeys.has(k)),
      resourceBonus: Object.fromEntries(Object.entries(c.resourceBonus).filter(([k]) => resourceKeys.has(k))),
    })),
  };
}

export function newClass(label: string, taken: Iterable<string>): ClassDefinition {
  return { key: newKey(label, taken), label, description: "", skillKeys: [], resourceBonus: {}, abilities: [] };
}

/** A custom copy of any system (e.g. a built-in) to reshape: new id, owned by the user. */
export function duplicateAsCustom(system: SystemTemplate): SystemTemplate {
  const copy = structuredClone(system);
  return {
    ...copy,
    id: createId("custom") as CustomSystemId,
    kind: "custom",
    name: `${system.name} (variação)`.slice(0, SYSTEM_LIMITS.name),
    shortName: system.shortName.slice(0, SYSTEM_LIMITS.shortName),
    genres: [...new Set([...system.genres, "Personalizado"])],
    // The copy keeps the source's licence basis (and its attribution note) for built-ins.
    baseSystemId: copy.baseSystemId ?? (system.kind === "builtin" ? (system.id as BuiltInSystemId) : undefined),
    licensing:
      system.kind === "builtin"
        ? { basis: system.licensing.basis, note: `Variação criada pelo mestre a partir de ${system.name}. ${system.licensing.note}` }
        : { basis: "original", note: `Variação criada pelo mestre a partir de ${system.name}.` },
    classes: copy.classes ?? [],
    classesLabel: copy.classesLabel ?? "Classe",
    progression: { ...copy.progression, levels: copy.progression.levels ?? [] },
  };
}
