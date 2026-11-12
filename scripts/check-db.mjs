// Applies every migration in supabase/migrations to an in-memory Postgres
// (PGlite) with minimal stand-ins for Supabase's auth and realtime schemas, then plays
// access scenarios as different users (RLS, guard triggers, functions),
// including attempts to get around each rule.
// Usage: npm run db:check
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const results = [];
const ok = (name, cond, detail = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  create role anon; create role authenticated;
  grant usage on schema auth to authenticated, anon;
  -- Realtime Authorization: Supabase checks policies on realtime.messages with the channel's topic set.
  create schema realtime;
  create table realtime.messages (id bigint generated always as identity primary key, topic text not null, extension text not null, payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
  grant usage on schema realtime to authenticated, anon;
  grant select, insert on realtime.messages to authenticated;
`);

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(dir, f), "utf8")).join(String.fromCharCode(10));
try {
  await db.exec(sql);
  ok("migrations apply", true, files.length + " files");
} catch (e) {
  ok("migrations apply", false, e.message);
  console.log(results.join("\n"));
  process.exit(1);
}
// Supabase grants table privileges to these roles by default; RLS decides the rows.
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

// GM creates a campaign (1 seat): becomes its GM through the trigger, and makes the invite link.
const { cid, code } = await as(gm, "mestre@mesa.com", async () => {
  const c = (await db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id, player_policy, game_master) values ('Cinzas', 'dnd5e', 'ember', $1, '{"maxPlayers": 1}', '{"narratorName": "O Cronista", "notes": "vilão é o rei"}') returning id`, [gm])).rows[0].id;
  const members = (await db.query(`select user_id, role from public.campaign_members where campaign_id = $1`, [c])).rows;
  ok("creator joins as GM", members.length === 1 && members[0].role === "game_master");
  ok("GM notes never stay in the shared campaign row", !("notes" in (await db.query(`select game_master from public.campaigns where id = $1`, [c])).rows[0].game_master));
  await db.query(`insert into public.campaign_gm_notes (campaign_id, notes) values ($1, 'vilão é o rei')`, [c]);
  await db.query(`insert into public.npcs (campaign_id, name, portrait_color, stats, known, secret_notes, facts) values ($1, 'Mira', 'red', '{"hp": 5}', true, 'trai o grupo', '[{"id":"a","text":"mapa","revealed":true},{"id":"b","text":"cartas","revealed":false}]')`, [c]);
  await db.query(`insert into public.npcs (campaign_id, name, portrait_color, stats, known) values ($1, 'Oculto', 'red', '{}', false)`, [c]);
  await db.query(`insert into public.journal_entries (campaign_id, at, session_label, kind, text, private) values ($1, now(), 'S1', 'note', 'pública', false), ($1, now(), 'S1', 'note', 'secreta', true)`, [c]);
  const forged = await fails(() => db.query(`insert into public.campaign_invite_links (campaign_id, code) values ($1, 'escolhido')`, [c]));
  ok("invite codes can't be picked by hand", !!forged, forged?.slice(0, 60));
  const link = (await db.query(`select * from public.new_invite_link($1)`, [c])).rows[0];
  ok("the GM creates a random invite link", /^[0-9a-f]{32}$/.test(link.code));
  return { cid: c, code: link.code };
});

