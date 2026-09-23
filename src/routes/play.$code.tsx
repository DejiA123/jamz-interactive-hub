import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Gavel,
  Heart,
  LoaderCircle,
  Mic2,
  Radio,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNavigation } from "@/components/app-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useLiveSyncListener } from "@/lib/live-sync";
import {
  friendlyWriteError,
  rememberPlayer,
  sortLiveMoments,
  uniqueTopic,
  verifyStoredPlayer,
} from "@/lib/rooms";

type Activity = Tables<"activities">;
type Option = Tables<"activity_options">;
type Participant = Pick<Tables<"participants">, "id" | "nickname" | "score">;
/** The option picked (null for text answers) for each moment this player has answered. */
type Answers = Record<string, string | null>;

export const Route = createFileRoute("/play/$code")({
  head: () => ({
    meta: [
      { title: "Live Room — Gospel Jamz 2026" },
      {
        name: "description",
        content: "Vote, ask questions, send encouragement and play in the live Gospel Jamz room.",
      },
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
  const [notFound, setNotFound] = useState(false);
  const [liveMoments, setLiveMoments] = useState<Activity[]>([]);
  const [optionsByMoment, setOptionsByMoment] = useState<Record<string, Option[]>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [leaders, setLeaders] = useState<Participant[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantNickname, setParticipantNickname] = useState("");

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(true);
  const promptedForName = useRef(false);

  const loadRoom = useCallback(async () => {
    const { data: room } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("join_code", code)
      .maybeSingle();
    if (!room) {
      setNotFound(true);
      setSession(null);
      setLiveMoments([]);
      setBusy(false);
      return;
    }
    setNotFound(false);
    setSession(room);

    const player = await verifyStoredPlayer(room.id);
    setParticipantId(player?.id ?? null);
    setParticipantNickname(player?.nickname ?? "");
    if (!player && room.status === "live" && !promptedForName.current) {
      promptedForName.current = true;
      setJoinModalOpen(true);
    }

    const [{ data: moments }, { data: people }, { count }] = await Promise.all([
      supabase.from("activities").select("*").eq("session_id", room.id).eq("is_published", true),
      supabase
        .from("participants")
        .select("id,nickname,score")
        .eq("session_id", room.id)
        .order("score", { ascending: false })
        .order("joined_at")
        .limit(5),
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", room.id),
    ]);

    const live =
      room.status === "live" ? sortLiveMoments(moments ?? [], room.current_activity_id) : [];
    const ids = live.map((moment) => moment.id);

    const [optionRows, answerRows] = await Promise.all([
      ids.length
        ? supabase
            .from("activity_options")
            .select("*")
            .in("activity_id", ids)
            .order("position")
            .then(({ data }) => data ?? [])
        : Promise.resolve([] as Option[]),
      ids.length && player
        ? supabase
            .from("responses")
            .select("activity_id,option_id")
            .eq("participant_id", player.id)
            .in("activity_id", ids)
            .then(({ data }) => data ?? [])
        : Promise.resolve([] as { activity_id: string; option_id: string | null }[]),
    ]);

    const grouped: Record<string, Option[]> = {};
    for (const option of optionRows) {
      (grouped[option.activity_id] ??= []).push(option);
    }

    setLiveMoments(live);
    setOptionsByMoment(grouped);
    setAnswers(Object.fromEntries(answerRows.map((row) => [row.activity_id, row.option_id])));
    setLeaders(people ?? []);
    setPlayerCount(count ?? people?.length ?? 0);
    setBusy(false);
  }, [code]);

  // Coalesce bursts of realtime events into one reload.
  const reloadTimer = useRef<number | undefined>(undefined);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void loadRoom(), 250);
  }, [loadRoom]);

  useEffect(() => {
    void loadRoom();
    return () => window.clearTimeout(reloadTimer.current);
  }, [loadRoom]);

  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    // Only this room's changes; DELETE events can't be filtered, so listen to those separately.
    const channel = supabase
      .channel(uniqueTopic(`gospel-room-${sessionId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_sessions", filter: `id=eq.${sessionId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `session_id=eq.${sessionId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants" },
        scheduleReload,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, scheduleReload]);

  useLiveSyncListener(scheduleReload);

  async function joinInPlace(event: React.FormEvent) {
    event.preventDefault();
    const nickname = nicknameInput.trim();
    if (!session || nickname.length < 2) return;
    setJoining(true);
    setJoinError("");

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, nickname })
      .select("id")
      .single();

    setJoining(false);
    if (error || !participant) {
      setJoinError(
        error && /row-level security/i.test(error.message)
          ? "This room isn't open right now. Ask the host to open it."
          : (error?.message ?? "Could not register nickname."),
      );
      return;
    }

    rememberPlayer(session.id, { id: participant.id, nickname });
    setParticipantId(participant.id);
    setParticipantNickname(nickname);
    setJoinModalOpen(false);
    void loadRoom();
  }

  if (busy && !session && !notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-primary">
        <LoaderCircle className="size-8 animate-spin" />
      </div>
    );
  }

  const roomOpen = session?.status === "live";

  return (
    <div className="min-h-screen bg-background pb-28 pt-16 text-foreground md:pb-0">
      <AppNavigation />

      <header className="border-b border-border px-5 py-4 lg:px-10 bg-card/60 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`size-2.5 shrink-0 rounded-full ${roomOpen ? "animate-live bg-live" : "bg-muted-foreground"}`}
            />
            <div className="min-w-0">
              <p className="truncate font-display uppercase text-lg">
                {notFound ? "Room not found" : (session?.title ?? "Gospel Jamz Live")}
              </p>
              <p className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                <span>Room {code}</span>
                {participantNickname && (
                  <>
                    <span>·</span>
                    <span className="text-primary font-semibold">
                      Playing as {participantNickname}
                    </span>
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
            {roomOpen && !participantId && (
              <div className="mb-6 flex items-center justify-between gap-3 border-l-2 border-secondary bg-card p-4 text-sm">
                <span>Enter your nickname so your votes and answers count on the board.</span>
                <Button size="sm" variant="broadcast" onClick={() => setJoinModalOpen(true)}>
                  Set Nickname
                </Button>
              </div>
            )}

            {notFound ? (
              <RoomState
                eyebrow="Check the code"
                title="We couldn't find that room."
                body={`There is no live room with code ${code}. Check the six-digit code on the screen and try again.`}
              />
            ) : !roomOpen ? (
              <RoomState
                eyebrow="Room closed"
                title="This room is closed for now."
                body="The host has closed this room. Keep an eye on the screen for the next code, or head back and join another room."
              />
            ) : liveMoments.length === 0 ? (
              <WaitingState />
            ) : (
              <div>
                {liveMoments.length > 1 && (
                  <p className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase text-secondary">
                    <Radio className="size-4 animate-live text-live" /> {liveMoments.length} live
                    moments · answer each one
                  </p>
                )}
                {liveMoments.map((moment, index) => (
                  <LiveMoment
                    key={moment.id}
                    activity={moment}
                    options={optionsByMoment[moment.id] ?? []}
                    answer={answers[moment.id]}
                    participantId={participantId}
                    stacked={liveMoments.length > 1}
                    first={index === 0}
                    onAnswered={(optionId) =>
                      setAnswers((current) => ({ ...current, [moment.id]: optionId }))
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar Leaderboard */}
          <aside className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-center justify-between">
              <h2 className="font-display uppercase text-lg">Room pulse</h2>
              <Users className="size-5 text-secondary" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {playerCount} {playerCount === 1 ? "person" : "people"} in the room
            </p>

            <ol className="mt-6 space-y-4">
              {leaders.length === 0 ? (
                <li className="text-xs text-muted-foreground italic py-2">
                  No one has joined yet. Be the first!
                </li>
              ) : (
                leaders.map((person, index) => (
                  <li
                    key={person.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <span className="font-display text-xs text-primary font-bold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {person.nickname}
                      {person.id === participantId && (
                        <span className="ml-1.5 text-[10px] uppercase text-primary">You</span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {person.score.toLocaleString()}
                    </span>
                  </li>
                ))
              )}
            </ol>

            <div className="mt-10 border-t border-border pt-6">
              <p className="flex items-center gap-2 text-xs uppercase text-secondary font-bold">
                <Trophy className="size-4" /> Every voice matters
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Keep this screen open. When the host launches the next vote, question, or challenge,
                it appears here automatically.
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
            {joinError && (
              <p
                role="status"
                className="border-l-2 border-secondary pl-3 text-sm text-muted-foreground"
              >
                {joinError}
              </p>
            )}
            <Button
              variant="broadcast"
              size="lg"
              className="w-full"
              disabled={joining || nicknameInput.trim().length < 2}
            >
              {joining ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Mic2 className="size-5" />
              )}
              Enter Live Room
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LiveMoment({
  activity,
  options,
  answer,
  participantId,
  stacked,
  first,
  onAnswered,
}: {
  activity: Activity;
  options: Option[];
  answer: string | null | undefined;
  participantId: string | null;
  stacked: boolean;
  first: boolean;
  onAnswered: (optionId: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sent = answer !== undefined;
  const locked = sent || sending || !participantId;
  const verdict = activity.kind === "poll" && options.length === 2;
  const feedback = activity.kind === "rating";
  const maxLength = feedback ? 280 : 180;
  const Heading = first ? "h1" : "h2";

  async function submit(payload: { option_id?: string; text_answer?: string }) {
    if (!participantId || sent) return;
    setSending(true);
    setError("");

    const { error: insertError } = await supabase.from("responses").insert({
      activity_id: activity.id,
      participant_id: participantId,
      ...payload,
    });

    setSending(false);
    if (insertError && insertError.code !== "23505") {
      setError(friendlyWriteError(insertError));
      return;
    }
    onAnswered(payload.option_id ?? null);
  }

  return (
    <article className={first ? "" : "mt-12 border-t border-border pt-12"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
          <Radio className="size-4 animate-live text-live" /> Live now · {labelFor(activity.kind)}
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" /> {activity.duration_seconds} sec
        </span>
      </div>

      <Heading
        className={
          stacked
            ? "mt-5 max-w-[22ch] font-display text-2xl uppercase leading-tight sm:text-4xl"
            : "mt-6 max-w-[18ch] font-display text-3xl uppercase leading-tight sm:text-5xl"
        }
      >
        {activity.prompt}
      </Heading>

      <div className={stacked ? "mt-7" : "mt-9"}>
        {(activity.kind === "quiz" || activity.kind === "poll") && (
          <div className={verdict ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>
            {options.map((option, index) => {
              const chosen = answer === option.id;
              return (
                <Button
                  key={option.id}
                  disabled={locked}
                  onClick={() => void submit({ option_id: option.id })}
                  variant={verdict ? (index === 0 ? "verdictYes" : "verdictNo") : "outline"}
                  className={`${
                    verdict
                      ? "h-32 justify-between px-6 text-xl"
                      : "h-14 justify-between px-5 text-left text-base"
                  } ${chosen ? "ring-2 ring-primary ring-offset-2 ring-offset-background disabled:opacity-100" : ""}`}
                >
                  <span className="font-semibold">{option.label}</span>
                  {chosen ? (
                    <Check className="size-6" />
                  ) : verdict ? (
                    <Gavel className="size-6" />
                  ) : (
                    <span className="font-display text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {(activity.kind === "word_cloud" || activity.kind === "challenge" || feedback) && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit({ text_answer: text.trim() });
            }}
            className="space-y-3"
          >
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={maxLength}
              required
              disabled={locked}
              placeholder={
                feedback
                  ? "Write a word of encouragement for the minister…"
                  : activity.kind === "word_cloud"
                    ? "Type your question or response for the stage…"
                    : "Type your answer…"
              }
              className="min-h-36 bg-card p-4 text-base"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {text.length}/{maxLength}
              </span>
              <Button variant="broadcast" disabled={locked || text.trim().length < 2}>
                {feedback ? <Heart className="size-3.5" /> : <Send className="size-3.5" />}
                {feedback ? "Send encouragement" : "Send to stage"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {error ? (
        <div
          role="status"
          className="mt-6 border-l-2 border-secondary bg-card p-4 text-sm font-semibold"
        >
          {error}
        </div>
      ) : (
        sent && (
          <div
            role="status"
            className="mt-6 flex items-center gap-3 border-l-2 border-primary bg-card p-4 text-sm font-semibold"
          >
            <Check className="size-5 text-primary" />
            {feedback
              ? "Your encouragement has been shared with the stage."
              : "Your voice is counted on the live board."}
          </div>
        )
      )}
    </article>
  );
}

function WaitingState() {
  return (
    <RoomState
      eyebrow={
        <>
          <span className="animate-live size-2 rounded-full bg-live" /> Connected to live room
        </>
      }
      title="The next moment is about to begin."
      body="Keep this screen open. When the host launches a vote, panel question or feedback moment, it will appear here instantly."
    />
  );
}

function RoomState({
  eyebrow,
  title,
  body,
}: {
  eyebrow: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-[55vh] flex-col justify-center">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-5 max-w-[14ch] font-display text-4xl uppercase sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-[48ch] text-muted-foreground leading-relaxed">{body}</p>
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
