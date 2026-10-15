import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchResponses } from "@/lib/rooms";

type Row = { id: string; nickname: string; count: number };

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
          {rows.map((row, index) => (
            <li key={row.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold">
                  <span className="mr-2 font-display text-xs text-secondary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {row.nickname}
                  {row.id === highlightId && (
                    <span className="ml-1.5 text-[10px] uppercase text-primary">You</span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.count} {row.count === 1 ? "response" : "responses"}
                </span>
              </div>
              <div className="mt-1 h-1 bg-muted">
                <div className="h-1 bg-secondary" style={{ width: `${(row.count / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