// Ana: not a member yet; opens the link; joins.
await as(p1, "ana@mesa.com", async () => {
  ok("non-member can't see the campaign", (await db.query(`select id from public.campaigns`)).rows.length === 0);
  ok("non-member can't read invite links", (await db.query(`select code from public.campaign_invite_links`)).rows.length === 0);
  const preview = (await db.query(`select * from public.invite_preview($1)`, [code])).rows;
  ok("the link shows a preview (name, GM, seats)", preview.length === 1 && preview[0].campaign_name === "Cinzas" && preview[0].game_master_name === "O Cronista" && preview[0].free_seats === 1 && !preview[0].already_member, JSON.stringify(preview[0]));
  ok("a wrong code shows nothing", (await db.query(`select * from public.invite_preview('nao-existe')`)).rows.length === 0);
  const wrong = await fails(() => db.query(`select public.join_campaign('nao-existe')`));
  ok("a wrong code doesn't join", !!wrong && /não vale mais/.test(wrong), wrong?.slice(0, 60));
  const err = await fails(() => db.query(`insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'player')`, [cid, p1]));
  ok("nobody inserts themselves directly", !!err, err?.slice(0, 60));
  ok("join_campaign joins and returns the campaign", (await db.query(`select public.join_campaign($1) as id`, [code])).rows[0].id === cid);
  ok("opening the link again is harmless", (await db.query(`select public.join_campaign($1) as id`, [code])).rows[0].id === cid);
  ok("members see the campaign", (await db.query(`select id from public.campaigns`)).rows.length === 1);
  ok("players can't read invite links", (await db.query(`select code from public.campaign_invite_links`)).rows.length === 0);
  const renew = await fails(() => db.query(`select * from public.new_invite_link($1)`, [cid]));
  ok("players can't make invite links", !!renew, renew?.slice(0, 60));
  ok("players can't read NPCs", (await db.query(`select id from public.npcs`)).rows.length === 0);
  const known = (await db.query(`select name, secret_notes, facts, stats from public.known_npcs($1)`, [cid])).rows;
  ok("known_npcs: only known NPCs, no secrets, only revealed facts", known.length === 1 && known[0].secret_notes === "" && known[0].facts.length === 1 && Object.keys(known[0].stats).length === 0, JSON.stringify(known));
  const journal = (await db.query(`select text from public.journal_entries`)).rows.map((r) => r.text);
  ok("players see only public journal entries", journal.length === 1 && journal[0] === "pública", JSON.stringify(journal));
  ok("players don't read the GM notes", (await db.query(`select notes from public.campaign_gm_notes`)).rows.length === 0);
  const roleErr = await fails(() => db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p1]));
  ok("a player can't promote herself", !!roleErr, roleErr?.slice(0, 60));
  const ch = (await db.query(`insert into public.characters (owner_id, campaign_id, system_id, name, portrait_color, sheet) values ($1, $2, 'dnd5e', 'Isolde', 'red', '{"privateNotes": "segredo"}') returning id`, [p1, cid])).rows[0].id;
  await db.query(`update public.campaign_members set character_id = $1 where campaign_id = $2 and user_id = $3`, [ch, cid, p1]);
  ok("a player links her own character", (await db.query(`select character_id from public.campaign_members where user_id = $1`, [p1])).rows[0].character_id === ch);
  const mail = await fails(() => db.query(`update public.profiles set email = 'mestre@mesa.com' where id = $1`, [p1]));
  ok("profile e-mail can't be rewritten", !!mail, mail?.slice(0, 60));
});

// Bia: the only seat is taken → joining fails.
await as(p2, "bia@mesa.com", async () => {
  ok("the preview shows no free seats", (await db.query(`select free_seats from public.invite_preview($1)`, [code])).rows[0].free_seats === 0);
  const err = await fails(() => db.query(`select public.join_campaign($1)`, [code]));
  ok("join_campaign respects the free seats", !!err && /vagas/.test(err), err?.slice(0, 60));
});

// GM: raises seats; reads the full sheet; custom system for the table.
await as(gm, "mestre@mesa.com", async () => {
  await db.query(`update public.campaigns set player_policy = '{"maxPlayers": 4}' where id = $1`, [cid]);
  ok("GM reads the player's full sheet", (await db.query(`select sheet from public.characters where campaign_id = $1`, [cid])).rows[0]?.sheet?.privateNotes === "segredo");
  ok("GM reads the invite link", (await db.query(`select code from public.campaign_invite_links`)).rows[0]?.code === code);
  await db.query(`insert into public.custom_systems (id, owner_id, system) values ('custom_mesa', $1, '{"name": "Mesa Própria"}')`, [gm]);
  await db.query(`update public.campaigns set system_id = 'custom_mesa' where id = $1`, [cid]);
});
await as(p2, "bia@mesa.com", async () => {
  await db.query(`select public.join_campaign($1)`, [code]);
  const party = (await db.query(`select name, sheet from public.campaign_characters($1)`, [cid])).rows;
  ok("another player sees the party without sheets", party.length === 1 && party[0].sheet === null, JSON.stringify(party));
  ok("another player can't select the character table directly", (await db.query(`select id from public.characters`)).rows.length === 0);
  ok("members read the campaign's custom system", (await db.query(`select id from public.custom_systems`)).rows.length === 1);
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
  const ch = (await db.query(`select id from public.characters where owner_id = $1`, [p1])).rows[0].id;
  const take = await fails(() => db.query(`update public.characters set owner_id = $1 where id = $2`, [gm, ch]));
  ok("a GM can't take a player's character", !!take, take?.slice(0, 60));
  await db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p1]);
  ok("the creator promotes a co-GM", (await db.query(`select role from public.campaign_members where user_id = $1`, [p1])).rows[0].role === "game_master");
  ok("username_taken works", (await db.query(`select public.username_taken('ana') as t`)).rows[0].t === true);
});

