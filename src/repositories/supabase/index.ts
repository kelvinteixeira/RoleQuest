/**
 * Supabase implementations of the repository contracts. Access rules live in
 * the database (RLS + functions in supabase/migrations); these stay thin:
 * query, map rows (mappers.ts), translate errors (errors.ts).
 */
import type {
  AuthRepository,
  CampaignRepository,
  CharacterRepository,
  EncounterRepository,
  InviteLinkRepository,
  JournalRepository,
  LibraryRepository,
  MapRepository,
  NpcRepository,
  Repositories,
  SessionRepository,
  SystemRepository,
  UserRepository,
} from "../contracts";
import type { Session } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";
import type { AuthSession } from "@/types/user";
import { toAppError, unwrap, unwrapMaybe } from "./errors";
import { supabaseRoomSync } from "./room-sync";
import { supabaseChronicles } from "./chronicles";
import { supabaseMapImages } from "./map-images";
import { supabaseAudioTracks } from "./audio-tracks";
import {
  campaignPatch,
  characterPatch,
  diffMembers,
  encounterPatch,
  journalRow,
  npcPatch,
  profilePatch,
  sessionRow,
  toCampaign,
  toCharacter,
  toEncounter,
  toInviteLink,
  toInvitePreview,
  toJournalEntry,
  toLibraryAsset,
  toNpc,
  toProfile,
  toSavedMap,
  toSession,
  toSystem,
} from "./mappers";

/** Supabase refreshes the access token by itself; the app keeps the session until the refresh fails. */
const SESSION_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

function toAuthSession(s: Session): AuthSession {
  return { userId: s.user.id, email: s.user.email ?? "", accessToken: s.access_token, expiresAt: new Date(Date.now() + SESSION_HORIZON_MS).toISOString() };
}

const CAMPAIGN_SELECT = "*, campaign_members(*), campaign_gm_notes(notes)";

const auth: AuthRepository = {
  async signIn(email, password) {
    const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw toAppError({ code: error.code ?? (error.status === 400 ? "invalid_credentials" : undefined), message: error.message, status: error.status });
    return toAuthSession(data.session);
  },
  async signUp({ email, password, displayName }) {
    const { data, error } = await supabase().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined },
    });
    if (error) throw toAppError({ code: error.code, message: error.message, status: error.status });
    // With "Confirm email" on, there is no session until the link is clicked.
    if (!data.session) throw new AppError("validation", "Conta criada! Confirme seu e-mail pelo link que enviamos e depois entre.");
    return toAuthSession(data.session);
  },
  async signOut() {
    await supabase().auth.signOut();
  },
  async requestPasswordReset(email) {
    // Resolves whatever happens: no account enumeration.
    await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined });
  },
  async updatePassword(password) {
    // The reset link signs the user in (recovery session) on the /reset-password page.
    const { data: current } = await supabase().auth.getSession();
    if (!current.session) throw new AppError("validation", "O link de redefinição expirou ou já foi usado. Peça um novo.");
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw toAppError({ code: error.code, message: error.message, status: error.status });
    const { data } = await supabase().auth.getSession();
    if (!data.session) throw new AppError("unauthenticated");
    return toAuthSession(data.session);
  },
  async accessToken() {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? null;
  },
  async resume(stored) {
    const { data } = await supabase().auth.getSession();
    // Only the account the app signed in: a session left by a link for another account is not adopted.
    if (!data.session || !stored || stored.userId !== data.session.user.id) return null;
    return toAuthSession(data.session);
  },
};

const users: UserRepository = {
  async getById(id) {
    const row = unwrapMaybe(await supabase().from("profiles").select("*").eq("id", id).maybeSingle());
    return row ? toProfile(row) : null;
  },
  async getMany(ids) {
    if (ids.length === 0) return [];
    return unwrap(await supabase().from("profiles").select("*").in("id", [...new Set(ids)])).map(toProfile);
  },
  async update(id, patch) {
    return toProfile(unwrap(await supabase().from("profiles").update(profilePatch(patch)).eq("id", id).select("*").single()));
  },
  async isUsernameTaken(username, exceptUserId) {
    return unwrap(await supabase().rpc("username_taken", { candidate: username, except_user: exceptUserId ?? null })) as boolean;
  },
};

/** GM-only notes (RLS: GMs of the campaign). Players never send them. */
async function saveGmNotes(campaignId: string, notes: string | undefined) {
  if (notes === undefined) return;
  unwrap(await supabase().from("campaign_gm_notes").upsert({ campaign_id: campaignId, notes }, { onConflict: "campaign_id" }));
}

async function loadCampaign(id: string) {
  const row = unwrapMaybe(await supabase().from("campaigns").select(CAMPAIGN_SELECT).eq("id", id).maybeSingle());
  return row ? toCampaign(row) : null;
}

