import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { BUILT_IN_SYSTEMS, isBuiltInSystemId, getBuiltInSystem } from "@/features/systems/templates";
import { createCustomSystem } from "@/features/systems/templates/custom";
import { duplicateAsCustom, pruneReferences, validateSystem } from "@/features/systems/model/system-editor";
import type { ID } from "@/types/common";
import type { SystemId, SystemTemplate } from "@/types/system";

/** Lightweight projection used by cards, badges and lists. */
export type SystemSummary = Pick<SystemTemplate, "id" | "kind" | "name" | "shortName" | "tagline" | "theme" | "genres" | "progression">;

export function toSummary(system: SystemTemplate): SystemSummary {
  const { id, kind, name, shortName, tagline, theme, genres, progression } = system;
  return { id, kind, name, shortName, tagline, theme, genres, progression };
}

const UNKNOWN_SYSTEM: SystemSummary = {
  id: "custom_unknown",
  kind: "custom",
  name: "Sistema indisponível",
  shortName: "—",
  tagline: "",
  theme: { accent: "oklch(0.6 0.01 270)", glyph: "dices", gradient: ["oklch(0.28 0.01 270)", "oklch(0.17 0.01 270)"] },
  genres: [],
  progression: { model: "levels", label: "Nível" },
};

export const systemService = {
  listBuiltIn(): readonly SystemTemplate[] {
    return BUILT_IN_SYSTEMS;
  },

  async listForUser(userId: ID): Promise<SystemTemplate[]> {
    const custom = await repositories().systems.listCustom(userId);
    return [...BUILT_IN_SYSTEMS, ...custom];
  },

  async get(id: SystemId): Promise<SystemTemplate | null> {
    if (isBuiltInSystemId(id)) return getBuiltInSystem(id);
    return repositories().systems.getCustom(id);
  },

  /** A custom system the user owns, for the editor. Built-ins and others' systems can only be duplicated. */
  async getEditable(id: SystemId, userId: ID): Promise<SystemTemplate> {
    if (isBuiltInSystemId(id)) throw new AppError("forbidden", "Sistemas prontos não são editados: duplique para ter uma versão sua.");
    const own = (await repositories().systems.listCustom(userId)).find((s) => s.id === id);
    if (!own) {
      if (await repositories().systems.getCustom(id)) throw new AppError("forbidden", "Só quem criou o sistema pode editá-lo.");
      throw new AppError("not_found", "Sistema não encontrado.");
    }
    return own;
  },

  /** Saves the user's own custom system after validation (references to removed parts are dropped first). */
  async saveCustom(userId: ID, system: SystemTemplate): Promise<SystemTemplate> {
    if (system.kind !== "custom" || isBuiltInSystemId(system.id)) throw new AppError("forbidden", "Só sistemas próprios são salvos.");
    const existing = await repositories().systems.getCustom(system.id);
    if (existing && !(await repositories().systems.listCustom(userId)).some((s) => s.id === system.id)) throw new AppError("forbidden", "Só quem criou o sistema pode editá-lo.");
    const clean = pruneReferences({ ...system, name: system.name.trim(), shortName: (system.shortName.trim() || system.name.trim()).slice(0, 14) });
    const errors = validateSystem(clean);
    if (Object.keys(errors).length) throw new AppError("validation", Object.values(errors)[0], errors);
    return repositories().systems.saveCustom(userId, clean);
  },

  async createCustom(userId: ID, name: string): Promise<SystemTemplate> {
    return systemService.saveCustom(userId, createCustomSystem({ name: name.trim() || "Meu sistema", theme: "", primaryDie: "d20" }));
  },

  /** A custom copy of any system the user can see (built-in or their own). */
  async duplicate(userId: ID, id: SystemId): Promise<SystemTemplate> {
    const source = isBuiltInSystemId(id) ? getBuiltInSystem(id) : (await repositories().systems.listCustom(userId)).find((s) => s.id === id);
    if (!source) throw new AppError("not_found", "Sistema não encontrado.");
    return systemService.saveCustom(userId, duplicateAsCustom(source));
  },

  /** Resolves many ids at once; unknown custom systems get a neutral placeholder. */
  async summaries(ids: SystemId[]): Promise<Map<SystemId, SystemSummary>> {
    const unique = [...new Set(ids)];
    const entries = await Promise.all(
      unique.map(async (id) => {
        const system = await systemService.get(id);
        return [id, system ? toSummary(system) : { ...UNKNOWN_SYSTEM, id }] as const;
      }),
    );
    return new Map(entries);
  },
};