// The co-GM: manages players and the link, but can't take the campaign or change roles.
const renewedCode = await as(p1, "ana@mesa.com", async () => {
  await fails(() => db.query(`update public.campaigns set owner_id = $1 where id = $2`, [p1, cid]));
  ok("a co-GM can't take the campaign", (await db.query(`select owner_id from public.campaigns where id = $1`, [cid])).rows[0].owner_id === gm);
  ok("a co-GM reads the GM notes", (await db.query(`select notes from public.campaign_gm_notes`)).rows[0]?.notes === "vilão é o rei");
  // RLS hides other members' rows from a co-GM's UPDATE (0 rows changed), or the trigger refuses.
  const err = await fails(() => db.query(`update public.campaign_members set role = 'game_master' where campaign_id = $1 and user_id = $2`, [cid, p2]));
  const role = (await db.query(`select role from public.campaign_members where user_id = $1`, [p2])).rows[0]?.role;
  ok("a co-GM can't change roles", role === "player", err ? err.slice(0, 60) : "0 rows updated");
  await db.query(`delete from public.campaign_members where campaign_id = $1 and user_id = $2`, [cid, p2]);
  ok("a co-GM removes a player", (await db.query(`select user_id from public.campaign_members where user_id = $1`, [p2])).rows.length === 0);
  const renewed = (await db.query(`select * from public.new_invite_link($1)`, [cid])).rows[0].code;
  ok("a co-GM makes a new link (new code)", renewed !== code);
  ok("the old link stops working", (await db.query(`select * from public.invite_preview($1)`, [code])).rows.length === 0);
  return renewed;
});

// Outsider.
await as(out, "fora@mesa.com", async () => {
  ok("outsider sees only their own profile", (await db.query(`select id from public.profiles`)).rows.length === 1);
  ok("outsider sees no campaign", (await db.query(`select id from public.campaigns`)).rows.length === 0);
  ok("outsider gets nothing from known_npcs", (await db.query(`select * from public.known_npcs($1)`, [cid])).rows.length === 0);
  ok("outsider can't read the custom system", (await db.query(`select id from public.custom_systems`)).rows.length === 0);
  const named = (await db.query(`select system_name from public.invite_preview($1)`, [renewedCode])).rows[0]?.system_name;
  ok("the preview names the custom system (unreadable before joining)", named === "Mesa Própria", named);
  const old = await fails(() => db.query(`select public.join_campaign($1)`, [code]));
  ok("outsider can't join with the old link", !!old, old?.slice(0, 60));
  // Their own campaign naming someone else's system doesn't open it.
  await db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id) values ('Espiã', 'custom_mesa', 'ember', $1)`, [out]);
  ok("a foreign campaign naming the system doesn't open it", (await db.query(`select id from public.custom_systems`)).rows.length === 0);
  const spy = (await db.query(`insert into public.characters (owner_id, system_id, name, portrait_color) values ($1, 'dnd5e', 'Spy', 'red') returning id`, [out])).rows[0].id;
  const move = await fails(() => db.query(`update public.characters set campaign_id = $1 where id = $2`, [cid, spy]));
  ok("a character can't move into a campaign its owner doesn't play", !!move, move?.slice(0, 60));
});

// ---------- The table in real time ----------
// A fresh table: the GM, two players (Ana, Bia), and the outsider.
const { tid, tcode } = await as(gm, "mestre@mesa.com", async () => {
  const c = (await db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id, player_policy) values ('Mesa Viva', 'dnd5e', 'ember', $1, '{"maxPlayers": 4}') returning id`, [gm])).rows[0].id;
  return { tid: c, tcode: (await db.query(`select code from public.new_invite_link($1)`, [c])).rows[0].code };
});
for (const [id, email] of [[p1, "ana@mesa.com"], [p2, "bia@mesa.com"]]) await as(id, email, () => db.query(`select public.join_campaign($1)`, [tcode]));

