/**
 * WAV files: the soundtrack synthesised in the browser and the narration clips
 * (Gemini returns raw 16-bit PCM or WAV) are stored and played as WAV.
 */

/** Wraps 16-bit little-endian PCM samples in a WAV header. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  out.set(pcm, 44);
  return out;
}

/** Float samples (-1..1) to a 16-bit mono WAV. */
export function floatToWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const pcm = new Uint8Array(samples.length * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return pcmToWav(pcm, sampleRate, 1);
}

export const isWav = (bytes: Uint8Array) => bytes.byteLength >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WAVE";

/** Length of a PCM WAV file in seconds (0 when it isn't one). Walks the chunks, so extra chunks before `data` are fine. */
export function wavSeconds(bytes: Uint8Array): number {
  if (!isWav(bytes)) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let byteRate = 0;
  for (let at = 12; at + 8 <= bytes.byteLength; ) {
    const id = String.fromCharCode(...bytes.subarray(at, at + 4));
    const size = view.getUint32(at + 4, true);
    if (id === "fmt " && at + 20 <= bytes.byteLength) byteRate = view.getUint32(at + 16, true);
    if (id === "data") return byteRate ? Math.min(size, bytes.byteLength - at - 8) / byteRate : 0;
    at += 8 + size + (size % 2);
  }
  return 0;
}
