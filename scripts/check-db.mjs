// Applies every migration in supabase/migrations to an in-memory Postgres
// (PGlite) with a minimal stand-in for Supabase's auth schema, then plays
// access scenarios as different users (RLS, guard triggers, functions).
// Usage: npm run db:check
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const results = [];
const ok = (name, cond, detail = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text not null, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  create role anon; create role authenticated;
  grant usage on schema auth to authenticated, anon;
`);

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(dir, f), "utf8")).join(String.fromCharCode(10));
try {
  await db.exec(sql);
  ok("migration applies", true);
} catch (e) {
  ok("migration applies", false, e.message);
  console.log(results.join("\n"));
  process.exit(1);
}
await db.exec(`grant usage on schema public to authenticated, anon; grant select, insert, update, delete on all tables in schema public to authenticated;`);

// Users (inserted as the superuser; the trigger creates profiles).
const longName = (await db.query(`insert into auth.users (email) values ('jean-luc.de.la.barre.long@mesa.com') returning id`)).rows[0].id;
const user = async (email, name) => (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { display_name: name }])).rows[0].id;
const gm = await user("Mestre@Mesa.com", "Mestre");
const p1 = await user("ana@mesa.com", "Ana");
const p2 = await user("bia@mesa.com", "Bia");
const out = await user("fora@mesa.com", "Fora");

const as = async (id, email, fn) => {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)`, [id, email]);
  await db.exec(`set role authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
  }
};
const fails = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
};

const profiles = (await db.query(`select username, display_name, email from public.profiles order by email`)).rows;
const generated = (await db.query(`select username from public.profiles where id = $1`, [longName])).rows[0].username;
ok("generated usernames follow the app's rule", /^[a-z0-9._]{3,20}$/.test(generated), generated);
ok("profiles created by trigger with lowercase e-mail", profiles.length === 5 && profiles.some((p) => p.email === "mestre@mesa.com" && p.display_name === "Mestre"), JSON.stringify(profiles.map((p) => p.username)));

// GM creates a campaign: becomes its GM through the trigger, and can read it back.
const cid = await as(gm, "mestre@mesa.com", async () => {
  const c = (await db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id, player_policy) values ('Cinzas', 'dnd5e', 'ember', $1, '{"maxPlayers": 1}') returning id`, [gm])).rows[0].id;
  const members = (await db.query(`select user_id, role from public.campaign_members where campaign_id = $1`, [c])).rows;
  ok("creator joins as GM", members.length === 1 && members[0].role === "game_master");
  await db.query(`insert into public.npcs (campaign_id, name, portrait_color, stats, known, secret_notes, facts) values ($1, 'Mira', 'red', '{"hp": 5}', true, 'trai o grupo', '[{"id":"a","text":"mapa","revealed":true},{"id":"b","text":"cartas","revealed":false}]')`, [c]);
  await db.query(`insert into public.npcs (campaign_id, name, portrait_color, stats, known) values ($1, 'Oculto', 'red', '{}', false)`, [c]);
  await db.query(`insert into public.journal_entries (campaign_id, at, session_label, kind, text, private) values ($1, now(), 'S1', 'note', 'pública', false), ($1, now(), 'S1', 'note', 'secreta', true)`, [c]);
  await db.query(`insert into public.campaign_invites (campaign_id, campaign_name, system_id, invited_by_id, invited_by_name, email) values ($1, 'Cinzas', 'dnd5e', $2, 'Mestre', 'ana@mesa.com'), ($1, 'Cinzas', 'dnd5e', $2, 'Mestre', 'bia@mesa.com')`, [c, gm]);
  return c;
});