await as(gm, "mestre@mesa.com", async () => {
  const claim = (await db.query(`select * from public.claim_room_host($1, 'aba-1')`, [tid])).rows[0];
  ok("the GM hosts the table", claim.hosting === true && claim.holder_client === "aba-1");
  ok("another tab doesn't steal a live host", (await db.query(`select hosting from public.claim_room_host($1, 'aba-2')`, [tid])).rows[0].hosting === false);
  ok("…unless it takes over", (await db.query(`select hosting from public.claim_room_host($1, 'aba-2', true)`, [tid])).rows[0].hosting === true);
  ok("the host saves the full state", (await db.query(`select public.save_room_state($1, 'aba-2', '{"secret": "emboscada no rio"}') as ok`, [tid])).rows[0].ok === true);
  ok("a tab without the lease can't save over it", (await db.query(`select public.save_room_state($1, 'aba-1', '{"secret": "velho"}') as ok`, [tid])).rows[0].ok === false);
  const views = JSON.stringify([{ user_id: p1, view: { me: "ana" }, revision: 1 }, { user_id: p2, view: { me: "bia" }, revision: 1 }, { user_id: out, view: { me: "fora" }, revision: 1 }]);
  ok("the host publishes views and the players' map", (await db.query(`select public.publish_room($1, 'aba-2', $2, '{"name": "Rio"}', 1) as ok`, [tid, views])).rows[0].ok === true);
  ok("…and publishes again over them (upsert)", (await db.query(`select public.publish_room($1, 'aba-2', $2) as ok`, [tid, views])).rows[0].ok === true);
  ok("views are only written for members", (await db.query(`select user_id from public.room_views where campaign_id = $1`, [tid])).rows.length === 2);
  ok("a tab without the lease can't publish", (await db.query(`select public.publish_room($1, 'aba-1', $2) as ok`, [tid, JSON.stringify([{ user_id: p1, view: { me: "velho" }, revision: 9 }])])).rows[0].ok === false);
  await db.query(`insert into public.room_presence (campaign_id, user_id, hosting, seen_at) values ($1, $2, true, '2000-01-01')`, [tid, gm]);
  ok("presence is stamped by the server's clock", new Date((await db.query(`select seen_at from public.room_presence where user_id = $1 and campaign_id = $2`, [gm, tid])).rows[0].seen_at).getFullYear() > 2020);
});

await as(p1, "ana@mesa.com", async () => {
  const steal = await fails(() => db.query(`select * from public.claim_room_host($1, 'aba-ana', true)`, [tid]));
  ok("a player can't host the table", !!steal, steal?.slice(0, 60));
  const pub = await fails(() => db.query(`select public.publish_room($1, 'aba-2', '[]')`, [tid]));
  ok("a player can't publish views", !!pub, pub?.slice(0, 60));
  const pend = await fails(() => db.query(`select * from public.pending_room_intents($1)`, [tid]));
  ok("a player can't read the pending intents", !!pend, pend?.slice(0, 60));
  ok("players never read the full state", (await db.query(`select state from public.room_states`)).rows.length === 0);
  const views = (await db.query(`select view from public.room_views`)).rows;
  ok("a player reads only her own view", views.length === 1 && views[0].view.me === "ana", JSON.stringify(views));
  const forge = await fails(async () => {
    const r = await db.query(`update public.room_views set view = '{"me": "hacked"}' where user_id = $1 returning user_id`, [p1]);
    if (r.rows.length === 0) throw new Error("no rows updated (RLS)");
  });
  ok("a player can't write views (not even her own)", !!forge, forge?.slice(0, 60));
  const forgeInsert = await fails(() => db.query(`insert into public.room_views (campaign_id, user_id, view) values ($1, $2, '{}')`, [tid, p2]));
  ok("a player can't write someone else's view", !!forgeInsert, forgeInsert?.slice(0, 60));
  ok("members read the players' map", (await db.query(`select map from public.room_view_maps where campaign_id = $1`, [tid])).rows[0]?.map.name === "Rio");
  await db.query(`insert into public.room_intents (campaign_id, intent) values ($1, '{"kind": "move", "tokenId": "t", "x": 1, "y": 1}')`, [tid]);
  ok("a player sends intents as herself", (await db.query(`select user_id from public.room_intents`)).rows.every((r) => r.user_id === p1));
  const spoof = await fails(() => db.query(`insert into public.room_intents (campaign_id, user_id, intent) values ($1, $2, '{"kind": "chat", "text": "fui eu"}')`, [tid, p2]));
  ok("…and never as someone else", !!spoof, spoof?.slice(0, 60));
  const huge = await fails(() => db.query(`insert into public.room_intents (campaign_id, intent) values ($1, $2)`, [tid, { kind: "chat", text: "x".repeat(25000) }]));
  ok("oversized intents are refused", !!huge, huge?.slice(0, 60));
  const host = await fails(() => db.query(`insert into public.room_presence (campaign_id, user_id, hosting) values ($1, $2, true)`, [tid, p1]));
  ok("a player can't claim to host in presence", !!host, host?.slice(0, 60));
  await db.query(`insert into public.room_presence (campaign_id, user_id) values ($1, $2)`, [tid, p1]);
  ok("members see who is at the table", (await db.query(`select user_id from public.room_presence where campaign_id = $1`, [tid])).rows.length === 2);
  await db.query(`delete from public.room_intents`);
  ok("a player can't clear intents", (await db.query(`select id from public.room_intents`)).rows.length === 1);
});

