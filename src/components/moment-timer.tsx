import { Clock3 } from "lucide-react";
import { formatClock, type useCountdown } from "@/lib/moments";
import { cn } from "@/lib/utils";

type Countdown = ReturnType<typeof useCountdown>;

/** "0:32" while a vote or quiz runs, "Time's up" after. Nothing for written moments. */
export function TimerBadge({ countdown, className }: { countdown: Countdown; className?: string }) {
  if (!countdown.timed) return null;
  const urgent = !countdown.expired && countdown.secondsLeft <= 5;
  return (
    <span
      role="timer"
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums",
        countdown.expired ? "text-muted-foreground" : urgent ? "text-secondary" : "text-foreground",
        className,
      )}
    >
      <Clock3 className="size-4" />
      {countdown.expired ? "Time's up" : formatClock(countdown.secondsLeft)}
    </span>
  );
}

export function TimerBar({ countdown, className }: { countdown: Countdown; className?: string }) {
  if (!countdown.timed) return null;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden bg-muted", className)} aria-hidden>
      <div
        className={cn(
          "h-full transition-[width] duration-300 ease-linear",
          countdown.secondsLeft <= 5 ? "bg-secondary" : "bg-primary",
        )}
        style={{ width: `${countdown.fraction * 100}%` }}
      />
    </div>
  );
}
