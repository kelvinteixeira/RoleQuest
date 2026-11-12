import "server-only";
import { createHmac } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";

/**
 * Voice servers.
 * - TURN relays the audio for people behind strict networks. Credentials are
 *   short-lived and made per person: a coturn server with a shared secret
 *   (TURN_URLS + TURN_SECRET, the "TURN REST API"), or Cloudflare's TURN
 *   service (CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN).
 * - LiveKit (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) is a media
 *   server: every voice goes to it once and it forwards to the others, so large
 *   tables don't need a call between every pair of people.
 */

const STUN: RTCIceServer = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };
const TTL_SECONDS = 6 * 60 * 60;

export async function iceServersFor(userId: string): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [STUN];

  const urls = process.env.TURN_URLS?.split(",").map((u) => u.trim()).filter(Boolean);
  const secret = process.env.TURN_SECRET;
  if (urls?.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:${userId}`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    servers.push({ urls, username, credential });
  }

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (keyId && token) {
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
      });
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
        const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
        servers.push(...list);
      }
    } catch {
      // Without the relay most people still connect through STUN.
    }
  }
  return servers;
}

export const livekitConfigured = () => !!process.env.LIVEKIT_URL && !!process.env.LIVEKIT_API_KEY && !!process.env.LIVEKIT_API_SECRET;

/** A token to join the campaign's voice room on LiveKit (audio only, for a few hours). */
export async function livekitToken(campaignId: string, userId: string, name: string): Promise<{ url: string; token: string }> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: userId, name, ttl: TTL_SECONDS });
  at.addGrant({ room: `campaign-${campaignId}`, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });
  return { url: process.env.LIVEKIT_URL!, token: await at.toJwt() };
}
