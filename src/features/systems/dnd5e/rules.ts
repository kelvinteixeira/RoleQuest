/**
 * D&D 5e rules on top of a character sheet: saving throws, armor class, hit
 * points, speed, passive perception and spellcasting, from the SRD choices
 * kept in `sheet.build` (system "dnd5e"). Pure functions; the sheet stays the source of truth.
 */
import { createId } from "@/lib/id";
import type { CharacterSheet, SheetAttack } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { createSheet, newAbility, proficiencyBonus } from "@/features/character-sheet/model/sheet";
import { autoDerived, buildOf, setResourceMax, withBuild } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";
import { ABILITIES, ABILITY_LABEL, armorByKey, backgroundByKey, classByKey, raceByKey, spellSlots, type Ability, type SkillKey } from "./srd";

/** The template and its custom copies. */
export function isDnd(system: Pick<SystemTemplate, "id" | "baseSystemId">): boolean {
  return (system.baseSystemId ?? system.id) === "dnd5e";
}

export const scoreModifier = (score: number) => Math.floor((score - 10) / 2);

const score = (sheet: CharacterSheet, ability: Ability) => sheet.attributes[ability] ?? 10;
const mod = (sheet: CharacterSheet, ability: Ability) => scoreModifier(score(sheet, ability));

/** D&D choices kept in `sheet.build` (system "dnd5e"). */
export interface DndBuild {
  race: string;
  class: string;
  background: string;
  armor: string;
  shield: boolean;
  /** Ability increases the race gave (undone exactly when the race changes). */
  raceBonus: Record<string, number>;
}

export const DND = "dnd5e";

export function emptyBuild(): DndBuild {
  return { race: "", class: "", background: "", armor: "nenhuma", shield: false, raceBonus: {} };
}

export const dndOf = (sheet: CharacterSheet): DndBuild | undefined => buildOf<DndBuild>(sheet, DND);
export const withDnd = (sheet: CharacterSheet, patch: Partial<DndBuild>): CharacterSheet => withBuild(sheet, DND, { ...(dndOf(sheet) ?? emptyBuild()), ...patch });

/* ---------- Saving throws ---------- */

export function saveProficient(sheet: CharacterSheet, ability: string): boolean {
  return !!classByKey(dndOf(sheet)?.class)?.saves.includes(ability as Ability);
}

export function saveBonus(system: SystemTemplate, sheet: CharacterSheet, level: number | null, ability: Ability): number {
  return mod(sheet, ability) + (saveProficient(sheet, ability) ? proficiencyBonus(system, level) : 0);
}

/* ---------- Armor class ---------- */

export interface ArmorClass {
  value: number;
  /** "Cota de malha 16 + escudo 2" */
  explain: string;
  /** Armor the class isn't trained with (disadvantage, no spells). */
  untrained: boolean;
}

export function armorClass(sheet: CharacterSheet): ArmorClass {
  const build = dndOf(sheet) ?? emptyBuild();
  const armor = armorByKey(build.armor);
  const cls = classByKey(build.class);
  const dex = mod(sheet, "dex");
  const shield = build.shield ? 2 : 0;
  const shieldText = shield ? " + escudo 2" : "";
  const untrained = !!cls && ((armor.category !== "none" && !cls.armor.includes(armor.category)) || (build.shield && !cls.shields));

  if (armor.category === "none") {
    // Unarmored Defense: the better of the two; the monk's does not take a shield.
    if (cls?.unarmored && !(cls.unarmoredNoShield && build.shield)) {
      const value = 10 + dex + mod(sheet, cls.unarmored) + shield;
      return { value, explain: `10 + DES + ${cls.unarmored === "con" ? "CON" : "SAB"} (defesa sem armadura)${shieldText}`, untrained };
    }
    return { value: 10 + dex + shield, explain: `10 + DES${shieldText}`, untrained };
  }
  const dexPart = armor.dexCap === null ? dex : Math.min(dex, armor.dexCap);
  const explain = `${armor.label} ${armor.base}${armor.dexCap === 0 ? "" : armor.dexCap === null ? " + DES" : " + DES (máx. 2)"}${shieldText}`;
  return { value: armor.base + dexPart + shield, explain, untrained };
}

/* ---------- Hit points, hit dice, speed ---------- */

/** Max HP: full hit die at level 1, the average (rounded up) after, plus CON each level (at least 1 per level). */
export function hitPointMax(sheet: CharacterSheet, level: number | null): number | null {
  const cls = classByKey(dndOf(sheet)?.class);
  if (!cls) return null;
  const lvl = Math.max(1, level ?? 1);
  const con = mod(sheet, "con");
  const extra = raceByKey(dndOf(sheet)?.race)?.hpPerLevel ?? 0;
  const perLevel = (die: number) => Math.max(1, die + con + extra);
  return perLevel(cls.hitDie) + (lvl - 1) * perLevel(cls.hitDie / 2 + 1);
}