// Ana: not a member yet; sees her invite; accepts it.
await as(p1, "ana@mesa.com", async () => {
  ok("non-member can't see the campaign", (await db.query(`select id from public.campaigns`)).rows.length === 0);
  const inv = (await db.query(`select id from public.campaign_invites`)).rows;
  ok("invitee sees only her invite", inv.length === 1);
  const err = await fails(() => db.query(`insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'player')`, [cid, p1]));
  ok("invitee can't insert herself directly", !!err, err?.slice(0, 60));
  await db.query(`select public.accept_invite($1)`, [inv[0].id]);
  ok("accept_invite joins the campaign", (await db.query(`select id from public.campaigns`)).rows.length === 1);
  ok("players can't read NPCs", (await db.query(`select id from public.npcs`)).rows.length === 0);
  const known = (await db.query(`select name, secret_notes, facts, stats from public.known_npcs($1)`, [cid])).rows;
  ok("known_npcs: only known NPCs, no secrets, only revealed facts", known.length === 1 && known[0].secret_notes === "" && known[0].facts.length === 1 && Object.keys(known[0].stats).length === 0, JSON.stringify(known));
  const journal = (await db.query(`select text from public.journal_entries`)).rows.map((r) => r.text);
  ok("players see only public journal entries", journal.length === 1 && journal[0] === "pública", JSON.stringify(journal));
  const roleErr = await fails(() => db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p1]));
  ok("a player can't promote herself", !!roleErr, roleErr?.slice(0, 60));
  const ch = (await db.query(`insert into public.characters (owner_id, campaign_id, system_id, name, portrait_color, sheet) values ($1, $2, 'dnd5e', 'Isolde', 'red', '{"privateNotes": "segredo"}') returning id`, [p1, cid])).rows[0].id;
  await db.query(`update public.campaign_members set character_id = $1 where campaign_id = $2 and user_id = $3`, [ch, cid, p1]);
  ok("a player links her own character", (await db.query(`select character_id from public.campaign_members where user_id = $1`, [p1])).rows[0].character_id === ch);
});

// Bia: the only seat is taken → accept fails.
await as(p2, "bia@mesa.com", async () => {
  const inv = (await db.query(`select id from public.campaign_invites`)).rows[0].id;
  const err = await fails(() => db.query(`select public.accept_invite($1)`, [inv]));
  ok("accept_invite respects the free seats", !!err && /vagas/.test(err), err?.slice(0, 60));
});

// GM: raises seats; Bia joins; sees Ana's character without the sheet.
await as(gm, "mestre@mesa.com", async () => {
  await db.query(`update public.campaigns set player_policy = '{"maxPlayers": 4}' where id = $1`, [cid]);
  ok("GM reads the player's full sheet", (await db.query(`select sheet from public.characters where campaign_id = $1`, [cid])).rows[0]?.sheet?.privateNotes === "segredo");
});
await as(p2, "bia@mesa.com", async () => {
  await db.query(`select public.accept_invite((select id from public.campaign_invites limit 1))`);
  const party = (await db.query(`select name, sheet from public.campaign_characters($1)`, [cid])).rows;
  ok("another player sees the party without sheets", party.length === 1 && party[0].sheet === null, JSON.stringify(party));
  ok("another player can't select the character table directly", (await db.query(`select id from public.characters`)).rows.length === 0);
  const removeErr = await fails(async () => {
    const r = await db.query(`delete from public.campaign_members where campaign_id = $1 and user_id = $2 returning user_id`, [cid, p1]);
    if (r.rows.length === 0) throw new Error("no rows deleted (RLS)");
  });
  ok("a player can't remove another player", !!removeErr, removeErr?.slice(0, 60));
  ok("profiles: co-members visible", (await db.query(`select id from public.profiles`)).rows.length === 3);
});

// Owner protections.
await as(gm, "mestre@mesa.com", async () => {
  const err = await fails(() => db.query(`delete from public.campaign_members where campaign_id = $1 and user_id = $2`, [cid, gm]));
  ok("the creator can't be removed", !!err && /criou/.test(err), err?.slice(0, 60));
  const demote = await fails(() => db.query(`update public.campaign_members set role = 'player' where campaign_id = $1 and user_id = $2`, [cid, gm]));
  ok("the creator stays GM", !!demote, demote?.slice(0, 60));
  await db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p1]);
  ok("the creator promotes a co-GM", (await db.query(`select role from public.campaign_members where user_id = $1`, [p1])).rows[0].role === "game_master");
  ok("username_taken works", (await db.query(`select public.username_taken('ana') as t`)).rows[0].t === true);
});

// The co-GM can't remove the creator nor another GM's role.
await as(p1, "ana@mesa.com", async () => {
  // RLS hides other members' rows from a co-GM's UPDATE (0 rows changed), or the trigger refuses.
  const err = await fails(() => db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p2]));
  const role = (await db.query(`select role from public.campaign_members where user_id = $1`, [p2])).rows[0]?.role;
  ok("a co-GM can't change roles", role === "player", err ? err.slice(0, 60) : "0 rows updated");
  await db.query(`delete from public.campaign_members where campaign_id = $1 and user_id = $2`, [cid, p2]);
  ok("a co-GM removes a player", (await db.query(`select user_id from public.campaign_members where user_id = $1`, [p2])).rows.length === 0);
});