const campaigns: CampaignRepository = {
  async listForUser(userId) {
    const memberships = unwrap(await supabase().from("campaign_members").select("campaign_id").eq("user_id", userId));
    const ids = memberships.map((m) => m.campaign_id as string);
    if (ids.length === 0) return [];
    return unwrap(await supabase().from("campaigns").select(CAMPAIGN_SELECT).in("id", ids)).map(toCampaign);
  },
  getById: loadCampaign,
  async create(input) {
    // The creator becomes GM through a database trigger; everyone else joins by invite link.
    const row = unwrap<{ id: string }>(await supabase().from("campaigns").insert(campaignPatch(input)).select("id").single());
    await saveGmNotes(row.id, input.gameMaster?.notes);
    const created = await loadCampaign(row.id);
    if (!created) throw new AppError("unknown", "A campanha foi criada mas não pôde ser lida.");
    return created;
  },
  async update(id, patch) {
    const { members, ...fields } = patch;
    const columns = campaignPatch(fields);
    if (Object.keys(columns).length) unwrap(await supabase().from("campaigns").update(columns).eq("id", id));
    if (fields.gameMaster) await saveGmNotes(id, fields.gameMaster.notes);
    if (members) {
      const current = await loadCampaign(id);
      if (!current) throw new AppError("not_found");
      const { removed, changed, added } = diffMembers(current.members, members);
      if (added.length) throw new AppError("forbidden", "Novos membros entram pelo convite.");
      for (const userId of removed) unwrap(await supabase().from("campaign_members").delete().eq("campaign_id", id).eq("user_id", userId));
      for (const m of changed) unwrap(await supabase().from("campaign_members").update({ role: m.role, character_id: m.characterId ?? null }).eq("campaign_id", id).eq("user_id", m.userId));
    }
    const updated = await loadCampaign(id);
    if (!updated) throw new AppError("not_found");
    return updated;
  },
};

const sessions: SessionRepository = {
  async listForCampaigns(ids) {
    if (ids.length === 0) return [];
    return unwrap(await supabase().from("game_sessions").select("*").in("campaign_id", ids)).map(toSession);
  },
  async create(input) {
    return toSession(unwrap(await supabase().from("game_sessions").insert(sessionRow(input)).select("*").single()));
  },
};

const inviteLinks: InviteLinkRepository = {
  async getForCampaign(campaignId) {
    const row = unwrapMaybe(await supabase().from("campaign_invite_links").select("*").eq("campaign_id", campaignId).maybeSingle());
    return row ? toInviteLink(row) : null;
  },
  async renew(campaignId) {
    // The code is generated by the database (random), never by the client.
    return toInviteLink(unwrap<Record<string, unknown>>(await supabase().rpc("new_invite_link", { cid: campaignId })));
  },
  async revoke(campaignId) {
    unwrap(await supabase().from("campaign_invite_links").delete().eq("campaign_id", campaignId));
  },
  async preview(code) {
    const rows = unwrap(await supabase().rpc("invite_preview", { invite_code: code })) as Record<string, unknown>[] | null;
    return rows?.[0] ? toInvitePreview(rows[0]) : null;
  },
  async join(code) {
    return unwrap<string>(await supabase().rpc("join_campaign", { invite_code: code }));
  },
};

const characters: CharacterRepository = {
  async listForUser(userId) {
    return unwrap(await supabase().from("characters").select("*").eq("owner_id", userId)).map(toCharacter);
  },
  async listForCampaign(campaignId) {
    // Through a function: other players' characters come without their sheet.
    return (unwrap(await supabase().rpc("campaign_characters", { cid: campaignId })) as Record<string, unknown>[]).map(toCharacter);
  },
  async getById(id) {
    const row = unwrapMaybe(await supabase().from("characters").select("*").eq("id", id).maybeSingle());
    return row ? toCharacter(row) : null;
  },
  async create(input) {
    return toCharacter(unwrap(await supabase().from("characters").insert(characterPatch(input)).select("*").single()));
  },
  async update(id, patch) {
    return toCharacter(unwrap(await supabase().from("characters").update(characterPatch(patch)).eq("id", id).select("*").single()));
  },
  async remove(id) {
    // campaign_members.character_id is cleared by the foreign key (ON DELETE SET NULL).
    unwrap(await supabase().from("characters").delete().eq("id", id));
  },
};

const library: LibraryRepository = {
  async listForUser(userId) {
    return unwrap(await supabase().from("library_assets").select("*").eq("owner_id", userId)).map(toLibraryAsset);
  },
};

const systems: SystemRepository = {
  async listCustom(ownerId) {
    return unwrap(await supabase().from("custom_systems").select("system").eq("owner_id", ownerId)).map(toSystem);
  },
  async getCustom(id) {
    const row = unwrapMaybe(await supabase().from("custom_systems").select("system").eq("id", id).maybeSingle());
    return row ? toSystem(row) : null;
  },
  async saveCustom(ownerId, system) {
    unwrap(await supabase().from("custom_systems").upsert({ id: system.id, owner_id: ownerId, system }, { onConflict: "id" }));
    return system;
  },
};

