import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const HOST_PASSCODE = "VIRTUALKEYS";
const AUTH_KEY = "gj_host_passcode_auth";

export function isHostAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return (
    sessionStorage.getItem(AUTH_KEY) === "true" ||
    localStorage.getItem(AUTH_KEY) === "true"
  );
}

export function verifyAndSetHostPasscode(passcode: string): boolean {
  if (typeof window === "undefined") return false;
  const clean = passcode.trim().toUpperCase();
  if (clean === HOST_PASSCODE) {
    sessionStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

export function lockHostStudio(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
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

export function useLiveSyncListener(onSync: (payload: LiveSyncPayload) => void) {
  useEffect(() => {
    // Local BroadcastChannel
    const ch = getLocalChannel();
    const handleLocal = (e: MessageEvent) => {
      if (e.data && e.data.type) {
        onSync(e.data as LiveSyncPayload);
      }
    };
    ch?.addEventListener("message", handleLocal);

    // LocalStorage storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "gj_live_ping" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          onSync(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    // Supabase Realtime channel
    const sbChannel = supabase
      .channel("gj-live-broadcast")
      .on("broadcast", { event: "live_sync" }, ({ payload }) => {
        if (payload) onSync(payload as LiveSyncPayload);
      })
      .subscribe();

    return () => {
      ch?.removeEventListener("message", handleLocal);
      window.removeEventListener("storage", handleStorage);
      void supabase.removeChannel(sbChannel);
    };
  }, [onSync]);
}
