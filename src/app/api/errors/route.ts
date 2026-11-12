import { report } from "@/server/errors";

const MAX_BYTES = 8_000;
const PER_MINUTE = 20;
const hits = new Map<string, { minute: number; count: number }>();

/** Errors from browsers (instrumentation-client.ts). Small, throttled per address, never echoed back. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const minute = Math.floor(Date.now() / 60_000);
  const seen = hits.get(ip);
  const count = seen && seen.minute === minute ? seen.count + 1 : 1;
  hits.set(ip, { minute, count });
  if (count > PER_MINUTE) return new Response(null, { status: 429 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).slice(0, max) : undefined);
  const message = str("message", 500);
  if (!message) return new Response(null, { status: 400 });
  await report({ message, stack: str("stack", 4000), source: "client", url: str("url", 300), where: str("where", 80), userAgent: request.headers.get("user-agent")?.slice(0, 200) });
  return new Response(null, { status: 204 });
}