await as(p2, "bia@mesa.com", async () => {
  ok("another player doesn't see her intents", (await db.query(`select id from public.room_intents where campaign_id = $1`, [tid])).rows.length === 0);
  ok("…and reads only her own view", (await db.query(`select view from public.room_views`)).rows.map((r) => r.view.me).join() === "bia");
});

await as(gm, "mestre@mesa.com", async () => {
  ok("the GM reads the full state and every intent", (await db.query(`select state from public.room_states where campaign_id = $1`, [tid])).rows[0].state.secret === "emboscada no rio" && (await db.query(`select id from public.room_intents where campaign_id = $1`, [tid])).rows.length === 1);
  await db.exec(`reset role`);
  await db.query(`insert into public.room_intents (campaign_id, user_id, intent, created_at) values ($1, $2, '{"kind": "chat", "text": "velho"}', now() - interval '5 minutes')`, [tid, p1]);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [gm]);
  await db.exec(`set role authenticated`);
  const pending = (await db.query(`select intent from public.pending_room_intents($1)`, [tid])).rows;
  ok("pending intents: fresh ones only, stale ones dropped", pending.length === 1 && pending[0].intent.kind === "move" && (await db.query(`select id from public.room_intents where campaign_id = $1`, [tid])).rows.length === 1);
  await db.query(`delete from public.room_intents where campaign_id = $1`, [tid]);
  ok("the host clears handled intents", (await db.query(`select id from public.room_intents where campaign_id = $1`, [tid])).rows.length === 0);
  await db.query(`delete from public.campaign_members where campaign_id = $1 and user_id = $2`, [tid, p1]);
  ok("leaving the campaign leaves the table (presence and view)", (await db.query(`select 1 from public.room_presence where campaign_id = $1 and user_id = $2 union all select 1 from public.room_views where campaign_id = $1 and user_id = $2`, [tid, p1])).rows.length === 0);
  await db.query(`select public.release_room_host($1, 'aba-1')`, [tid]);
  ok("releasing someone else's tab does nothing", (await db.query(`select host_client from public.room_states where campaign_id = $1`, [tid])).rows[0].host_client === "aba-2");
  await db.query(`select public.release_room_host($1, 'aba-2')`, [tid]);
  ok("the host releases the table when it leaves", (await db.query(`select host_client from public.room_states where campaign_id = $1`, [tid])).rows[0].host_client === null);
});

await as(out, "fora@mesa.com", async () => {
  ok("outsiders see nothing of the table", (await db.query(`select 1 from public.room_views union all select 1 from public.room_view_maps union all select 1 from public.room_presence union all select 1 from public.room_states`)).rows.length === 0);
  const send = await fails(() => db.query(`insert into public.room_intents (campaign_id, intent) values ($1, '{"kind": "chat", "text": "oi"}')`, [tid]));
  ok("outsiders can't send intents", !!send, send?.slice(0, 60));
});

// ---------- Sessions: marking one as played ----------
// "Encerrar sessão" at the table: the GM marks the scheduled session as completed.
const sid = await as(gm, "mestre@mesa.com", async () => {
  const id = (await db.query(`insert into public.game_sessions (campaign_id, number, title, scheduled_at) values ($1, 1, 'A Ponte', now()) returning id`, [tid])).rows[0].id;
  ok("the GM schedules a session", !!id);
  return id;
});
const sessionStatus = async () => {
  await db.exec(`reset role`);
  return (await db.query(`select status from public.game_sessions where id = $1`, [sid])).rows[0].status;
};
const completeAs = async (id, email) => {
  const err = await fails(async () => {
    const r = await as(id, email, () => db.query(`update public.game_sessions set status = 'completed' where id = $1 returning id`, [sid]));
    if (r.rows.length === 0) throw new Error("no rows updated (RLS)");
  });
  return { err, status: await sessionStatus() };
};
{
  const r = await completeAs(p2, "bia@mesa.com");
  ok("a player can't mark the session as played", !!r.err && r.status === "scheduled", r.err?.slice(0, 60));
}
{
  const r = await completeAs(out, "fora@mesa.com");
  ok("an outsider can't mark the session as played", !!r.err && r.status === "scheduled", r.err?.slice(0, 60));
}
await as(p2, "bia@mesa.com", async () => {
  ok("players see the campaign's sessions", (await db.query(`select id from public.game_sessions where id = $1`, [sid])).rows.length === 1);
  const add = await fails(() => db.query(`insert into public.game_sessions (campaign_id, number, title, scheduled_at) values ($1, 2, 'falsa', now())`, [tid]));
  ok("players can't schedule sessions", !!add, add?.slice(0, 60));
});
{
  const r = await completeAs(gm, "mestre@mesa.com");
  ok("the GM marks the session as played", !r.err && r.status === "completed", r.err?.slice(0, 60));
}
await db.exec(`reset role`);
const spyCampaign = (await db.query(`select id from public.campaigns where owner_id = $1`, [out])).rows[0].id;
await as(gm, "mestre@mesa.com", async () => {
  const moved = await fails(() => db.query(`update public.game_sessions set campaign_id = $2 where id = $1`, [sid, spyCampaign]));
  ok("a GM can't move a session into someone else's campaign", !!moved, moved?.slice(0, 60));
});

