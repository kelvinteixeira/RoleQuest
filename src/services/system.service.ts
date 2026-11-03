import { repositories } from "@/repositories";
import { BUILT_IN_SYSTEMS, isBuiltInSystemId, getBuiltInSystem } from "@/features/systems/templates";
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
