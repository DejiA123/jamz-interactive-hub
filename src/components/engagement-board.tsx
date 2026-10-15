import { useEffect, useState } from "react";
import { Crown, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchResponses } from "@/lib/rooms";

type Row = { id: string; nickname: string; count: number };

const MEDALS = [
  { badge: "bg-medal-gold", bar: "bg-medal-gold" },
  { badge: "bg-medal-silver", bar: "bg-medal-silver" },
  { badge: "bg-medal-bronze", bar: "bg-medal-bronze" },
] as const;

/** People ranked by how many times they took part (votes, answers, questions, feedback). */
export function EngagementBoard({
  sessionId,
  highlightId,
  limit = 5,
  refreshKey,
}: {
  sessionId: string;
  highlightId?: string | null;
  limit?: number;
  refreshKey?: unknown;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: acts }, { data: people }] = await Promise.all([
        supabase.from("activities").select("id").eq("session_id", sessionId),
        supabase.from("participants").select("id,nickname").eq("session_id", sessionId),
      ]);
      const responses = await fetchResponses((acts ?? []).map((a) => a.id));
      const counts = new Map<string, number>();
      for (const r of responses) counts.set(r.participant_id, (counts.get(r.participant_id) ?? 0) + 1);
      const ranked = (people ?? [])
        .map((p) => ({ id: p.id, nickname: p.nickname, count: counts.get(p.id) ?? 0 }))
        .filter((p) => p.count > 0)
        .sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname))
        .slice(0, limit);
      if (!cancelled) setRows(ranked);
    }
    void load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId, limit, refreshKey]);

  const top = rows[0]?.count ?? 1;

  return (
    <div>
      <p className="flex items-center gap-2 font-display text-lg uppercase">
        <Flame className="size-5 text-secondary" /> Most engaged
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Who's taking part the most</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs italic text-muted-foreground">No one has taken part yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const medal = index < 3 ? MEDALS[index] : null;
            return (
              <li
                key={row.id}
                className={
                  index === 0
                    ? "-mx-2 rounded-sm bg-secondary/10 px-2 py-2"
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {medal ? (
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full font-display text-xs text-background ${medal.badge}`}
                      >
                        {index + 1}
                      </span>
                    ) : (
                      <span className="grid size-7 shrink-0 place-items-center font-display text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                    <span className="truncate font-semibold">
                      {row.nickname}
                      {index === 0 && <Crown className="ml-1 inline size-3.5 text-medal-gold" />}
                      {row.id === highlightId && (
                        <span className="ml-1.5 text-[10px] uppercase text-primary">You</span>
                      )}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.count} {row.count === 1 ? "response" : "responses"}
                  </span>
                </div>
                <div className="ml-9 mt-1 h-1 bg-muted">
                  <div
                    className={`h-1 ${medal ? medal.bar : "bg-muted-foreground/40"}`}
                    style={{ width: `${(row.count / top) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
