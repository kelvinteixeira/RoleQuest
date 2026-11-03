/**
 * Upgrades rooms saved in the browser by older versions. Version 0 rooms had
 * a single "d20 + attack bonus vs. defense" block per token and no rules.
 */
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import type { RoomState, RoomToken } from "./types";

interface LegacyStats {
  defense: number;
  attackBonus: number;
  damage: string;
  speed: number;
  initiativeBonus: number;
  heals?: number;
}

type StoredToken = Omit<RoomToken, "stats"> & { stats: RoomToken["stats"] | LegacyStats };
type StoredRoom = Omit<RoomState, "rules" | "tokens"> & { rules?: RoomState["rules"]; tokens: StoredToken[] };

const isLegacy = (stats: StoredToken["stats"]): stats is LegacyStats => !("attacks" in stats);

export function upgradeToken(token: StoredToken): RoomToken {
  if (!isLegacy(token.stats)) return token as RoomToken;
  const s = token.stats;
  // Enemies and bots keep their block so the room can re-derive it for the campaign system.
  const npc =
    token.kind === "enemy" || token.controller === "bot"
      ? { hp: token.hp.max, defense: s.defense, attackBonus: s.attackBonus, damage: s.damage, speed: s.speed, initiativeBonus: s.initiativeBonus, heals: s.heals }
      : undefined;
  return {
    ...token,
    npc,
    stats: {
      defense: s.defense,
      armor: 0,
      speed: s.speed,
      initiative: s.initiativeBonus,
      heals: s.heals,
      attacks: [{ id: "legacy-attack", name: "Ataque", value: s.attackBonus, damage: s.damage, range: 1 }],
    },
  };
}

export function upgradeRoom(room: StoredRoom): RoomState {
  return { ...room, rules: room.rules ?? DEFAULT_RULES, tokens: room.tokens.map(upgradeToken) };
}

export function upgradeRooms(rooms: Record<string, StoredRoom> | undefined): Record<string, RoomState> {
  return Object.fromEntries(Object.entries(rooms ?? {}).map(([id, room]) => [id, upgradeRoom(room)]));
}
