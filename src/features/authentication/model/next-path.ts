/**
 * Where to go after signing in, signing up and onboarding (`?next=`), so an
 * invite link opened while signed out still lands on the invite afterwards.
 */

/**
 * Only same-origin paths are accepted; anything else falls back. Control
 * characters and backslashes are refused outright: URL parsers drop tabs and
 * newlines and read "\\" as "/", so "/\t/evil.example" would leave the site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\u0000-\u001F\u007F\\]/.test(raw)) return fallback;
  try {
    const base = "https://role.quest.invalid";
    const url = new URL(raw, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

/** The safe `?next=` of the current URL, or null (client only). */
export function currentNext(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(raw, "") || null;
}

/** Where a signed-in, onboarded user goes: past a stale onboarding step to what came after it. */
export function afterOnboarding(next: string | null): string {
  const target = safeNextPath(next);
  if (!target.startsWith("/onboarding")) return target;
  return safeNextPath(new URL(target, "https://role.quest.invalid").searchParams.get("next"));
}

/** `path`, carrying `next` along when there is one. */
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
