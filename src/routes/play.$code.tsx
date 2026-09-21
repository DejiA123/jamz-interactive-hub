import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Gavel, Heart, LoaderCircle, MessageCircleQuestion, Radio, Send, Star, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Activity = Tables<"activities">;
type Option = Tables<"activity_options">;
type Participant = Pick<Tables<"participants">, "nickname" | "score">;

export const Route = createFileRoute("/play/$code")({
  head: () => ({ meta: [
    { title: "Live Room — Gospel Jamz 2026" },
    { name: "description", content: "Vote, ask questions, send encouragement and play in the live Gospel Jamz room." },
    { property: "og:title", content: "Gospel Jamz 2026 Live Room" },
    { property: "og:description", content: "Join the live audience experience from your seat." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<Tables<"event_sessions"> | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [leaders, setLeaders] = useState<Participant[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const loadRoom = useCallback(async () => {
    const { data: room } = await supabase.from("event_sessions").select("*").eq("join_code", code).maybeSingle();
    if (!room) { setMessage("This room could not be found."); setBusy(false); return; }
    setSession(room);
    setParticipantId(sessionStorage.getItem(`gj-participant-${room.id}`));
    const [{ data: people }, activityResult] = await Promise.all([
      supabase.from("participants").select("nickname,score").eq("session_id", room.id).order("score", { ascending: false }).limit(5),
      room.current_activity_id ? supabase.from("activities").select("*").eq("id", room.current_activity_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setLeaders(people ?? []);
    const nextActivity = activityResult.data;
    setActivity((current) => {
      if (nextActivity?.id !== current?.id) { setSent(false); setAnswer(""); setRating(0); }
      return nextActivity;
    });
    if (nextActivity) {
      const { data } = await supabase.from("activity_options").select("*").eq("activity_id", nextActivity.id).order("position");
      setOptions(data ?? []);
    } else setOptions([]);
    setBusy(false);
  }, [code]);

  useEffect(() => {
    void loadRoom();
    const channel = supabase.channel(`gospel-room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_sessions" }, () => void loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => void loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, () => void loadRoom())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [code, loadRoom]);

  async function submit(payload: { option_id?: string; text_answer?: string; rating?: number }) {
    if (!activity || !participantId || sent) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("responses").insert({ activity_id: activity.id, participant_id: participantId, ...payload });
    setBusy(false);
    if (error) { setMessage(error.code === "23505" ? "Your response is already in." : error.message); return; }
    setSent(true); setMessage(activity.kind === "rating" ? "Your encouragement has been shared." : "Your voice is in the room.");
  }

  const identity = useMemo(() => activity?.kind === "poll" && options.length === 2, [activity, options]);

  if (busy && !session) return <div className="grid min-h-screen place-items-center bg-background text-primary"><LoaderCircle className="size-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4 lg:px-10"><div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div className="flex min-w-0 items-center gap-3"><span className="animate-live size-2 shrink-0 bg-live"/><div className="min-w-0"><p className="truncate font-display uppercase">{session?.title ?? "Gospel Jamz Live"}</p><p className="text-xs uppercase text-muted-foreground">Room {code}</p></div></div><Button asChild variant="ghost" size="icon" aria-label="Leave room"><Link to="/"><ArrowLeft /></Link></Button></div></header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0">
            {!participantId && <div className="mb-6 border-l-2 border-secondary bg-card p-4 text-sm">Join from the home page first so your response can be counted. <Link to="/" className="font-semibold text-primary">Enter the room</Link></div>}
            {!activity || session?.status !== "live" ? <WaitingState /> : <>
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Radio className="size-4"/> Live now · {labelFor(activity.kind)}</p><span className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4"/> {activity.duration_seconds} sec</span></div>
              <h1 className="mt-6 max-w-[18ch] font-display text-3xl uppercase leading-tight sm:text-5xl">{activity.prompt}</h1>
              <div className="mt-9">
                {(activity.kind === "quiz" || activity.kind === "poll") && <div className={identity ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>{options.map((option, index) => <Button key={option.id} disabled={busy || sent || !participantId} onClick={() => void submit({ option_id: option.id })} variant={identity ? (index === 0 ? "verdictYes" : "verdictNo") : "outline"} className={identity ? "h-32 justify-between px-6 text-xl" : "h-14 justify-between px-5 text-left"}>{option.label}{identity ? <Gavel className="size-6"/> : <span className="font-display text-primary">{String(index + 1).padStart(2, "0")}</span>}</Button>)}</div>}
                {(activity.kind === "word_cloud" || activity.kind === "challenge") && <form onSubmit={(event) => { event.preventDefault(); void submit({ text_answer: answer.trim() }); }} className="space-y-3"><Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={180} required placeholder={activity.kind === "word_cloud" ? "Type your question or response…" : "Share your answer…"} className="min-h-36 bg-card p-4 text-base"/><div className="flex justify-between text-xs text-muted-foreground"><span>{answer.length}/180</span><Button variant="broadcast" disabled={busy || sent || !participantId || answer.trim().length < 2}><Send/> Send live</Button></div></form>}
                {activity.kind === "rating" && <div><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map((value) => <Button key={value} variant={rating === value ? "signal" : "outline"} size="icon" className="h-16 w-full" onClick={() => setRating(value)} aria-label={`${value} stars`}><Star className={rating >= value ? "fill-current" : ""}/></Button>)}</div><Button variant="broadcast" size="lg" className="mt-4 w-full" disabled={!rating || busy || sent || !participantId} onClick={() => void submit({ rating })}><Heart/> Send encouragement</Button></div>}
              </div>
              {message && <div role="status" className="mt-6 flex items-center gap-3 border-l-2 border-primary bg-card p-4 text-sm"><Check className="size-5 text-primary"/>{message}</div>}
            </>}
          </section>

          <aside className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div className="flex items-center justify-between"><h2 className="font-display uppercase">Room pulse</h2><Users className="size-5 text-secondary"/></div><p className="mt-2 text-sm text-muted-foreground">{leaders.length} leaders on screen</p><ol className="mt-6 space-y-5">{leaders.map((person,index)=><li key={`${person.nickname}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><span className="font-display text-xs text-primary">{String(index+1).padStart(2,"0")}</span><span className="truncate text-sm font-semibold">{person.nickname}</span><span className="text-xs text-muted-foreground">{person.score.toLocaleString()}</span></li>)}</ol><div className="mt-10 border-t border-border pt-6"><p className="flex items-center gap-2 text-xs uppercase text-secondary"><Trophy className="size-4"/> Every voice matters</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Stay here. The next vote, question or feedback moment will appear automatically.</p></div></aside>
        </div>
      </main>
    </div>
  );
}

function WaitingState() {
  return <div className="flex min-h-[55vh] flex-col justify-center"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><span className="animate-live size-2 bg-live"/> Connected</p><h1 className="mt-5 max-w-[14ch] font-display text-4xl uppercase sm:text-6xl">The next moment is about to begin.</h1><p className="mt-5 max-w-[48ch] text-muted-foreground">Keep this screen open. When the host launches a vote, panel question or feedback moment, it appears here.</p></div>;
}

function labelFor(kind: Activity["kind"]) {
  return ({ quiz: "Quiz", poll: "Audience verdict", word_cloud: "Panel questions", rating: "Minister feedback", challenge: "Creative challenge" })[kind];
}