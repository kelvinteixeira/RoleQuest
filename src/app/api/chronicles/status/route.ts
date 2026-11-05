import { connection } from "next/server";
import { aiRoutesEnabled } from "@/server/chronicles/auth";

/** GET: which AI services the studio can use (never the keys themselves). */
export async function GET() {
  await connection();
  const on = aiRoutesEnabled();
  return Response.json({ script: on && !!process.env.ANTHROPIC_API_KEY, images: on && !!process.env.GEMINI_API_KEY });
}
