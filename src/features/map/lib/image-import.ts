"use client";

/** Longest side kept when importing a map picture: sharp at table zoom, small enough for the browser's storage. */
export const MAX_IMAGE_SIDE = 2048;

/** Downscales (if needed) and re-encodes a picture the GM picked. */
export async function prepareMapImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (PNG, JPG ou WebP).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  } finally {
    bitmap.close();
  }
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  // Browsers without WebP encoding hand back a (much larger) PNG: use JPEG instead.
  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return { blob, width, height };
}
