import type { CampaignRole } from "@/types/campaign";

/**
 * Capability matrix per campaign role. The UI asks `can(role, capability)`;
 * in Phase 7 the same matrix is mirrored by Supabase RLS policies, which remain
 * the source of truth.
 */
export type Capability =
  | "campaign:manage"
  | "campaign:invite"
  | "session:start"
  | "session:end"
  | "map:edit"
  | "map:reveal"
  | "token:move-any"
  | "token:move-own"
  | "sheet:view-all"
  | "sheet:edit-any"
  | "sheet:edit-own"
  | "npc:manage"
  | "audio:control"
  | "chat:private-gm"
  | "dice:secret-roll"
  | "chronicles:edit";

const MATRIX: Record<CampaignRole, ReadonlySet<Capability>> = {
  game_master: new Set<Capability>([
    "campaign:manage",
    "campaign:invite",
    "session:start",
    "session:end",
    "map:edit",
    "map:reveal",
    "token:move-any",
    "token:move-own",
    "sheet:view-all",
    "sheet:edit-any",
    "sheet:edit-own",
    "npc:manage",
    "audio:control",
    "chat:private-gm",
    "dice:secret-roll",
    "chronicles:edit",
  ]),
  player: new Set<Capability>(["token:move-own", "sheet:edit-own", "chat:private-gm"]),
};

export function can(role: CampaignRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role].has(capability);
}

export const ROLE_LABEL: Record<CampaignRole, string> = {
  game_master: "Mestre",
  player: "Jogador",
};