// ---------- Chronicles Studio ----------
const episode = await as(gm, "mestre@mesa.com", async () => {
  const id = (await db.query(`insert into public.chronicle_episodes (campaign_id, title, script, created_by) values ($1, 'A Ponte', '{"scenes": []}', $2) returning id`, [tid, gm])).rows[0].id;
  ok("the GM saves an episode", !!id);
  return id;
});
await as(p2, "bia@mesa.com", async () => {
  ok("players don't see episodes (secrets of the GM's cut)", (await db.query(`select id from public.chronicle_episodes`)).rows.length === 0);
  const write = await fails(() => db.query(`insert into public.chronicle_episodes (campaign_id, title) values ($1, 'falso')`, [tid]));
  ok("players can't create episodes", !!write, write?.slice(0, 60));
});
await as(out, "fora@mesa.com", async () => {
  await db.query(`delete from public.chronicle_episodes where id = $1`, [episode]);
});
await as(gm, "mestre@mesa.com", async () => {
  ok("outsiders can't delete episodes", (await db.query(`select id from public.chronicle_episodes where id = $1`, [episode])).rows.length === 1);
  const forged = await fails(() => db.query(`insert into public.chronicle_episodes (campaign_id, title, created_by) values ($1, 'falso', $2)`, [tid, p2]));
  ok("an episode's author is whoever creates it", !!forged, forged?.slice(0, 60));
  let allowed = 0;
  for (let i = 0; i < 22; i++) if ((await db.query(`select public.spend_chronicle_quota($1, 'script') as ok`, [tid])).rows[0].ok) allowed++;
  ok("the AI allowance stops at 20 scripts a day", allowed === 20, String(allowed));
});
await as(out, "fora@mesa.com", async () => {
  const spend = await fails(() => db.query(`select public.spend_chronicle_quota($1, 'image')`, [tid]));
  ok("only the campaign's GMs spend its AI allowance", !!spend, spend?.slice(0, 60));
});

// Sharing: a published episode (and the files it uses) is visible to the campaign's players, read-only.
const file = (ep, name) => `${tid}/${ep}/${name}`;
const draft = await as(gm, "mestre@mesa.com", async () => {
  const id = (await db.query(`insert into public.chronicle_episodes (campaign_id, title, images, created_by) values ($1, 'Rascunho', jsonb_build_object('sc', $1 || '/rascunho/sc.png'), $2) returning id`, [tid, gm])).rows[0].id;
  await db.query(`update public.chronicle_episodes set images = jsonb_build_object('sc1', $2::text), voices = jsonb_build_object('sc1', jsonb_build_object('ref', $3::text, 'text', 'Era uma vez', 'seconds', 2)), published_at = now() where id = $1`, [episode, file(episode, "sc1.png"), file(episode, "voice_sc1.wav")]);
  let voiced = 0;
  for (let i = 0; i < 202; i++) if ((await db.query(`select public.spend_chronicle_quota($1, 'voice') as ok`, [tid])).rows[0].ok) voiced++;
  ok("the narration allowance stops at 200 clips a day", voiced === 200, String(voiced));
  return id;
});
await as(p2, "bia@mesa.com", async () => {
  const seen = (await db.query(`select id from public.chronicle_episodes`)).rows.map((r) => r.id);
  ok("players see the episodes the GM shared, and only those", seen.length === 1 && seen[0] === episode, seen.join(","));
  const see = async (path) => (await db.query(`select public.can_see_chronicle_file($1) as ok`, [path])).rows[0].ok;
  ok("players see the images and narration of a shared episode", (await see(file(episode, "sc1.png"))) && (await see(file(episode, "voice_sc1.wav"))));
  ok("players can't fetch files of an unshared episode", (await see(`${tid}/rascunho/sc.png`)) === false);
  ok("players can't fetch other files of the campaign's folder", (await see(file(episode, "char_isolde.png"))) === false);
  await db.query(`update public.chronicle_episodes set published_at = null, title = 'Hackeado' where id = $1`, [episode]);
  await db.query(`update public.chronicle_episodes set published_at = now() where id = $1`, [draft]);
});
await as(gm, "mestre@mesa.com", async () => {
  const rows = (await db.query(`select id, title, published_at from public.chronicle_episodes where id in ($1, $2)`, [episode, draft])).rows;
  const shared = rows.find((r) => r.id === episode);
  ok("players can't unshare, edit or share episodes", !!shared?.published_at && shared.title === "A Ponte" && !rows.find((r) => r.id === draft)?.published_at);
  ok("GMs see every file of their campaign", (await db.query(`select public.can_see_chronicle_file($1) as ok`, [`${tid}/rascunho/sc.png`])).rows[0].ok === true);
});
await as(out, "fora@mesa.com", async () => {
  ok("outsiders see no shared episodes", (await db.query(`select id from public.chronicle_episodes`)).rows.length === 0);
  ok("outsiders can't fetch a shared episode's files", (await db.query(`select public.can_see_chronicle_file($1) as ok`, [file(episode, "sc1.png")])).rows[0].ok === false);
});

