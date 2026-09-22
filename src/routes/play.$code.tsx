import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Gavel,
  Heart,
  LoaderCircle,
  MessageCircleQuestion,
  Mic2,
  Radio,
  Send,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNavigation } from "@/components/app-navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useLiveSyncListener } from "@/lib/live-sync";

type Activity = Tables<"activities">;
type Option = Tables<"activity_options">;
type Participant = Pick<Tables<"participants">, "nickname" | "score">;

export const Route = createFileRoute("/play/$code")({
  head: () => ({
    meta: [
      { title: "Live Room — Gospel Jamz 2026" },
      { name: "description", content: "Vote, ask questions, send encouragement and play in the live Gospel Jamz room." },
      { property: "og:title", content: "Gospel Jamz 2026 Live Room" },
      { property: "og:description", content: "Join the live audience experience from your seat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<Tables<"event_sessions"> | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [leaders, setLeaders] = useState<Participant[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantNickname, setParticipantNickname] = useState<string>("");

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [joining, setJoining] = useState(false);

  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const loadRoom = useCallback(async () => {
    const { data: room } = await supabase.from("event_sessions").select("*").eq("join_code", code).maybeSingle();
    if (!room) {
      setMessage("This room could not be found or is no longer available.");
      setBusy(false);
      return;
    }
    setSession(room);

    const savedPartId = sessionStorage.getItem(`gj-participant-${room.id}`) || localStorage.getItem(`gj-participant-${room.id}`);
    const savedNick = sessionStorage.getItem(`gj-nick-${room.id}`) || localStorage.getItem(`gj-nick-${room.id}`) || "";

    if (savedPartId) {
      setParticipantId(savedPartId);
      setParticipantNickname(savedNick);
    } else {
      setJoinModalOpen(true);
    }

    const [{ data: people }, activityResult] = await Promise.all([
      supabase.from("participants").select("nickname,score").eq("session_id", room.id).order("score", { ascending: false }).limit(5),
      room.current_activity_id
        ? supabase.from("activities").select("*").eq("id", room.current_activity_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setLeaders(people ?? []);
    const nextActivity = activityResult.data;

    setActivity((current) => {
      if (nextActivity?.id !== current?.id) {
        setSent(false);
        setAnswer("");
        setRating(0);
      }
      return nextActivity;
    });

    if (nextActivity) {
      const { data } = await supabase.from("activity_options").select("*").eq("activity_id", nextActivity.id).order("position");
      setOptions(data ?? []);
    } else {
      setOptions([]);
    }
    setBusy(false);
  }, [code]);

  useEffect(() => {
    void loadRoom();
    const channel = supabase
      .channel(`gospel-room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_sessions" }, () => void loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => void loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, () => void loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => void loadRoom())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, loadRoom]);

  // Hook into local broadcast sync
  useLiveSyncListener(() => {
    void loadRoom();
  });

  async function joinInPlace(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !nicknameInput.trim()) return;
    setJoining(true);

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, nickname: nicknameInput.trim() })
      .select("id")
      .single();

    setJoining(false);
    if (error || !participant) {
      setMessage(error?.message ?? "Could not register nickname.");
      return;
    }

    sessionStorage.setItem(`gj-participant-${session.id}`, participant.id);
    localStorage.setItem(`gj-participant-${session.id}`, participant.id);
    sessionStorage.setItem(`gj-nick-${session.id}`, nicknameInput.trim());
    localStorage.setItem(`gj-nick-${session.id}`, nicknameInput.trim());

    setParticipantId(participant.id);
    setParticipantNickname(nicknameInput.trim());
    setJoinModalOpen(false);
    void loadRoom();
  }

  async function submit(payload: { option_id?: string; text_answer?: string; rating?: number }) {
    if (!activity || !participantId || sent) return;
    setBusy(true);
    setMessage("");

    const { error } = await supabase.from("responses").insert({
      activity_id: activity.id,
      participant_id: participantId,
      ...payload,
    });

    setBusy(false);
    if (error) {
      setMessage(error.code === "23505" ? "Your response is already in." : error.message);
      return;
    }
    setSent(true);
    setMessage(
      activity.kind === "rating"
        ? "Your encouragement has been shared with the stage."
        : "Your voice is counted on the live board."
    );
  }

  const identity = useMemo(() => activity?.kind === "poll" && options.length === 2, [activity, options]);

  if (busy && !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-primary">
        <LoaderCircle className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-16 text-foreground sm:pb-0">
      <AppNavigation />

      <header className="border-b border-border px-5 py-4 lg:px-10 bg-card/60 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="animate-live size-2.5 shrink-0 rounded-full bg-live" />
            <div className="min-w-0">
              <p className="truncate font-display uppercase text-lg">{session?.title ?? "Gospel Jamz Live"}</p>
              <p className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                <span>Room {code}</span>
                {participantNickname && (
                  <>
                    <span>·</span>
                    <span className="text-primary font-semibold">Playing as {participantNickname}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Leave room">
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0">
            {!participantId && (
              <div className="mb-6 flex items-center justify-between border-l-2 border-secondary bg-card p-4 text-sm">
                <span>Enter your nickname so your votes and answers count on the board.</span>
                <Button size="sm" variant="broadcast" onClick={() => setJoinModalOpen(true)}>
                  Set Nickname
                </Button>
              </div>
            )}

            {!activity || session?.status !== "live" ? (
              <WaitingState />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                    <Radio className="size-4 animate-live text-live" /> Live now · {labelFor(activity.kind)}
                  </p>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" /> {activity.duration_seconds} sec
                  </span>
                </div>

                <h1 className="mt-6 max-w-[18ch] font-display text-3xl uppercase leading-tight sm:text-5xl">
                  {activity.prompt}
                </h1>

                <div className="mt-9">
                  {(activity.kind === "quiz" || activity.kind === "poll") && (
                    <div className={identity ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>
                      {options.map((option, index) => (
                        <Button
                          key={option.id}
                          disabled={busy || sent || !participantId}
                          onClick={() => void submit({ option_id: option.id })}
                          variant={identity ? (index === 0 ? "verdictYes" : "verdictNo") : "outline"}
                          className={
                            identity
                              ? "h-32 justify-between px-6 text-xl"
                              : "h-14 justify-between px-5 text-left text-base"
                          }
                        >
                          <span className="font-semibold">{option.label}</span>
                          {identity ? (
                            <Gavel className="size-6" />
                          ) : (
                            <span className="font-display text-primary">{String(index + 1).padStart(2, "0")}</span>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}

                  {(activity.kind === "word_cloud" || activity.kind === "challenge") && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submit({ text_answer: answer.trim() });
                      }}
                      className="space-y-3"
                    >
                      <Textarea
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        maxLength={180}
                        required
                        disabled={sent || !participantId}
                        placeholder={
                          activity.kind === "word_cloud"
                            ? "Type your question or response for the stage…"
                            : "Type your answer…"
                        }
                        className="min-h-36 bg-card p-4 text-base"
                      />
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{answer.length}/180</span>
                        <Button
                          variant="broadcast"
                          disabled={busy || sent || !participantId || answer.trim().length < 2}
                        >
                          <Send className="size-3.5" /> Send to stage
                        </Button>
                      </div>
                    </form>
                  )}

                  {activity.kind === "rating" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Button
                            key={value}
                            variant={rating === value ? "signal" : "outline"}
                            size="icon"
                            className="h-16 w-full"
                            onClick={() => setRating(value)}
                            disabled={sent || !participantId}
                            aria-label={`${value} stars`}
                          >
                            <Star className={`size-6 ${rating >= value ? "fill-current text-secondary" : ""}`} />
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="broadcast"
                        size="lg"
                        className="w-full"
                        disabled={!rating || busy || sent || !participantId}
                        onClick={() => void submit({ rating })}
                      >
                        <Heart className="size-4" /> Send encouragement
                      </Button>
                    </div>
                  )}
                </div>

                {message && (
                  <div
                    role="status"
                    className="mt-6 flex items-center gap-3 border-l-2 border-primary bg-card p-4 text-sm font-semibold"
                  >
                    <Check className="size-5 text-primary" />
                    {message}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Sidebar Leaderboard */}
          <aside className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-center justify-between">
              <h2 className="font-display uppercase text-lg">Room pulse</h2>
              <Users className="size-5 text-secondary" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{leaders.length} leaders on screen</p>

            <ol className="mt-6 space-y-4">
              {leaders.length === 0 ? (
                <li className="text-xs text-muted-foreground italic py-2">No scores recorded yet.</li>
              ) : (
                leaders.map((person, index) => (
                  <li key={`${person.nickname}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="font-display text-xs text-primary font-bold">{String(index + 1).padStart(2, "0")}</span>
                    <span className="truncate text-sm font-semibold">{person.nickname}</span>
                    <span className="font-mono text-xs text-muted-foreground">{person.score.toLocaleString()}</span>
                  </li>
                ))
              )}
            </ol>

            <div className="mt-10 border-t border-border pt-6">
              <p className="flex items-center gap-2 text-xs uppercase text-secondary font-bold">
                <Trophy className="size-4" /> Every voice matters
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Keep this screen open. When the host launches the next vote, question, or challenge, it appears here automatically.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Nickname Entry Dialog for Direct Link Visitors */}
      <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">Join Room {code}</DialogTitle>
            <DialogDescription>
              Enter a nickname so your votes and answers are counted on the live stage board.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={joinInPlace} className="space-y-4 pt-2">
            <Input
              autoFocus
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              minLength={2}
              maxLength={24}
              placeholder="Your nickname (e.g. David)"
              className="h-12"
              required
            />
            <Button variant="broadcast" size="lg" className="w-full" disabled={joining || !nicknameInput.trim()}>
              {joining ? <LoaderCircle className="size-5 animate-spin" /> : <Mic2 className="size-5" />}
              Enter Live Room
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaitingState() {
  return (
    <div className="flex min-h-[55vh] flex-col justify-center">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
        <span className="animate-live size-2 rounded-full bg-live" /> Connected to live room
      </p>
      <h1 className="mt-5 max-w-[14ch] font-display text-4xl uppercase sm:text-6xl">
        The next moment is about to begin.
      </h1>
      <p className="mt-5 max-w-[48ch] text-muted-foreground leading-relaxed">
        Keep this screen open. When the host launches a vote, panel question or feedback moment, it will appear here instantly.
      </p>
    </div>
  );
}

function labelFor(kind: Activity["kind"]) {
  return (
    {
      quiz: "Quiz",
      poll: "Audience Verdict",
      word_cloud: "Panel Questions",
      rating: "Minister Feedback",
      challenge: "Creative Challenge",
    }[kind] ?? kind
  );
}