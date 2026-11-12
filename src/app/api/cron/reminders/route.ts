import { reportServerError } from "@/server/errors";
import { reminderEmail, sendEmail } from "@/server/reminders";
import { serviceClient } from "@/server/supabase";

/**
 * Hourly job (vercel.json → crons): e-mails every member of a campaign about
 * a session starting in the next 23–25 hours, once per person and session.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  const db = serviceClient();
  if (!db || !process.env.RESEND_API_KEY || !process.env.REMINDER_FROM) return Response.json({ skipped: "Lembretes não configurados (service role, RESEND_API_KEY, REMINDER_FROM)." });

  const now = Date.now();
  const from = new Date(now + 23 * 3600_000).toISOString();
  const to = new Date(now + 25 * 3600_000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const { data: sessions, error } = await db
      .from("game_sessions")
      .select("id, number, title, scheduled_at, duration_minutes, campaign_id, campaigns(name, campaign_members(user_id, profiles(id, display_name, email, timezone, email_reminders)))")
      .eq("status", "scheduled")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to);
    if (error) throw new Error(error.message);

    let sent = 0;
    for (const s of (sessions ?? []) as unknown as SessionRow[]) {
      const { data: done } = await db.from("session_reminders").select("user_id").eq("session_id", s.id);
      const already = new Set(((done ?? []) as { user_id: string }[]).map((r) => r.user_id));
      for (const m of s.campaigns?.campaign_members ?? []) {
        const p = m.profiles;
        if (!p?.email || !p.email_reminders || already.has(p.id)) continue;
        const mail = reminderEmail({
          name: p.display_name,
          campaignName: s.campaigns!.name,
          campaignId: s.campaign_id,
          session: { id: s.id, number: s.number, title: s.title, scheduledAt: s.scheduled_at, durationMinutes: s.duration_minutes },
          timezone: p.timezone || "America/Sao_Paulo",
          appUrl,
        });
        if (await sendEmail(p.email, mail)) {
          await db.from("session_reminders").insert({ session_id: s.id, user_id: p.id });
          sent += 1;
        }
      }
    }
    return Response.json({ sessions: sessions?.length ?? 0, sent });
  } catch (error) {
    await reportServerError(error, { where: "cron reminders" });
    return Response.json({ error: "Falha ao enviar lembretes." }, { status: 500 });
  }
}

interface SessionRow {
  id: string;
  number: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  campaign_id: string;
  campaigns: { name: string; campaign_members: { user_id: string; profiles: { id: string; display_name: string; email: string; timezone: string; email_reminders: boolean } | null }[] } | null;
}
