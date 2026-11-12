import "server-only";

/**
 * Error reporting without a third-party SDK: every error goes to the server
 * log as one JSON line (Vercel and most hosts keep these searchable), and,
 * when ERROR_WEBHOOK_URL is set, to a chat channel (Discord or Slack
 * incoming webhook). The same error is sent at most once every 10 minutes.
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  source: "server" | "client";
  where?: string;
  url?: string;
  digest?: string;
  [key: string]: unknown;
}

const RECENT_MS = 10 * 60 * 1000;
const recent = new Map<string, number>();

function seenRecently(key: string): boolean {
  const now = Date.now();
  for (const [k, at] of recent) if (now - at > RECENT_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

export async function report(entry: ErrorReport): Promise<void> {
  const line = { level: "error", at: new Date().toISOString(), ...entry, stack: entry.stack?.slice(0, 4000) };
  console.error(JSON.stringify(line));

  const hook = process.env.ERROR_WEBHOOK_URL;
  if (!hook || seenRecently(`${entry.source}:${entry.where ?? ""}:${entry.message}`)) return;
  const text = `**Role Quest · erro (${entry.source}${entry.where ? ` · ${entry.where}` : ""})**\n${entry.message.slice(0, 500)}${entry.url ? `\n${entry.url}` : ""}`;
  try {
    // Discord reads `content`, Slack reads `text`.
    await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text, text }) });
  } catch {
    // The log line above is enough when the chat is down.
  }
}

export function reportServerError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  return report({ message: err.message, stack: err.stack, source: "server", ...context });
}
