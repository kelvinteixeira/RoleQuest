/**
 * SHA-256 hex digest via Web Crypto. Used only by the local mock auth so that
 * plaintext passwords are not kept in localStorage. Not a real security boundary.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
