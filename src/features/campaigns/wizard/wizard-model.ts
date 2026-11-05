/**
 * Pure model of the campaign creation wizard: draft shape, steps, mapping to
 * the service command and per-step validation. No React here.
 */
import { validateCreateCampaign, type CreateCampaignCommand } from "@/services/campaign.service";
import type { GameMasterPersona, PlayerPolicy, WorldSetup } from "@/types/campaign";
import type { BuiltInSystemId, DieType } from "@/types/system";
import type { UserProfile } from "@/types/user";

export interface CampaignDraft {
  name: string;
  tagline: string;
  systemMode: "builtin" | "custom";
  builtinId: BuiltInSystemId;
  custom: { name: string; theme: string; primaryDie: DieType };
  visualStyleId: string;
  gameMaster: GameMasterPersona;
  playerPolicy: PlayerPolicy;
  world: WorldSetup;
  scheduleFirstSession: boolean;
  /** Local date ("2026-11-10") and time ("20:00") as typed in the form. */
  firstSession: { title: string; date: string; time: string; durationMinutes: number; notes: string };
}

export type StepId = "name" | "system" | "style" | "master" | "players" | "world" | "session";

export interface StepDefinition {
  id: StepId;
  title: string;
  description: string;
  /** Error keys (from validateCreateCampaign) owned by this step. */
  fields: string[];
}

export const STEPS: readonly StepDefinition[] = [
  { id: "name", title: "Nome", description: "Como a campanha vai ser chamada.", fields: ["name", "tagline"] },
  { id: "system", title: "Sistema", description: "As regras da mesa.", fields: ["system.name"] },
  { id: "style", title: "Estilo visual", description: "O clima das capas e destaques.", fields: [] },
  { id: "master", title: "Mestre", description: "Quem narra e como.", fields: ["gameMaster.narratorName"] },
  { id: "players", title: "Jogadores", description: "Vagas e permissões.", fields: ["playerPolicy.maxPlayers"] },
  { id: "world", title: "Mundo", description: "Premissa, tom e ponto de partida.", fields: ["world.name", "world.premise"] },
  { id: "session", title: "Primeira sessão", description: "Agendar e revisar.", fields: ["firstSession.title", "firstSession.scheduledAt"] },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function createInitialDraft(user: Pick<UserProfile, "displayName">, now = new Date()): CampaignDraft {
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    tagline: "",
    systemMode: "builtin",
    builtinId: "dnd5e",
    custom: { name: "", theme: "", primaryDie: "d20" },
    visualStyleId: "obsidian",
    gameMaster: { narratorName: user.displayName, narrationStyle: "cinematic", notes: "" },
    playerPolicy: {
      maxPlayers: 5,
      playersCanEditSheets: true,
      playersCanMoveOwnToken: true,
      allowPrivateMessages: true,
      rollsPublicByDefault: true,
    },
    world: { name: "", premise: "", tone: [], startingLocation: "" },
    scheduleFirstSession: true,
    firstSession: {
      title: "Sessão zero",
      date: `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`,
      time: "20:00",
      durationMinutes: 180,
      notes: "",
    },
  };
}

/** Local date + time → ISO string (or "" when incomplete, which validation reports). */
export function toScheduledIso(date: string, time: string): string {
  if (!date || !time) return "";
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function toCommand(draft: CampaignDraft): CreateCampaignCommand {
  return {
    name: draft.name,
    tagline: draft.tagline,
    system: draft.systemMode === "custom" ? { kind: "custom", seed: { ...draft.custom } } : { kind: "builtin", id: draft.builtinId },
    visualStyleId: draft.visualStyleId,
    gameMaster: draft.gameMaster,
    playerPolicy: draft.playerPolicy,
    world: draft.world,
    firstSession: draft.scheduleFirstSession
      ? {
          title: draft.firstSession.title,
          scheduledAt: toScheduledIso(draft.firstSession.date, draft.firstSession.time),
          durationMinutes: draft.firstSession.durationMinutes,
          notes: draft.firstSession.notes,
        }
      : null,
  };
}

/**
 * "Começar do zero": only a name. The campaign gets a blank custom system the
 * GM shapes later, no invites and no session.
 */
export function toScratchCommand(name: string, user: Pick<UserProfile, "displayName">): CreateCampaignCommand {
  const base = toCommand({ ...createInitialDraft(user), name, scheduleFirstSession: false });
  return { ...base, system: { kind: "custom", seed: { name: `Sistema de ${name.trim() || "campanha"}`.slice(0, 40), theme: "", primaryDie: "d20" } } };
}

export function errorsForStep(errors: Record<string, string>, step: number): Record<string, string> {
  const owned = new Set(STEPS[step].fields);
  return Object.fromEntries(Object.entries(errors).filter(([key]) => owned.has(key)));
}

export function validateStep(draft: CampaignDraft, step: number): Record<string, string> {
  return errorsForStep(validateCreateCampaign(toCommand(draft)), step);
}

/** Index of the first step owning any of the given errors, or -1. */
export function firstStepWithError(errors: Record<string, string>): number {
  return STEPS.findIndex((_, i) => Object.keys(errorsForStep(errors, i)).length > 0);
}
