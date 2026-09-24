import { useEffect, useState } from "react";
import type { Database, Tables } from "@/integrations/supabase/types";

export type MomentKind = Database["public"]["Enums"]["activity_kind"];

/** One name per moment type, used on every screen so hosts and players see the same words. */
export const MOMENT_TYPES: { kind: MomentKind; label: string; hint: string }[] = [
  { kind: "poll", label: "Vote", hint: "Everyone picks one option, like a drama verdict" },
  { kind: "quiz", label: "Quiz", hint: "One right answer that earns points" },
  { kind: "word_cloud", label: "Panel Questions", hint: "People type questions for the panel" },
  {
    kind: "rating",
    label: "Minister Feedback",
    hint: "People write encouragement for the minister",
  },
  { kind: "challenge", label: "Challenge", hint: "People type a short creative answer" },
];

export function momentLabel(kind: MomentKind) {
  return MOMENT_TYPES.find((type) => type.kind === kind)?.label ?? kind;
}

/** Votes and quizzes run against the clock. Written moments stay open until the host ends them. */
export function isTimed(kind: MomentKind) {
  return kind === "quiz" || kind === "poll";
}

export function plural(count: number, word: string) {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

// Countdowns compare the database's launch time with this device's clock, so correct for devices
// whose clock is off (a projector laptop a minute fast would otherwise show "Time's up" at once).
let clockOffset = 0;
let clockSync: Promise<void> | null = null;

function syncServerClock() {
  if (typeof window === "undefined") return;
  clockSync ??= (async () => {
    try {
      const sent = Date.now();
      const response = await fetch(`/favicon.ico?clock=${sent}`, {
        method: "HEAD",
        cache: "no-store",
      });
      const header = response.headers.get("date");
      if (!header) return;
      // The Date header drops milliseconds, so it is on average half a second behind.
      clockOffset = Date.parse(header) + 500 - (sent + Date.now()) / 2;
    } catch {
      // Keep the device clock.
    }
  })();
}

function serverNow() {
  return Date.now() + clockOffset;
}

/**
 * Time left on a live vote or quiz. A moment's updated_at is its launch time: going live is the
 * only change made to a moment while it is live.
 */
export function useCountdown(
  activity: Pick<Tables<"activities">, "kind" | "duration_seconds" | "updated_at">,
) {
  const timed = isTimed(activity.kind);
  const total = activity.duration_seconds * 1000;
  const endsAt = Date.parse(activity.updated_at) + total;
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!timed) return;
    syncServerClock();
    setNow(serverNow());
    const timer = window.setInterval(() => setNow(serverNow()), 250);
    return () => window.clearInterval(timer);
  }, [timed, endsAt]);

  const left = Math.min(total, Math.max(0, endsAt - now));
  return {
    timed,
    secondsLeft: Math.ceil(left / 1000),
    fraction: total > 0 ? left / total : 0,
    expired: timed && left === 0,
  };
}

export function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
