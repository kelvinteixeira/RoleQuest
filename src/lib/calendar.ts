/**
 * A game session as a calendar event: an .ics file (Apple, Outlook, any
 * calendar) or a Google Calendar link. Times go out in UTC, so every
 * calendar shows them in the reader's own time zone.
 */
import type { GameSession } from "@/types/campaign";

export interface SessionEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  url?: string;
}

export function sessionEvent(session: Pick<GameSession, "id" | "number" | "title" | "scheduledAt" | "durationMinutes">, campaignName: string, url?: string): SessionEvent {
  const start = new Date(session.scheduledAt);
  return {
    uid: `${session.id}@rolequest`,
    title: `${campaignName} · Sessão ${session.number}: ${session.title}`,
    start,
    end: new Date(start.getTime() + session.durationMinutes * 60_000),
    description: url ? `Mesa no Role Quest: ${url}` : "Mesa no Role Quest",
    url,
  };
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Commas, semicolons, backslashes and line breaks are escaped in .ics text. */
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function icsFor(event: SessionEvent, now = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Role Quest//Sessões//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.start)}`,
    `DTEND:${utc(event.end)}`,
    `SUMMARY:${text(event.title)}`,
    `DESCRIPTION:${text(event.description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function googleCalendarUrl(event: SessionEvent): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${utc(event.start)}/${utc(event.end)}`, details: event.description });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const icsDataUrl = (event: SessionEvent) => `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(event))}`;
