/**
 * Database rows (snake_case, jsonb) ↔ domain objects (camelCase, see src/types).
 * Pure functions: the repositories stay thin and these are unit-tested.
 */
import type { Campaign, CampaignInvite, CampaignMember, GameSession, NewCampaignInput } from "@/types/campaign";
import type { Character, NewCharacterInput } from "@/types/character";
import type { Encounter, EncounterInput, JournalEntry, JournalInput, Npc, NpcInput } from "@/types/gm";
import type { LibraryAsset } from "@/types/library";
import type { SavedMap } from "@/types/map";
import type { SystemTemplate } from "@/types/system";
import type { ProfileUpdate, UserProfile } from "@/types/user";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come untyped from PostgREST */
type Row = Record<string, any>;

/** Only the keys present in `patch`, renamed — so partial updates never overwrite other columns. */
function pick(patch: Record<string, unknown>, names: Record<string, string>): Row {
  const row: Row = {};
  for (const [from, to] of Object.entries(names)) if (from in patch && patch[from] !== undefined) row[to] = patch[from];
  return row;
}

/* ---------- Profiles ---------- */

export function toProfile(r: Row): UserProfile {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    username: r.username,
    avatarUrl: r.avatar_url,
    avatarColor: r.avatar_color,
    bio: r.bio,
    playStyle: r.play_style,
    favoriteSystemIds: r.favorite_system_ids ?? [],
    timezone: r.timezone,
    onboardingCompleted: r.onboarding_completed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function profilePatch(p: ProfileUpdate): Row {
  return pick(p as Record<string, unknown>, {
    displayName: "display_name",
    username: "username",
    avatarColor: "avatar_color",
    avatarUrl: "avatar_url",
    bio: "bio",
    playStyle: "play_style",
    favoriteSystemIds: "favorite_system_ids",
    timezone: "timezone",
    onboardingCompleted: "onboarding_completed",
  });
}

/* ---------- Campaigns ---------- */

export const toMember = (r: Row): CampaignMember => ({ userId: r.user_id, role: r.role, characterId: r.character_id ?? null, joinedAt: r.joined_at });

export function toCampaign(r: Row): Campaign {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    systemId: r.system_id,
    visualStyleId: r.visual_style_id,
    status: r.status,
    ownerId: r.owner_id,
    members: ((r.campaign_members ?? []) as Row[]).map(toMember).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
    world: r.world,
    gameMaster: { ...r.game_master, notes: gmNotes(r.campaign_gm_notes) },
    playerPolicy: r.player_policy,
    lastPlayedAt: r.last_played_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** GM notes come embedded (one row, or none when RLS hides it from players). */
function gmNotes(embedded: unknown): string {
  const row = (Array.isArray(embedded) ? embedded[0] : embedded) as Row | null | undefined;
  return typeof row?.notes === "string" ? row.notes : "";
}

/** Campaign columns. Members and GM notes live in their own tables (the campaign row is readable by players). */
export function campaignPatch(p: Partial<NewCampaignInput>): Row {
  const row = pick(p as Record<string, unknown>, {
    name: "name",
    tagline: "tagline",
    systemId: "system_id",
    visualStyleId: "visual_style_id",
    status: "status",
    ownerId: "owner_id",
    world: "world",
    gameMaster: "game_master",
    playerPolicy: "player_policy",
  });
  if (row.game_master) {
    const shared: Row = { ...(row.game_master as Row) };
    delete shared.notes;
    row.game_master = shared;
  }
  return row;
}

/**
 * What changes between the stored members and the wanted list: rows to
 * delete, to update (role / character link) and to insert. Only real changes
 * are sent, so each one is checked by its own policy.
 */
export function diffMembers(current: CampaignMember[], wanted: CampaignMember[]) {
  const before = new Map(current.map((m) => [m.userId, m]));
  const after = new Map(wanted.map((m) => [m.userId, m]));
  return {
    removed: current.filter((m) => !after.has(m.userId)).map((m) => m.userId),
    changed: wanted.filter((m) => {
      const old = before.get(m.userId);
      return old && (old.role !== m.role || (old.characterId ?? null) !== (m.characterId ?? null));
    }),
    // Never written: people join through accept_invite. Reported so callers can tell.
    added: wanted.filter((m) => !before.has(m.userId)),
  };
}

export const memberRow = (campaignId: string, m: CampaignMember): Row => ({ campaign_id: campaignId, user_id: m.userId, role: m.role, character_id: m.characterId ?? null });

/* ---------- Sessions, invites ---------- */

export function toSession(r: Row): GameSession {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    number: r.number,
    title: r.title,
    status: r.status,
    scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes,
    summary: r.summary,
    highlights: r.highlights ?? [],
    attendeeIds: r.attendee_ids ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function sessionRow(s: Omit<GameSession, "id" | "createdAt" | "updatedAt">): Row {
  return {
    campaign_id: s.campaignId,
    number: s.number,
    title: s.title,
    status: s.status,
    scheduled_at: s.scheduledAt,
    duration_minutes: s.durationMinutes,
    summary: s.summary,
    highlights: s.highlights,
    attendee_ids: s.attendeeIds,
  };
}

export function toInvite(r: Row): CampaignInvite {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    systemId: r.system_id,
    invitedById: r.invited_by_id,
    invitedByName: r.invited_by_name,
    email: r.email,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function inviteRow(i: Omit<CampaignInvite, "id" | "createdAt" | "updatedAt" | "status">): Row {
  return {
    campaign_id: i.campaignId,
    campaign_name: i.campaignName,
    system_id: i.systemId,
    invited_by_id: i.invitedById,
    invited_by_name: i.invitedByName,
    email: i.email.trim().toLowerCase(),
    message: i.message,
  };
}

/* ---------- Characters, systems, library ---------- */

export function toCharacter(r: Row): Character {
  return {
    id: r.id,
    ownerId: r.owner_id,
    campaignId: r.campaign_id,
    systemId: r.system_id,
    name: r.name,
    concept: r.concept,
    level: r.level,
    portraitColor: r.portrait_color,
    avatarUrl: r.avatar_url,
    resources: r.resources ?? [],
    tags: r.tags ?? [],
    // Null when the viewer may not see it (another player's sheet).
    ...(r.sheet ? { sheet: r.sheet } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function characterPatch(p: Partial<NewCharacterInput>): Row {
  return pick(p as Record<string, unknown>, {
    ownerId: "owner_id",
    campaignId: "campaign_id",
    systemId: "system_id",
    name: "name",
    concept: "concept",
    level: "level",
    portraitColor: "portrait_color",
    avatarUrl: "avatar_url",
    resources: "resources",
    tags: "tags",
    sheet: "sheet",
  });
}

export const toSystem = (r: Row): SystemTemplate => r.system as SystemTemplate;

export function toLibraryAsset(r: Row): LibraryAsset {
  return {
    id: r.id,
    ownerId: r.owner_id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    biome: r.biome,
    category: r.category,
    tags: r.tags ?? [],
    systemIds: r.system_ids ?? [],
    itemCount: r.item_count,
    previewGradient: (r.preview_gradient?.length === 2 ? r.preview_gradient : ["#222", "#111"]) as [string, string],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* ---------- Maps and GM tools ---------- */

export function toSavedMap(r: Row): SavedMap {
  return { id: r.id, campaignId: r.campaign_id, name: r.name, createdBy: r.created_by, document: r.document, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function toNpc(r: Row): Npc {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    name: r.name,
    concept: r.concept,
    attitude: r.attitude,
    portraitColor: r.portrait_color,
    ...(r.model_id ? { modelId: r.model_id } : {}),
    location: r.location,
    description: r.description,
    secretNotes: r.secret_notes,
    facts: r.facts ?? [],
    stats: r.stats,
    known: r.known,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function npcPatch(p: Partial<NpcInput>): Row {
  const row = pick(p as Record<string, unknown>, {
    campaignId: "campaign_id",
    name: "name",
    concept: "concept",
    attitude: "attitude",
    portraitColor: "portrait_color",
    location: "location",
    description: "description",
    secretNotes: "secret_notes",
    facts: "facts",
    stats: "stats",
    known: "known",
  });
  // An explicit `modelId: undefined` means "automatic": clear the column.
  if ("modelId" in p) row.model_id = p.modelId ?? null;
  return row;
}

export function toEncounter(r: Row): Encounter {
  return { id: r.id, campaignId: r.campaign_id, name: r.name, description: r.description, entries: r.entries ?? [], createdAt: r.created_at, updatedAt: r.updated_at };
}

export function encounterPatch(p: Partial<EncounterInput>): Row {
  return pick(p as Record<string, unknown>, { campaignId: "campaign_id", name: "name", description: "description", entries: "entries" });
}

export function toJournalEntry(r: Row): JournalEntry {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    at: r.at,
    sessionLabel: r.session_label,
    kind: r.kind,
    text: r.text,
    private: r.private,
    ...(r.source_id ? { sourceId: r.source_id } : {}),
    ...(r.dismissed ? { dismissed: true } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function journalRow(j: JournalInput): Row {
  return {
    campaign_id: j.campaignId,
    at: j.at,
    session_label: j.sessionLabel,
    kind: j.kind,
    text: j.text,
    private: j.private,
    source_id: j.sourceId ?? null,
    dismissed: j.dismissed ?? false,
  };
}
