import "server-only";
import { icsFor, sessionEvent } from "@/lib/calendar";

/** The e-mail a member gets the day before a session (plain HTML, no images, with the .ics attached). */
export function reminderEmail(input: { name: string; campaignName: string; campaignId: string; session: { id: string; number: number; title: string; scheduledAt: string; durationMinutes: number }; timezone: string; appUrl: string }) {
  const when = new Date(input.session.scheduledAt).toLocaleString("pt-BR", { timeZone: input.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const url = `${input.appUrl}/campaign/${input.campaignId}`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const subject = `Amanhã: ${input.campaignName} · Sessão ${input.session.number}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1726">
<p>Olá, ${esc(input.name)}!</p>
<p>A próxima sessão de <strong>${esc(input.campaignName)}</strong> é <strong>${esc(when)}</strong>:<br>#${input.session.number} · ${esc(input.session.title)}</p>
<p><a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir a campanha</a></p>
<p style="color:#6b6680;font-size:12px">Você recebe este lembrete porque participa da campanha. Para parar, desligue "Lembretes de sessão por e-mail" em ${esc(input.appUrl)}/settings.</p>
</div>`;
  const ics = icsFor(sessionEvent(input.session, input.campaignName, url));
  return { subject, html, ics };
}

/** Sends through Resend's HTTP API (RESEND_API_KEY, REMINDER_FROM). False when not configured or refused. */
export async function sendEmail(to: string, mail: { subject: string; html: string; ics?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.ics && { attachments: [{ filename: "sessao.ics", content: Buffer.from(mail.ics).toString("base64") }] }),
    }),
  });
  return res.ok;
}