// ---------- Audio library ----------
await as(gm, "mestre@mesa.com", async () => {
  await db.query(`insert into public.campaign_audio_tracks (campaign_id, title, path, mime_type) values ($1, 'Tema da taverna', $1 || '/a.mp3', 'audio/mpeg')`, [tid]);
  const outside = await fails(() => db.query(`insert into public.campaign_audio_tracks (campaign_id, title, path, mime_type) values ($1, 'Fora da pasta', 'outra-campanha/a.mp3', 'audio/mpeg')`, [tid]));
  ok("a track's file must be in its campaign's folder", !!outside, outside?.slice(0, 60));
  // The players' map shows one picture; another one is still being prepared.
  await db.query(`update public.room_view_maps set map = jsonb_set(map, '{background}', jsonb_build_object('imageId', $1 || '/shown.png')) where campaign_id = $1`, [tid]);
  ok("GMs see every map picture", (await db.query(`select public.can_see_map_image($1 || '/secret.png') as ok`, [tid])).rows[0].ok === true);
});
await as(p2, "bia@mesa.com", async () => {
  const see = async (name) => (await db.query(`select public.can_see_map_image($1 || '/' || $2) as ok`, [tid, name])).rows[0].ok;
  ok("players see the picture of the map on the table", (await see("shown.png")) === true);
  ok("players can't fetch a map picture the GM hasn't shown", (await see("secret.png")) === false);
});
await as(out, "fora@mesa.com", async () => {
  ok("outsiders see no map pictures", (await db.query(`select public.can_see_map_image($1 || '/shown.png') as ok`, [tid])).rows[0].ok === false);
});
await as(p2, "bia@mesa.com", async () => {
  ok("players see the campaign's tracks (to play along)", (await db.query(`select title from public.campaign_audio_tracks where campaign_id = $1`, [tid])).rows.length === 1);
  const add = await fails(() => db.query(`insert into public.campaign_audio_tracks (campaign_id, title, path, mime_type) values ($1, 'minha', $1 || '/b.mp3', 'audio/mpeg')`, [tid]));
  ok("players can't add tracks", !!add, add?.slice(0, 60));
});
await as(out, "fora@mesa.com", async () => {
  ok("outsiders see no tracks", (await db.query(`select id from public.campaign_audio_tracks`)).rows.length === 0);
});

// Voice chat: only members of a campaign may join its signalling channel.
const voice = async (topic) => {
  await db.query(`select set_config('realtime.topic', $1, false)`, [topic]);
  const send = await fails(() => db.query(`insert into realtime.messages (topic, extension, payload) values ($1, 'broadcast', '{}')`, [topic]));
  const heard = (await db.query(`select id from realtime.messages where topic = $1`, [topic])).rows.length;
  return { sent: !send, heard };
};
await as(gm, "mestre@mesa.com", async () => {
  const v = await voice(`voice:${tid}`);
  ok("GM joins the campaign's voice channel", v.sent && v.heard === 1);
});
await as(p2, "bia@mesa.com", async () => {
  const v = await voice(`voice:${tid}`);
  ok("members talk and hear on the voice channel", v.sent && v.heard === 2);
  const other = await voice(`room:${tid}`);
  ok("the voice policies open no other channel", !other.sent && other.heard === 0);
});
await as(out, "fora@mesa.com", async () => {
  const v = await voice(`voice:${tid}`);
  ok("outsiders can't send on or listen to the voice channel", !v.sent && v.heard === 0);
});
await db.exec(`reset role`);
await db.query(`select set_config('realtime.topic', '', false)`);