/** Squares per round (5 ft each). */
export function speedSquares(sheet: CharacterSheet): number | null {
  const race = raceByKey(dndOf(sheet)?.race);
  return race ? Math.round(race.speed / 5) : null;
}

export function passivePerception(system: SystemTemplate, sheet: CharacterSheet, level: number | null): number {
  const skill = sheet.skills.percepcao ?? { trained: false, bonus: 0 };
  return 10 + mod(sheet, "wis") + (skill.trained ? proficiencyBonus(system, level) : 0) + skill.bonus;
}

/* ---------- Spellcasting ---------- */

export interface Spellcasting {
  ability: Ability;
  dc: number;
  attack: number;
  /** Slots per spell level (index 0 = 1st). */
  slots: number[];
  pact: boolean;
}

export function spellcasting(system: SystemTemplate, sheet: CharacterSheet, level: number | null): Spellcasting | null {
  const casting = classByKey(dndOf(sheet)?.class)?.spellcasting;
  if (!casting) return null;
  const prof = proficiencyBonus(system, level);
  const m = mod(sheet, casting.ability);
  return { ability: casting.ability, dc: 8 + prof + m, attack: prof + m, slots: spellSlots(casting.caster, level ?? 1), pact: casting.caster === "pact" };
}

/* ---------- Changes ---------- */

/** Ability increases of a race (fixed ones; the half-elf's free picks are added by the creator). */
function fixedRaceBonus(raceKey: string): Record<string, number> {
  return { ...(raceByKey(raceKey)?.bonuses ?? {}) };
}

/** Switches race: the old race's increases come off, the new ones go on; speed follows. */
export function changeRace(sheet: CharacterSheet, raceKey: string, bonus: Record<string, number> = fixedRaceBonus(raceKey)): CharacterSheet {
  const build = dndOf(sheet) ?? emptyBuild();
  const attributes = { ...sheet.attributes };
  for (const key of new Set([...Object.keys(build.raceBonus), ...Object.keys(bonus)])) {
    const delta = (bonus[key] ?? 0) - (build.raceBonus[key] ?? 0);
    if (delta) attributes[key] = Math.max(1, Math.min(30, (attributes[key] ?? 10) + delta));
  }
  const next = withDnd({ ...sheet, attributes }, { race: raceKey, raceBonus: { ...bonus } });
  const speed = speedSquares(next);
  return speed ? { ...next, combat: { ...next.combat, speed } } : next;
}

export function changeClass(sheet: CharacterSheet, classKey: string): CharacterSheet {
  return withDnd(sheet, { class: classKey });
}

/**
 * Keeps what follows from the rules in step (when `auto` is on): max HP
 * (current moves by the same amount), hit dice, total spell slots, speed and
 * an armor class left on "automático". Returns the same sheet when nothing changes.
 */
export function syncDerived(sheet: CharacterSheet, level: number | null): CharacterSheet {
  const build = dndOf(sheet);
  if (!build || !autoDerived(sheet)) return sheet;
  let next = sheet;
  const setResource = (key: string, max: number) => {
    next = setResourceMax(next, key, max);
  };
  const hp = hitPointMax(sheet, level);
  if (hp !== null) setResource("hp", hp);
  if (classByKey(build.class)) setResource("hit_dice", Math.max(1, level ?? 1));
  const casting = classByKey(build.class)?.spellcasting;
  if (casting) setResource("spell_slots", spellSlots(casting.caster, level ?? 1).reduce((a, b) => a + b, 0));
  const speed = speedSquares(sheet);
  if (speed && next.combat.speed !== speed) next = { ...next, combat: { ...next.combat, speed } };
  return next;
}

/* ---------- Creation ---------- */

export interface DndChoices {
  race: string;
  /** Half-elf: the two abilities that get +1. */
  raceChoices: Ability[];
  class: string;
  background: string;
  /** Scores before racial increases. */
  baseScores: Record<Ability, number>;
  /** Class, race (half-elf) and custom-background picks. */
  skills: SkillKey[];
  armor: string;
  shield: boolean;
}

/** Ability increases of a race, the half-elf's picks included. */
export function raceBonusOf(raceKey: string, picks: Ability[]): Record<string, number> {
  const race = raceByKey(raceKey);
  const bonus: Record<string, number> = { ...(race?.bonuses ?? {}) };
  if (race?.chooseBonuses) for (const a of picks.slice(0, race.chooseBonuses.count)) bonus[a] = (bonus[a] ?? 0) + race.chooseBonuses.amount;
  return bonus;
}

