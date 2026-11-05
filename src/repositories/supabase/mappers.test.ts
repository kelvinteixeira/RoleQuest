import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import type { CampaignMember } from "@/types/campaign";
import { toAppError } from "./errors";
import {
  campaignPatch,
  characterPatch,
  diffMembers,
  journalRow,
  npcPatch,
  profilePatch,
  toCampaign,
  toCharacter,
  toJournalEntry,
  toNpc,
  toProfile,
} from "./mappers";

const member = (userId: string, role: CampaignMember["role"], characterId: string | null = null): CampaignMember => ({ userId, role, characterId, joinedAt: "2026-01-01T00:00:00Z" });

describe("row mappers", () => {
  it("profiles: snake_case rows to the domain, partial updates touch only given fields", () => {
    const p = toProfile({ id: "u1", email: "a@b.com", display_name: "Ana", username: "ana", avatar_url: null, avatar_color: "red", bio: "", play_style: "both", favorite_system_ids: null, timezone: "UTC", onboarding_completed: true, created_at: "c", updated_at: "u" });
    expect(p).toMatchObject({ displayName: "Ana", favoriteSystemIds: [], onboardingCompleted: true });
    expect(profilePatch({ bio: "oi", onboardingCompleted: true })).toEqual({ bio: "oi", onboarding_completed: true });
    expect(profilePatch({})).toEqual({});
  });

  it("campaigns carry their members (ordered by join date); members never go to the campaign row", () => {
    const c = toCampaign({
      id: "c1", name: "X", tagline: "", system_id: "dnd5e", visual_style_id: "ember", status: "active", owner_id: "u1",
      world: { name: "W" }, game_master: {}, player_policy: { maxPlayers: 4 }, last_played_at: null, created_at: "", updated_at: "",
      campaign_members: [
        { user_id: "u2", role: "player", character_id: "ch1", joined_at: "2026-02-01" },
        { user_id: "u1", role: "game_master", character_id: null, joined_at: "2026-01-01" },
      ],
    });
    expect(c.members.map((m) => m.userId)).toEqual(["u1", "u2"]);
    expect(c.playerPolicy.maxPlayers).toBe(4);
    expect(campaignPatch({ name: "Y", members: [member("u1", "game_master")], playerPolicy: c.playerPolicy })).toEqual({ name: "Y", player_policy: { maxPlayers: 4 } });
  });

  it("GM notes never go to the shared campaign row; they come from their own table (or not at all for players)", () => {
    const gameMaster = { narratorName: "M", narrationStyle: "cinematic", notes: "segredo" };
    expect(campaignPatch({ gameMaster })).toEqual({ game_master: { narratorName: "M", narrationStyle: "cinematic" } });
    const row = { id: "c", game_master: { narratorName: "M" }, campaign_members: [] };
    expect(toCampaign({ ...row, campaign_gm_notes: { notes: "segredo" } }).gameMaster.notes).toBe("segredo");
    expect(toCampaign({ ...row, campaign_gm_notes: [{ notes: "lista" }] }).gameMaster.notes).toBe("lista");
    expect(toCampaign({ ...row, campaign_gm_notes: null }).gameMaster).toEqual({ narratorName: "M", notes: "" });
  });

  it("characters without a visible sheet have no sheet key (other players' characters)", () => {
    const base = { id: "ch", owner_id: "u", campaign_id: "c", system_id: "dnd5e", name: "N", concept: "", level: 1, portrait_color: "red", avatar_url: null, resources: [], tags: [], created_at: "", updated_at: "" };
    expect("sheet" in toCharacter({ ...base, sheet: null })).toBe(false);
    expect(toCharacter({ ...base, sheet: { attributes: {} } }).sheet).toEqual({ attributes: {} });
    // campaignId: null must be sent (unlinking a character), undefined must not.
    expect(characterPatch({ campaignId: null, name: "Z" })).toEqual({ campaign_id: null, name: "Z" });
    expect(characterPatch({ name: undefined })).toEqual({});
  });

  it("NPCs: explicit modelId undefined clears the look; journal rows keep source and dismissal", () => {
    expect(npcPatch({ modelId: undefined })).toEqual({ model_id: null });
    expect(npcPatch({ known: true })).toEqual({ known: true });
    expect(toNpc({ id: "n", campaign_id: "c", name: "N", concept: "", attitude: "ally", portrait_color: "", model_id: null, location: "", description: "", secret_notes: "", facts: null, stats: {}, known: false, created_at: "", updated_at: "" })).not.toHaveProperty("modelId");
    const row = journalRow({ campaignId: "c", at: "t", sessionLabel: "S", kind: "epic", text: "x", private: false, sourceId: "m1" });
    expect(row).toMatchObject({ source_id: "m1", dismissed: false });
    expect(toJournalEntry({ ...row, id: "j", created_at: "", updated_at: "" })).toMatchObject({ sourceId: "m1" });
    expect(toJournalEntry({ ...row, id: "j", source_id: null, dismissed: true, created_at: "", updated_at: "" })).toMatchObject({ dismissed: true });
  });
});

describe("member changes", () => {
  it("only real changes are sent: removals, role/character changes and additions", () => {
    const current = [member("gm", "game_master"), member("a", "player"), member("b", "player", "ch1")];
    const wanted = [member("gm", "game_master"), member("a", "game_master"), member("b", "player", "ch2"), member("c", "player")];
    expect(diffMembers(current, wanted)).toEqual({ removed: [], changed: [wanted[1], wanted[2]], added: [wanted[3]] });
    expect(diffMembers(current, current.slice(0, 2))).toEqual({ removed: ["b"], changed: [], added: [] });
    expect(diffMembers(current, current)).toEqual({ removed: [], changed: [], added: [] });
  });
});

describe("database errors", () => {
  it("become the app's error codes", () => {
    const code = (e: Parameters<typeof toAppError>[0]) => toAppError(e).code;
    expect(code({ code: "42501", message: "new row violates row-level security policy" })).toBe("forbidden");
    expect(toAppError({ code: "42501", message: "Só quem criou a campanha muda os papéis." }).message).toBe("Só quem criou a campanha muda os papéis.");
    expect(code({ code: "22023", message: "A campanha já está com todas as vagas preenchidas." })).toBe("validation");
    expect(code({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })).toBe("not_found");
    expect(code({ code: "invalid_credentials" })).toBe("invalid_credentials");
    expect(code({ code: "user_already_exists" })).toBe("email_taken");
    expect(code({ status: 401 })).toBe("unauthenticated");
    expect(code({ status: 429 })).toBe("validation");
    expect(toAppError({ code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }).message).toBe("Não encontrado.");
    expect(toAppError({ code: "23514", message: 'new row for relation "characters" violates check constraint' }).message).not.toMatch(/relation/);
    expect(toAppError(null)).toBeInstanceOf(AppError);
  });
});