const maps: MapRepository = {
  async listForCampaign(campaignId) {
    return unwrap(await supabase().from("saved_maps").select("*").eq("campaign_id", campaignId).order("updated_at", { ascending: false })).map(toSavedMap);
  },
  async getById(id) {
    const row = unwrapMaybe(await supabase().from("saved_maps").select("*").eq("id", id).maybeSingle());
    return row ? toSavedMap(row) : null;
  },
  async save(map) {
    const row = { id: map.id, campaign_id: map.campaignId, name: map.name, created_by: map.createdBy, document: map.document };
    return toSavedMap(unwrap(await supabase().from("saved_maps").upsert(row, { onConflict: "id" }).select("*").single()));
  },
  async remove(id) {
    unwrap(await supabase().from("saved_maps").delete().eq("id", id));
  },
};

const npcs: NpcRepository = {
  async listForCampaign(campaignId) {
    return unwrap(await supabase().from("npcs").select("*").eq("campaign_id", campaignId).order("name")).map(toNpc);
  },
  async listKnownForCampaign(campaignId) {
    return (unwrap(await supabase().rpc("known_npcs", { cid: campaignId })) as Record<string, unknown>[]).map(toNpc);
  },
  async getById(id) {
    const row = unwrapMaybe(await supabase().from("npcs").select("*").eq("id", id).maybeSingle());
    return row ? toNpc(row) : null;
  },
  async create(input) {
    return toNpc(unwrap(await supabase().from("npcs").insert(npcPatch(input)).select("*").single()));
  },
  async update(id, patch) {
    return toNpc(unwrap(await supabase().from("npcs").update(npcPatch(patch)).eq("id", id).select("*").single()));
  },
  async remove(id) {
    const npc = unwrapMaybe<{ campaign_id: string }>(await supabase().from("npcs").select("campaign_id").eq("id", id).maybeSingle());
    unwrap(await supabase().from("npcs").delete().eq("id", id));
    // Like the mock: drop the NPC from its campaign's encounters.
    if (npc) {
      const list = unwrap<{ id: string; entries: { npcId: string }[] }[]>(await supabase().from("encounters").select("id, entries").eq("campaign_id", npc.campaign_id));
      for (const e of list) {
        const entries = (e.entries as { npcId: string }[]).filter((x) => x.npcId !== id);
        if (entries.length !== (e.entries as unknown[]).length) unwrap(await supabase().from("encounters").update({ entries }).eq("id", e.id));
      }
    }
  },
};

const encounters: EncounterRepository = {
  async listForCampaign(campaignId) {
    return unwrap(await supabase().from("encounters").select("*").eq("campaign_id", campaignId).order("updated_at", { ascending: false })).map(toEncounter);
  },
  async create(input) {
    return toEncounter(unwrap(await supabase().from("encounters").insert(encounterPatch(input)).select("*").single()));
  },
  async update(id, patch) {
    return toEncounter(unwrap(await supabase().from("encounters").update(encounterPatch(patch)).eq("id", id).select("*").single()));
  },
  async remove(id) {
    unwrap(await supabase().from("encounters").delete().eq("id", id));
  },
};

const journal: JournalRepository = {
  async listForCampaign(campaignId) {
    return unwrap(await supabase().from("journal_entries").select("*").eq("campaign_id", campaignId).order("at")).map(toJournalEntry);
  },
  async add(entries) {
    if (entries.length === 0) return [];
    // A source already recorded (another tab, a retry) is skipped by the unique (campaign, source) key.
    const { data, error } = await supabase().from("journal_entries").upsert(entries.map(journalRow), { onConflict: "campaign_id,source_id", ignoreDuplicates: true }).select("*");
    if (error) throw toAppError(error);
    return (data ?? []).map(toJournalEntry);
  },
  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.text !== undefined) row.text = patch.text;
    if (patch.private !== undefined) row.private = patch.private;
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.dismissed !== undefined) row.dismissed = patch.dismissed;
    return toJournalEntry(unwrap(await supabase().from("journal_entries").update(row).eq("id", id).select("*").single()));
  },
  async remove(id) {
    unwrap(await supabase().from("journal_entries").delete().eq("id", id));
  },
};

/** Map pictures stay in this browser (IndexedDB) until the Storage step. */
export const supabaseRepositories: Repositories = { auth, users, campaigns, sessions, inviteLinks, characters, library, systems, maps, images: supabaseMapImages, npcs, encounters, journal, roomSync: supabaseRoomSync, chronicles: supabaseChronicles, audioTracks: supabaseAudioTracks };
