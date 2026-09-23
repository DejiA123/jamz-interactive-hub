import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const HOST_PASSCODE = "VIRTUALKEYS";
const AUTH_KEY = "gj_host_passcode_auth";
const PASSCODE_KEY = "gj_host_passcode";

export function isHostAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(AUTH_KEY) === "true" || localStorage.getItem(AUTH_KEY) === "true";
}

export function verifyAndSetHostPasscode(passcode: string): boolean {
  if (typeof window === "undefined") return false;
  const clean = passcode.trim().toUpperCase();
  if (clean === HOST_PASSCODE) {
    sessionStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(AUTH_KEY, "true");
    rememberHostPasscode(clean);
    return true;
  }
  return false;
}

/**
 * The passcode typed in this tab, sent to the database for host-only changes such as
 * removing players. Kept for the tab session only, never in long-lived storage.
 */
export function getHostPasscode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PASSCODE_KEY);
}

export function rememberHostPasscode(passcode: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PASSCODE_KEY, passcode.trim().toUpperCase());
}

export function forgetHostPasscode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PASSCODE_KEY);
}

export function lockHostStudio(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
  forgetHostPasscode();
}

// Local BroadcastChannel for instant zero-latency cross-tab updates
let localChannel: BroadcastChannel | null = null;
function getLocalChannel() {
  if (typeof window !== "undefined" && !localChannel && "BroadcastChannel" in window) {
    try {
      localChannel = new BroadcastChannel("gj-live-sync");
    } catch {
      localChannel = null;
    }
  }
  return localChannel;
}

export type LiveSyncPayload = {
  type: "ACTIVITY_LAUNCHED" | "ROOM_CLOSED" | "NEW_RESPONSE" | "SESSION_UPDATED";
  sessionId?: string;
  activityId?: string | null;
  joinCode?: string;
  timestamp: number;
};

export function broadcastLiveSync(payload: Omit<LiveSyncPayload, "timestamp">) {
  const message: LiveSyncPayload = {
    ...payload,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel (immediate cross-tab/window on same device)
  try {
    const ch = getLocalChannel();
    ch?.postMessage(message);
  } catch {
    // ignore
  }

  // 2. Storage event fallback for older contexts
  try {
    localStorage.setItem("gj_live_ping", JSON.stringify(message));
  } catch {
    // ignore
  }

  // 3. Supabase Realtime broadcast (cross-device)
  try {
    const channel = supabase.channel("gj-live-broadcast");
    channel.send({
      type: "broadcast",
      event: "live_sync",
      payload: message,
    });
  } catch {
    // ignore
  }
}

// supabase.channel() returns the same instance for the same topic, and a channel that is still
// leaving can't be re-joined. So every listener shares one subscription that stays open for the
// life of the page instead of each subscribing (and tearing down) its own.
const realtimeListeners = new Set<(payload: LiveSyncPayload) => void>();
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function addRealtimeListener(listener: (payload: LiveSyncPayload) => void) {
  realtimeListeners.add(listener);
  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("gj-live-broadcast")
      .on("broadcast", { event: "live_sync" }, ({ payload }) => {
        if (payload) realtimeListeners.forEach((notify) => notify(payload as LiveSyncPayload));
      })
      .subscribe();
  }
  return () => {
    realtimeListeners.delete(listener);
  };
}

export function useLiveSyncListener(onSync: (payload: LiveSyncPayload) => void) {
  // Keep the latest callback without resubscribing on every render.
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    const notify = (payload: LiveSyncPayload) => onSyncRef.current(payload);

    // Local BroadcastChannel
    const ch = getLocalChannel();
    const handleLocal = (e: MessageEvent) => {
      if (e.data && e.data.type) {
        notify(e.data as LiveSyncPayload);
      }
    };
    ch?.addEventListener("message", handleLocal);

    // LocalStorage storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "gj_live_ping" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          notify(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    // Supabase Realtime channel
    const removeRealtime = addRealtimeListener(notify);

    return () => {
      ch?.removeEventListener("message", handleLocal);
      window.removeEventListener("storage", handleStorage);
      removeRealtime();
    };
  }, []);
}
