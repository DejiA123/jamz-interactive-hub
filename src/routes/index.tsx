import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Gavel,
  Heart,
  LoaderCircle,
  MessageCircleQuestion,
  Mic2,
  Radio,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useLiveSyncListener } from "@/lib/live-sync";
import {
  fetchResponses,
  rememberPlayer,
  sortLiveMoments,
  uniqueTopic,
  verifyStoredPlayer,
} from "@/lib/rooms";
import stageImage from "@/assets/gospel-jamz-stage.jpg";

type Activity = Tables<"activities">;
type Option = Tables<"activity_options">;
type Participant = Tables<"participants">;
type ResponseRow = Tables<"responses">;

const programme = [
  { day: "Friday · 16 Oct", time: "18:00", title: "Opening Celebration", note: "Praise, welcome and the first live audience moment" },
  { day: "Saturday · 17 Oct", time: "10:00", title: "Creative Arts Sessions", note: "Music, drama, spoken word and workshops" },
  { day: "Saturday · 17 Oct", time: "16:00", title: "Panel & Live Questions", note: "Ask the panel and shape the conversation" },
  { day: "Sunday · 18 Oct", time: "17:00", title: "Gospel Jamz Finale", note: "Ministration, audience feedback and celebration" },
];

const moments = [
  { icon: Gavel, number: "01", title: "You be the judge", copy: "Vote Guilty or Not Guilty during live drama and watch the room decide." },
  { icon: MessageCircleQuestion, number: "02", title: "Ask the panel", copy: "Send thoughtful questions from your seat for the host to bring on stage." },
  { icon: Heart, number: "03", title: "Send encouragement", copy: "Give ministers uplifting feedback they can read after their moment." },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gospel Jamz 2026 — Join the Live Experience" },
      { name: "description", content: "Join Gospel Jamz live votes, panel questions, feedback and creative challenges with your event code." },
      { property: "og:title", content: "Gospel Jamz 2026 — Join the Live Experience" },
      { property: "og:description", content: "Youth Conference Creative Arts Festival, 16–18 October. To live is Christ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);

  // Real live room state from database
  const [activeSession, setActiveSession] = useState<Tables<"event_sessions"> | null>(null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [topLeaders, setTopLeaders] = useState<Participant[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);

  const loadLiveSession = useCallback(async () => {
    // 1. The most recently active live room, else the newest room
    const { data: session } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("status", "live")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const targetSession =
      session ??
      (
        await supabase
          .from("event_sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;

    if (!targetSession) return;
    setActiveSession(targetSession);
    setCode((prev) => (prev ? prev : targetSession.join_code));

    // 2. The room's run of show and its real players
    const [{ data: activitiesData }, { data: leadersData }] = await Promise.all([
      supabase.from("activities").select("*").eq("session_id", targetSession.id).order("position"),
      supabase
        .from("participants")
        .select("*")
        .eq("session_id", targetSession.id)
        .order("score", { ascending: false })
        .order("joined_at")
        .limit(5),
    ]);

    setAllActivities(activitiesData ?? []);
    setTopLeaders(leadersData ?? []);

    // 3. The spotlight moment on the big screen: only ever one that is actually live
    const liveActs =
      targetSession.status === "live" ? (activitiesData ?? []).filter((a) => a.is_published) : [];
    const activeAct = sortLiveMoments(liveActs, targetSession.current_activity_id)[0] ?? null;

    setCurrentActivity(activeAct);

    if (activeAct) {
      const [{ data: optData }, respData] = await Promise.all([
        supabase.from("activity_options").select("*").eq("activity_id", activeAct.id).order("position"),
        fetchResponses([activeAct.id]),
      ]);
      setOptions(optData ?? []);
      setResponses(respData);
    } else {
      setOptions([]);
      setResponses([]);
    }
  }, []);

  // Coalesce bursts of realtime events (e.g. a wave of votes) into one reload.
  const reloadTimer = useRef<number | undefined>(undefined);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void loadLiveSession(), 300);
  }, [loadLiveSession]);

  useEffect(() => {
    void loadLiveSession();
    return () => window.clearTimeout(reloadTimer.current);
  }, [loadLiveSession]);

  // Realtime updates for the featured room only
  const activeSessionId = activeSession?.id;
  const currentActivityId = currentActivity?.id;
  useEffect(() => {
    if (!activeSessionId) return;

    let channel = supabase
      .channel(uniqueTopic(`home-live-${activeSessionId}`))
      // Any room going live or closing can change which room is featured.
      .on("postgres_changes", { event: "*", schema: "public", table: "event_sessions" }, scheduleReload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `session_id=eq.${activeSessionId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${activeSessionId}` },
        scheduleReload,
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "activities" }, scheduleReload)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "participants" }, scheduleReload);

    if (currentActivityId) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "responses", filter: `activity_id=eq.${currentActivityId}` },
        scheduleReload,
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeSessionId, currentActivityId, scheduleReload]);

  useLiveSyncListener(scheduleReload);

  async function requestJoin(overrideCode?: string) {
    const targetCode = overrideCode ?? code;
    if (targetCode.length !== 6) {
      setMessage("Enter the six-digit code shown on screen.");
      return;
    }
    setCode(targetCode);
    setMessage("");

    const { data: room } = await supabase
      .from("event_sessions")
      .select("id,status")
      .eq("join_code", targetCode)
      .maybeSingle();

    if (!room) {
      setMessage(`There is no room with code ${targetCode}. Check the code on screen.`);
      return;
    }
    if (room.status !== "live") {
      setMessage(`Room ${targetCode} is closed right now. Wait for the host to open it.`);
      return;
    }

    // Already joined this room on this device: go straight back in.
    if (await verifyStoredPlayer(room.id)) {
      void navigate({ to: "/play/$code", params: { code: targetCode } });
      return;
    }
    setJoinOpen(true);
  }

  async function joinSession(event: React.FormEvent) {
    event.preventDefault();
    const name = nickname.trim();
    setJoining(true);
    setMessage("");

    const { data: session } = await supabase
      .from("event_sessions")
      .select("id")
      .eq("join_code", code)
      .eq("status", "live")
      .maybeSingle();

    if (!session) {
      setJoining(false);
      setMessage(`Room ${code} is currently closed or waiting for host to open.`);
      return;
    }

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, nickname: name })
      .select("id")
      .single();

    setJoining(false);
    if (error || !participant) {
      setMessage(error?.message ?? "Could not join right now.");
      return;
    }

    rememberPlayer(session.id, { id: participant.id, nickname: name });
    setJoinOpen(false);
    void navigate({ to: "/play/$code", params: { code } });
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground selection:bg-primary selection:text-primary-foreground md:pb-0">
      <AppNavigation />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[92svh] overflow-hidden border-b border-border">
          <img
            src={stageImage}
            alt="Guitarist leading worship under cyan and gold stage lights"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-stage-wash" />
          <div className="relative mx-auto flex min-h-[92svh] max-w-7xl flex-col justify-end px-5 pb-12 pt-28 lg:px-10 lg:pb-16">
            <div className="max-w-4xl">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                <Sparkles className="size-4" /> Youth Conference · Creative Arts Festival
              </p>
              <h1 className="font-display text-5xl uppercase leading-[0.95] sm:text-7xl lg:text-8xl">
                Your voice.<br />
                <span className="text-secondary">In the room.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-foreground/75 sm:text-lg">
                Vote, ask, encourage and play live at Gospel Jamz. 16–18 October · The Power House Int'l.
              </p>
            </div>

            {/* Join Box */}
            <div
              id="join"
              className="mt-9 max-w-3xl scroll-mt-24 border border-foreground/20 bg-background/90 p-3 backdrop-blur-md sm:p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <label htmlFor="event-code" className="mb-2 block text-xs font-semibold uppercase text-primary">
                    Enter the code on screen
                  </label>
                  <Input
                    id="event-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    onKeyDown={(event) => event.key === "Enter" && void requestJoin()}
                    placeholder={activeSession?.join_code ?? "000000"}
                    className="h-14 border-border bg-card px-4 font-display text-2xl text-foreground placeholder:text-muted-foreground sm:h-16"
                  />
                </div>
                <Button variant="broadcast" size="lg" onClick={() => void requestJoin()} className="h-14 sm:h-16 sm:px-10">
                  Join live <ArrowRight className="size-5" />
                </Button>
              </div>

              {message && !joinOpen && (
                <p role="status" className="mt-3 border-l-2 border-secondary pl-3 text-sm text-foreground/80">
                  {message}
                </p>
              )}

              {activeSession && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    Active stage: <b className="text-foreground">{activeSession.title}</b> (Code{" "}
                    <button
                      type="button"
                      onClick={() => setCode(activeSession.join_code)}
                      className="font-mono text-primary font-bold underline"
                    >
                      {activeSession.join_code}
                    </button>
                    )
                  </span>
                  {activeSession.status === "live" ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-live size-2 rounded-full bg-live" /> Live room ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-muted-foreground" /> Room closed
                    </span>
                  )}
                </div>
              )}
            </div>

            <a
              href="#live-board"
              className="mt-8 inline-flex w-fit items-center gap-2 text-xs font-semibold uppercase text-foreground/60 hover:text-primary transition-colors"
            >
              Live Stage Board <ChevronDown className="size-4" />
            </a>
          </div>
        </section>

        {/* Real Live Interaction Board */}
        <section id="live-board" className="border-b border-border px-5 py-14 lg:px-10 lg:py-20 scroll-mt-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                  <Radio className="size-4 text-live animate-live" /> Real-Time Live Interaction Board
                </p>
                <h2 className="mt-3 max-w-[15ch] font-display text-3xl uppercase sm:text-5xl">
                  {activeSession ? activeSession.title : "Live Stage"}
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                All interactions launched from the Host Studio appear here in real time. Audience responses are tallied live.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              {/* Primary Active Moment Widget */}
              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-7 lg:row-span-2 chrome-edge flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary">
                        {currentActivity ? `Live Interaction · ${kindLabel(currentActivity.kind)}` : "Live Interaction"}
                      </p>
                      <h3 className="mt-2 font-display text-2xl uppercase leading-tight sm:text-3xl">
                        {currentActivity?.prompt ?? "Waiting for host to launch the next live moment…"}
                      </h3>
                    </div>
                    <span
                      className={`mt-1 size-2 rounded-full ${currentActivity ? "animate-live bg-live" : "bg-muted-foreground"}`}
                    />
                  </div>

                  {/* Real Content for Current Activity */}
                  <div className="mt-6 min-h-64 flex flex-col justify-center">
                    {currentActivity?.kind === "word_cloud" && (
                      <div className="flex flex-wrap content-center items-center justify-center gap-3 py-6 text-center">
                        {responses.length === 0 ? (
                          <p className="text-sm italic text-muted-foreground">
                            Audience words and questions will appear here live as they are submitted…
                          </p>
                        ) : (
                          responses.map((resp, i) => (
                            <span
                              key={resp.id}
                              className={`font-display uppercase tracking-wider ${
                                i % 3 === 0
                                  ? "text-3xl text-primary sm:text-5xl"
                                  : i % 2 === 0
                                  ? "text-2xl text-secondary sm:text-4xl"
                                  : "text-xl text-foreground sm:text-3xl"
                              }`}
                            >
                              {resp.text_answer}
                            </span>
                          ))
                        )}
                      </div>
                    )}

                    {(currentActivity?.kind === "poll" || currentActivity?.kind === "quiz") && (
                      <div className="space-y-3 py-4">
                        {options.map((option, index) => {
                          const count = responses.filter((r) => r.option_id === option.id).length;
                          const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                          return (
                            <div key={option.id} className="space-y-1.5">
                              <div className="flex justify-between text-sm font-semibold">
                                <span className="flex items-center gap-2">
                                  <span className="font-display text-xs text-primary">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  {option.label}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {count} votes ({pct}%)
                                </span>
                              </div>
                              <div className="h-3 w-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentActivity?.kind === "rating" && (
                      <div className="space-y-2 py-4 max-h-60 overflow-y-auto">
                        {responses.filter((resp) => resp.text_answer).length === 0 ? (
                          <p className="text-sm italic text-muted-foreground text-center py-6">
                            Words of encouragement for the minister will appear here as they arrive…
                          </p>
                        ) : (
                          responses
                            .filter((resp) => resp.text_answer)
                            .map((resp) => (
                              <div
                                key={resp.id}
                                className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border border-border bg-background p-3 text-sm"
                              >
                                <Heart className="mt-0.5 size-4 text-secondary" />
                                <p className="text-foreground">{resp.text_answer}</p>
                              </div>
                            ))
                        )}
                      </div>
                    )}

                    {currentActivity?.kind === "challenge" && (
                      <div className="space-y-2 py-4 max-h-60 overflow-y-auto">
                        {responses.length === 0 ? (
                          <p className="text-sm italic text-muted-foreground text-center py-6">
                            Waiting for participants to submit their answers…
                          </p>
                        ) : (
                          responses.map((resp) => (
                            <div key={resp.id} className="border border-border bg-background p-3 text-sm">
                              <p className="text-foreground">{resp.text_answer}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] border-t border-border pt-4 text-sm text-muted-foreground items-center">
                  <span>{responses.length} real responses received</span>
                  <Button
                    variant="broadcast"
                    size="sm"
                    onClick={() => activeSession && void requestJoin(activeSession.join_code)}
                  >
                    Submit your answer <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </article>

              {/* Upcoming Run of Show Card */}
              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="bg-secondary px-3 py-1 text-xs font-bold uppercase text-secondary-foreground">
                    Run of show
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{allActivities.length} planned</span>
                </div>
                <h3 className="mt-4 font-display text-xl uppercase">Live Order</h3>
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {allActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3">No moments queued yet.</p>
                  ) : (
                    allActivities.map((act, index) => {
                      const isCurrent = act.id === currentActivity?.id;
                      const isLive = activeSession?.status === "live" && act.is_published;
                      return (
                        <div
                          key={act.id}
                          className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border p-2.5 text-xs ${
                            isCurrent
                              ? "border-primary bg-primary/10 font-bold text-primary"
                              : isLive
                                ? "border-primary/40 text-foreground"
                                : "border-border text-muted-foreground"
                          }`}
                        >
                          <span className="font-display">{String(index + 1).padStart(2, "0")}</span>
                          <span className="flex min-w-0 items-center gap-2">
                            {isLive && <span className="size-1.5 shrink-0 rounded-full bg-live animate-live" />}
                            <span className="truncate">{act.prompt}</span>
                          </span>
                          <span className="uppercase text-[10px]">{kindLabel(act.kind)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>

              {/* Real Participants / Leaderboard Card */}
              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl uppercase">Top Participants</h3>
                  <Trophy className="text-secondary size-5" />
                </div>
                {topLeaders.length === 0 ? (
                  <p className="mt-6 text-xs text-muted-foreground italic py-4 text-center">
                    No scored participants yet. Join live to put your name on the board!
                  </p>
                ) : (
                  <ol className="mt-6 space-y-3">
                    {topLeaders.map((leader, index) => {
                      const maxScore = topLeaders[0]?.score || 1;
                      const pct = Math.max(15, Math.round((leader.score / maxScore) * 100));
                      return (
                        <li key={leader.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-center">
                          <span className="font-display text-sm text-primary font-bold">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs font-semibold">
                              <b className="truncate">{leader.nickname}</b>
                              <span className="font-mono">{leader.score.toLocaleString()} pts</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full bg-muted">
                              <div
                                className={`h-full ${index === 0 ? "bg-primary" : "bg-secondary"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>

              {/* Live Room Action Banner */}
              <article className="border border-secondary/40 bg-card p-5 sm:p-7 lg:col-span-12">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase text-secondary">
                      Active Live Stage · Room {activeSession?.join_code ?? "260018"}
                    </p>
                    <h3 className="mt-1 font-display text-2xl uppercase sm:text-3xl">
                      {activeSession?.title ?? "Gospel Jamz Live"}
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="broadcast"
                      size="lg"
                      onClick={() => activeSession && void requestJoin(activeSession.join_code)}
                    >
                      Join live room now <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Event Narrative Section */}
        <section className="border-b border-border bg-card px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-secondary">More than watching</p>
              <h2 className="mt-3 font-display text-3xl uppercase sm:text-5xl">
                The audience becomes part of the moment.
              </h2>
            </div>
            <div className="mt-10 grid border-y border-border md:grid-cols-3">
              {moments.map(({ icon: Icon, number, title, copy }) => (
                <article
                  key={title}
                  className="border-b border-border py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
                >
                  <div className="flex items-center justify-between text-primary">
                    <Icon className="size-6" />
                    <span className="font-display text-sm">{number}</span>
                  </div>
                  <h3 className="mt-8 font-display text-xl uppercase">{title}</h3>
                  <p className="mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Programme Section */}
        <section id="programme" className="scroll-mt-16 px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                  <CalendarDays className="size-4" /> Final event order
                </p>
                <h2 className="mt-3 font-display text-4xl uppercase sm:text-5xl">
                  Three days.<br />
                  One creative gathering.
                </h2>
                <p className="mt-5 max-w-[42ch] text-muted-foreground">
                  Your live screen will always show what is happening now and what comes next.
                </p>
              </div>
              <ol className="border-t border-border">
                {programme.map((item, index) => (
                  <li
                    key={item.title}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-border py-6 sm:grid-cols-[6rem_7rem_minmax(0,1fr)]"
                  >
                    <span className="font-display text-sm text-primary font-bold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="hidden text-sm text-muted-foreground sm:block">
                      {item.day}
                      <br />
                      <b className="text-foreground">{item.time}</b>
                    </span>
                    <div>
                      <h3 className="font-display text-lg uppercase">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground sm:hidden">
                        {item.day} · {item.time}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-display text-xl uppercase">Gospel Jamz 2026</p>
            <p className="mt-1 text-sm text-muted-foreground">To live is Christ.</p>
          </div>
          <p className="text-xs uppercase text-muted-foreground">16–18 October · The Power House Int'l</p>
        </div>
      </footer>

      {/* Nickname Join Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">Step into the room</DialogTitle>
            <DialogDescription>
              Choose the nickname everyone will see on the live board during voting and games.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={joinSession} className="space-y-4 pt-2">
            <Input
              autoFocus
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              maxLength={24}
              placeholder="Your nickname (e.g. JoyfulPraise)"
              className="h-12"
              required
            />
            {message && (
              <p role="status" className="border-l-2 border-secondary pl-3 text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <Button variant="broadcast" size="lg" className="w-full" disabled={joining}>
              {joining ? <LoaderCircle className="size-5 animate-spin" /> : <Mic2 className="size-5" />}
              Join Room {code}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function kindLabel(kind: string) {
  return {
    quiz: "Quiz",
    poll: "Verdict / Poll",
    word_cloud: "Word Cloud",
    rating: "Feedback",
    challenge: "Challenge",
  }[kind] ?? kind;
}