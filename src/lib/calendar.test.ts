import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFor, sessionEvent } from "./calendar";

const session = { id: "s1", number: 4, title: "Quem paga a conta; e por quê", scheduledAt: "2026-11-17T21:00:00-03:00", durationMinutes: 210 };

describe("calendar", () => {
  it("builds the event in UTC with the session's length", () => {
    const e = sessionEvent(session, "Lâmina Fria", "https://rq.app/campaign/c1");
    expect(e.start.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-18T03:30:00.000Z");
    expect(e.title).toBe("Lâmina Fria · Sessão 4: Quem paga a conta; e por quê");
  });

  it("writes a valid .ics with escaped text, CRLF lines and a 1-hour alarm", () => {
    const ics = icsFor(sessionEvent(session, "Lâmina Fria"), new Date("2026-11-12T10:00:00Z"));
    expect(ics).toContain("\r\nDTSTART:20261118T000000Z\r\n");
    expect(ics).toContain("SUMMARY:Lâmina Fria · Sessão 4: Quem paga a conta\\; e por quê");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("links to Google Calendar with the same times", () => {
    const url = new URL(googleCalendarUrl(sessionEvent(session, "Lâmina Fria")));
    expect(url.searchParams.get("dates")).toBe("20261118T000000Z/20261118T033000Z");
  });
});