/** Skills a build grants without choosing (race, background). */
export function fixedSkills(raceKey: string, backgroundKey: string): SkillKey[] {
  return [...(raceByKey(raceKey)?.skills ?? []), ...(backgroundByKey(backgroundKey)?.skills ?? [])];
}

/** How many free skill picks a build has: class + race (half-elf) + custom background. */
export function skillPicks(choices: Pick<DndChoices, "race" | "class" | "background">): number {
  return (classByKey(choices.class)?.skillChoices.count ?? 0) + (raceByKey(choices.race)?.chooseSkills ?? 0) + (backgroundByKey(choices.background)?.chooseSkills ?? 0);
}

function startingAttack(classKey: string): SheetAttack | null {
  const attack = classByKey(classKey)?.attack;
  if (!attack) return null;
  return { id: createId("atk"), name: attack.name, attributeKey: attack.ability, skillKey: null, proficient: true, bonus: 0, damage: `${attack.dice}+@mod`, range: attack.range };
}

/** A level-1 (or `level`) sheet from the creator's choices: scores, skills, traits, attack, HP and armor. */
export function buildSheet(system: SystemTemplate, choices: DndChoices, level = 1): CharacterSheet {
  const base = createSheet(system);
  const attributes = { ...base.attributes };
  for (const a of ABILITIES) attributes[a] = choices.baseScores[a];
  let sheet: CharacterSheet = withDnd({ ...base, attributes }, { class: choices.class, background: choices.background, armor: choices.armor, shield: choices.shield });
  sheet = changeRace(sheet, choices.race, raceBonusOf(choices.race, choices.raceChoices));

  const skills = { ...sheet.skills };
  for (const key of new Set([...fixedSkills(choices.race, choices.background), ...choices.skills])) skills[key] = { ...(skills[key] ?? { bonus: 0 }), trained: true };

  const race = raceByKey(choices.race);
  const cls = classByKey(choices.class);
  const bg = backgroundByKey(choices.background);
  const abilities = [
    ...(race?.traits ?? []).map((t) => ({ ...newAbility(t.name), kind: race!.label, description: t.summary })),
    ...(cls?.features ?? []).map((t) => ({ ...newAbility(t.name), kind: cls!.label, description: t.summary })),
    ...(bg?.feature ? [{ ...newAbility(bg.feature.name), kind: `Antecedente: ${bg.label}`, description: bg.feature.summary }] : []),
  ];
  const attack = startingAttack(choices.class);
  sheet = {
    ...sheet,
    skills,
    abilities,
    combat: { ...sheet.combat, attacks: attack ? [attack] : sheet.combat.attacks },
    custom: { ...sheet.custom, ...(bg && "background" in sheet.custom ? { background: bg.label } : {}) },
  };
  // A new character starts with full HP.
  const synced = syncDerived(sheet, level);
  const hp = synced.resources.hp;
  return hp ? { ...synced, resources: { ...synced.resources, hp: { current: hp.max, max: hp.max } } } : synced;
}

/** "Alto elfo Mago" — the concept line a new character gets. */
export function conceptOf(choices: Pick<DndChoices, "race" | "class">): string {
  return [raceByKey(choices.race)?.label, classByKey(choices.class)?.label].filter(Boolean).join(" · ");
}

export const saveLabel = (ability: Ability) => `Resistência de ${ABILITY_LABEL[ability]}`;

/* ---------- The module ---------- */

export const dndRules: SystemRules = {
  systemId: "dnd5e",
  derived(system, sheet, level) {
    const ac = armorClass(sheet);
    const cls = classByKey(dndOf(sheet)?.class);
    const race = raceByKey(dndOf(sheet)?.race);
    const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    return [
      { key: "ac", label: "CA", value: ac.value, hint: ac.explain },
      { key: "initiative", label: "Iniciativa", value: signed(mod(sheet, "dex")) },
      { key: "speed", label: "Desloc.", value: `${sheet.combat.speed * 5} ft`, hint: race ? `${race.label}: ${race.speed} ft` : undefined },
      { key: "proficiency", label: "Proficiência", value: signed(proficiencyBonus(system, level)) },
      { key: "passive", label: "Perc. passiva", value: passivePerception(system, sheet, level) },
      { key: "hitdie", label: "Dado de vida", value: cls ? `${Math.max(1, level ?? 1)}d${cls.hitDie}` : "—" },
    ];
  },
  sync: (_system, sheet, level) => syncDerived(sheet, level),
  defense: (_system, sheet) => (dndOf(sheet) ? armorClass(sheet).value : null),
  saves: (system, sheet, level) =>
    ABILITIES.map((a) => ({ key: a, label: ABILITY_LABEL[a], request: { attributeKey: a, save: true }, proficient: saveProficient(sheet, a), value: saveBonus(system, sheet, level, a) })),
};
