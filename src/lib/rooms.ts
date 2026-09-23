import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ResponseRow = Tables<"responses">;

const PAGE_SIZE = 1000;

/** Every response for the given moments, paging past the API's 1000-row cap. */
export async function fetchResponses(activityIds: string[]): Promise<ResponseRow[]> {
  if (activityIds.length === 0) return [];
  const rows: ResponseRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("responses")
      .select("*")
      .in("activity_id", activityIds)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * A fresh realtime topic for each subscription. supabase.channel() hands back the existing
 * channel for a topic, and one that is still leaving silently ignores a new subscribe.
 */
export function uniqueTopic(base: string) {
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Live moments first by spotlight, then most recently launched. */
export function sortLiveMoments<T extends { id: string; updated_at: string }>(
  moments: T[],
  spotlightId: string | null,
): T[] {
  return [...moments].sort((a, b) => {
    if (a.id === spotlightId) return -1;
    if (b.id === spotlightId) return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export type StoredPlayer = { id: string; nickname: string };

function storageKeys(sessionId: string) {
  return { id: `gj-participant-${sessionId}`, nickname: `gj-nick-${sessionId}` };
}

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function readStoredPlayer(sessionId: string): StoredPlayer | null {
  const keys = storageKeys(sessionId);
  const id = safely(() => sessionStorage.getItem(keys.id) || localStorage.getItem(keys.id), null);
  if (!id) return null;
  const nickname = safely(
    () => sessionStorage.getItem(keys.nickname) || localStorage.getItem(keys.nickname) || "",
    "",
  );
  return { id, nickname };
}

export function rememberPlayer(sessionId: string, player: StoredPlayer) {
  const keys = storageKeys(sessionId);
  for (const store of [sessionStorage, localStorage]) {
    safely(() => {
      store.setItem(keys.id, player.id);
      store.setItem(keys.nickname, player.nickname);
    }, undefined);
  }
}

export function forgetPlayer(sessionId: string) {
  const keys = storageKeys(sessionId);
  for (const store of [sessionStorage, localStorage]) {
    safely(() => {
      store.removeItem(keys.id);
      store.removeItem(keys.nickname);
    }, undefined);
  }
}

/** The stored player for this room, if the host hasn't removed them. */
export async function verifyStoredPlayer(sessionId: string): Promise<StoredPlayer | null> {
  const stored = readStoredPlayer(sessionId);
  if (!stored) return null;
  const { data } = await supabase
    .from("participants")
    .select("id,nickname")
    .eq("id", stored.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!data) {
    forgetPlayer(sessionId);
    return null;
  }
  return data;
}

/** Plain-language message for a failed audience write. */
export function friendlyWriteError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "Your response is already in.";
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return "This moment has closed. Watch for the next one.";
  }
  return error.message;
}
