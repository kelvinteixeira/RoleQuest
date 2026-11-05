import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/** One image to draw: a scene panel (16:9) or a character reference portrait (1:1). */
export const ImageRequestSchema = z.object({
  campaignId: z.string().min(1).max(80),
  prompt: z.string().min(1).max(3000),
  aspect: z.enum(["16:9", "1:1"]),
  /** Reference images (character portraits) so people look the same in every panel. */
  references: z
    .array(z.object({ mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().max(900_000) }))
    .max(4)
    .default([]),
});
export type ImageRequest = z.infer<typeof ImageRequestSchema>;

/** The image model; overridable without code changes. */
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

export class ImageRefusedError extends Error {}

/** Draws one image with Gemini and returns its bytes. */
export async function drawImage(req: ImageRequest): Promise<{ bytes: Buffer; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const interaction = await ai.interactions.create({
    model: MODEL,
    input: [
      { type: "text", text: req.prompt },
      ...req.references.map((r) => ({ type: "image" as const, mime_type: r.mimeType, data: r.data })),
    ],
    // Inline: the bytes come in the response (not a link to fetch later).
    response_format: { type: "image", aspect_ratio: req.aspect, image_size: "1K", delivery: "inline" },
  });
  const image = interaction.output_image;
  if (!image?.data) throw new ImageRefusedError("O gerador não devolveu imagem para este quadro. Ajuste a descrição e tente de novo.");
  return { bytes: Buffer.from(image.data, "base64"), mimeType: image.mime_type || "image/png" };
}