// Launch: plans, AI credits, the free-plan campaign limit and account deletion.
{
  const solo = await user("solo@mesa.com", "Solo");
  const newCampaign = (owner) => db.query(`insert into public.campaigns (name, system_id, visual_style_id, owner_id) values ('Solo', 'dnd5e', 'ember', $1) returning id`, [owner]);
  // Billing off (default): everyone has the paid allowances, no campaign limit.
  const plan0 = await as(solo, "solo@mesa.com", async () => (await db.query(`select public.my_plan() as p`)).rows[0].p);
  ok("before billing is on, everyone counts as Mestre", plan0 === "mestre");
  const firstCampaign = await as(solo, "solo@mesa.com", async () => (await newCampaign(solo)).rows[0].id);
  ok("before billing is on, a second campaign is fine", !(await as(solo, "solo@mesa.com", () => fails(() => newCampaign(solo)))));
  await db.exec(`update public.billing_config set enforce = true`);
  const plan1 = await as(solo, "solo@mesa.com", async () => (await db.query(`select public.my_plan() as p`)).rows[0].p);
  ok("with billing on, no subscription means free", plan1 === "free");
  const limited = await as(solo, "solo@mesa.com", () => fails(() => newCampaign(solo)));
  ok("free plan: no new campaign while one is under way", !!limited && limited.includes("plano grátis"), limited?.slice(0, 50));
  // Users can't give themselves a plan or credits.
  const selfPlan = await as(solo, "solo@mesa.com", () => fails(() => db.query(`insert into public.subscriptions (user_id, plan) values ($1, 'mesa')`, [solo])));
  const selfCredits = await as(solo, "solo@mesa.com", () => fails(() => db.query(`insert into public.ai_credits (user_id, balance) values ($1, 999)`, [solo])));
  ok("users can't write their own plan or credits", !!selfPlan && !!selfCredits);
  // Free allowance: 3 scripts a day, then credits (5 each), then no.
  const spend = () => as(solo, "solo@mesa.com", async () => (await db.query(`select public.spend_chronicle_quota($1, 'script') as ok`, [firstCampaign])).rows[0].ok);
  const free3 = [await spend(), await spend(), await spend()];
  ok("free plan: 3 scripts a day", free3.every(Boolean) && !(await spend()));
  await db.query(`insert into public.ai_credits (user_id, balance) values ($1, 7)`, [solo]);
  ok("over the allowance, credits pay (5 a script)", (await spend()) === true && !(await spend()));
  const left = (await db.query(`select balance from public.ai_credits where user_id = $1`, [solo])).rows[0].balance;
  ok("credits are spent once", left === 2, String(left));
  // A paid plan lifts the limit.
  await db.query(`insert into public.subscriptions (user_id, plan, status, current_period_end) values ($1, 'mestre', 'active', now() + interval '30 days')`, [solo]);
  const billing = await as(solo, "solo@mesa.com", async () => (await db.query(`select public.my_billing() as b`)).rows[0].b);
  ok("my_billing shows plan, credits and today's use", billing.plan === "mestre" && billing.credits === 2 && billing.usedToday.script === 4, JSON.stringify(billing));
  ok("Mestre plan: more campaigns", !(await as(solo, "solo@mesa.com", () => fails(() => newCampaign(solo)))));
  const otherSees = await as(p1, "ana@mesa.com", async () => (await db.query(`select count(*)::int as n from public.subscriptions`)).rows[0].n);
  ok("subscriptions are private", otherSees === 0);
  await db.exec(`update public.billing_config set enforce = false`);
  // Deleting the account takes the user's campaigns, characters, plan and login with it.
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role anon`);
  const anon = await fails(() => db.query(`select public.delete_my_account()`));
  await db.exec(`reset role`);
  ok("deleting needs a signed-in user", !!anon, anon?.slice(0, 50));
  const stillThere = (await db.query(`select count(*)::int as n from public.profiles where id = $1`, [solo])).rows[0].n;
  ok("a failed delete leaves the account alone", stillThere === 1);
  await as(solo, "solo@mesa.com", () => db.query(`select public.delete_my_account()`));
  const gone = (await db.query(`select (select count(*) from public.profiles where id = $1)::int + (select count(*) from public.campaigns where owner_id = $1)::int + (select count(*) from public.subscriptions where user_id = $1)::int + (select count(*) from auth.users where id = $1::uuid)::int as n`, [solo])).rows[0].n;
  ok("account deletion removes profile, campaigns, plan and login", gone === 0, String(gone));
}

// Signed out: nothing.
await db.exec(`reset role`);
await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
await db.exec(`set role anon`);
const anonPreview = await fails(() => db.query(`select * from public.invite_preview('x')`));
ok("signed out: invite functions are closed", !!anonPreview, anonPreview?.slice(0, 60));
await db.exec(`reset role`);

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed`);
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