// Attacks found in review (guarded by the hardening migration).
await as(gm, "mestre@mesa.com", async () => {
  await db.query(`update public.campaigns set game_master = '{"narratorName": "M", "notes": "vilão é o rei"}' where id = $1`, [cid]);
  await db.query(`insert into public.campaign_gm_notes (campaign_id, notes) values ($1, 'vilão é o rei')`, [cid]);
  await db.query(`insert into public.custom_systems (id, owner_id, system) values ('custom_mesa', $1, '{}')`, [gm]);
  await db.query(`update public.campaigns set system_id = 'custom_mesa' where id = $1`, [cid]);
  await db.query(`insert into public.campaign_invites (campaign_id, campaign_name, system_id, invited_by_id, invited_by_name, email) values ($1, 'Cinzas', 'custom_mesa', $2, 'Mestre', 'fora@mesa.com')`, [cid, gm]);
});
await as(p1, "ana@mesa.com", async () => {
  // Ana is a co-GM now.
  await fails(() => db.query(`update public.campaigns set owner_id = $1 where id = $2`, [p1, cid]));
  ok("a co-GM can't take the campaign", (await db.query(`select owner_id from public.campaigns where id = $1`, [cid])).rows[0].owner_id === gm);
  const add = await fails(() => db.query(`insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'game_master')`, [cid, out]));
  ok("nobody adds members directly (only by invite)", !!add, add?.slice(0, 60));
  ok("GM notes stay out of the shared campaign row", !("notes" in (await db.query(`select game_master from public.campaigns where id = $1`, [cid])).rows[0].game_master));
  ok("a co-GM reads the GM notes", (await db.query(`select notes from public.campaign_gm_notes`)).rows[0]?.notes === "vilão é o rei");
});
await as(gm, "mestre@mesa.com", async () => {
  const ch = (await db.query(`select id from public.characters where owner_id = $1`, [p1])).rows[0].id;
  const take = await fails(() => db.query(`update public.characters set owner_id = $1 where id = $2`, [gm, ch]));
  ok("a GM can't take a player's character", !!take, take?.slice(0, 60));
  await db.query(`update public.campaign_members set role = 'player' where campaign_id = $1 and user_id = $2`, [cid, p1]);
});
await as(p1, "ana@mesa.com", async () => {
  ok("players don't read the GM notes", (await db.query(`select notes from public.campaign_gm_notes`)).rows.length === 0);
  ok("members read the campaign's custom system", (await db.query(`select id from public.custom_systems`)).rows.length === 1);
  const mail = await fails(() => db.query(`update public.profiles set email = 'mestre@mesa.com' where id = $1`, [p1]));
  ok("profile e-mail can't be rewritten", !!mail, mail?.slice(0, 60));
});
await as(out, "fora@mesa.com", async () => {
  ok("an invitee reads the campaign's custom system", (await db.query(`select id from public.custom_systems`)).rows.length === 1);
  const inv = (await db.query(`select id from public.campaign_invites`)).rows[0].id;
  const edit = await fails(() => db.query(`update public.campaign_invites set message = 'oi' , status = 'declined' where id = $1`, [inv]));
  ok("an invitee only declines (no other edits)", !!edit, edit?.slice(0, 60));
  await db.query(`update public.campaign_invites set status = 'declined' where id = $1`, [inv]);
  ok("an invitee declines a pending invite", (await db.query(`select status from public.campaign_invites where id = $1`, [inv])).rows[0].status === "declined");
  ok("after declining, the custom system is hidden again", (await db.query(`select id from public.custom_systems`)).rows.length === 0);
  // Outsider's own campaign naming someone else's system doesn't open it.
  await db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id) values ('Espiã', 'custom_mesa', 'ember', $1)`, [out]);
  ok("a foreign campaign naming the system doesn't open it", (await db.query(`select id from public.custom_systems`)).rows.length === 0);
  const spy = (await db.query(`insert into public.characters (owner_id, system_id, name, portrait_color) values ($1, 'dnd5e', 'Spy', 'red') returning id`, [out])).rows[0].id;
  const move = await fails(() => db.query(`update public.characters set campaign_id = $1 where id = $2`, [cid, spy]));
  ok("a character can't move into a campaign its owner doesn't play", !!move, move?.slice(0, 60));
});

// Outsider.
await as(out, "fora@mesa.com", async () => {
  ok("outsider sees only their own profile", (await db.query(`select id from public.profiles`)).rows.length === 1);
  ok("outsider sees no campaign but their own", (await db.query(`select name from public.campaigns`)).rows.every((r) => r.name === "Espiã"));
  ok("outsider gets nothing from known_npcs", (await db.query(`select * from public.known_npcs($1)`, [cid])).rows.length === 0);
});

console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
