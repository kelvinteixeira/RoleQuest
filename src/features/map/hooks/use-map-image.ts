"use client";

import { useEffect, useState } from "react";
import { mapImageService } from "@/services/map-image.service";

/** Object URL of a stored map picture; undefined while loading, null when missing. */
export function useMapImage(imageId: string | undefined): string | null | undefined {
  const [state, setState] = useState<{ id?: string; url: string | null | undefined }>({ url: undefined });
  useEffect(() => {
    if (!imageId) return;
    let alive = true;
    void mapImageService.url(imageId).then((url) => alive && setState({ id: imageId, url }));
    return () => {
      alive = false;
    };
  }, [imageId]);
  if (!imageId) return null;
  return state.id === imageId ? state.url : undefined;
}
