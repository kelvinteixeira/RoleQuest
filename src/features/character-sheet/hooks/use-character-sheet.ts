"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { characterService, type EditableCharacter } from "@/services/character.service";
import type { Character, CharacterSheet } from "@/types/character";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
type Identity = Pick<Character, "name" | "concept" | "level" | "portraitColor">;

const SAVE_DELAY_MS = 700;

/**
 * Loads a character for editing and autosaves changes (debounced).
 * Local edits live on top of the loaded copy; the service is the source of truth.
 */
export function useCharacterSheet(characterId: string) {
  const user = useCurrentUser();
  const loaded = useAsync(() => characterService.get(characterId, user), [characterId, user.id]);
  const [edited, setEdited] = useState<EditableCharacter | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<{ identity?: Partial<Identity>; sheet?: CharacterSheet }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edits only apply to the character they were made on.
  const data = edited && edited.character.id === characterId ? edited : (loaded.data ?? null);

  const flush = useCallback(async () => {
    const changes = pending.current;
    pending.current = {};
    if (!changes.identity && !changes.sheet) return;
    setStatus("saving");
    try {
      await characterService.save(characterId, { ...changes.identity, sheet: changes.sheet }, user);
      setStatus("saved");
      setSaveError(null);
    } catch (e) {
      setStatus("error");
      setSaveError(toUserMessage(e));
    }
  }, [characterId, user]);

  // Save whatever is pending when leaving the page.
  useEffect(() => () => void flush(), [flush]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [flush]);

  const updateSheet = useCallback(
    (fn: (sheet: CharacterSheet) => CharacterSheet) => {
      if (!data) return;
      const sheet = fn(data.character.sheet);
      pending.current.sheet = sheet;
      setEdited({ ...data, character: { ...data.character, sheet } });
      schedule();
    },
    [data, schedule],
  );

  /**
   * Applies a change saved elsewhere (the room writes HP back to the sheet):
   * updates the local copy and any unsaved draft, without scheduling a save.
   */
  const patchLocal = useCallback(
    (fn: (sheet: CharacterSheet) => CharacterSheet) => {
      if (!data) return;
      if (pending.current.sheet) pending.current.sheet = fn(pending.current.sheet);
      setEdited({ ...data, character: { ...data.character, sheet: fn(data.character.sheet) } });
    },
    [data],
  );

  const updateIdentity = useCallback(
    (patch: Partial<Identity>) => {
      if (!data) return;
      pending.current.identity = { ...pending.current.identity, ...patch };
      setEdited({ ...data, character: { ...data.character, ...patch } });
      schedule();
    },
    [data, schedule],
  );

  return { data, error: loaded.error, reload: loaded.reload, status, saveError, updateSheet, updateIdentity, patchLocal, flush };
}
