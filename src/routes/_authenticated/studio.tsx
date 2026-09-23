import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Copy,
  ExternalLink,
  Gavel,
  Heart,
  LoaderCircle,
  Lock,
  MessageCircleQuestion,
  Monitor,
  Play,
  Plus,
  Radio,
  Save,
  Share2,
  Sparkles,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  broadcastLiveSync,
  forgetHostPasscode,
  getHostPasscode,
  lockHostStudio,
  rememberHostPasscode,
  useLiveSyncListener,
} from "@/lib/live-sync";
import { fetchResponses, sortLiveMoments, uniqueTopic } from "@/lib/rooms";

type Kind = Database["public"]["Enums"]["activity_kind"];
type Activity = Tables<"activities">;
type Session = Tables<"event_sessions">;
type Option = Tables<"activity_options">;
type ResponseRow = Tables<"responses">;
type Participant = Tables<"participants">;
type Template = {
  title: string;
  description: string;
  kind: Kind;
  prompt: string;
  options?: string[];
  icon: typeof Gavel;
};
type Draft = {
  kind: Kind;
  prompt: string;
  duration: number;
  points: number;
  options: string[];
  correctIndex: number;
};
type Confirmation = { title: string; body: string; action: string; run: () => Promise<void> };
type PasscodeRequest = { run: (passcode: string) => Promise<void> };

const templates: Template[] = [
  {
    title: "Drama verdict",
    description: "A bold red-or-green decision for live drama judging.",
    kind: "poll",
    prompt: "What is your verdict?",
    options: ["Not guilty", "Guilty"],
    icon: Gavel,
  },
  {
    title: "Panel questions",
    description: "Let the audience submit questions from their seats.",
    kind: "word_cloud",
    prompt: "What would you like to ask the panel?",
    icon: MessageCircleQuestion,
  },
  {
    title: "Minister feedback",
    description: "Let the audience write words of encouragement for the minister.",
    kind: "rating",
    prompt: "How did this ministration speak to you?",
    icon: Heart,
  },
  {
    title: "Quick quiz",
    description: "Create a scored question with your own answer choices.",
    kind: "quiz",
    prompt: "Which of these was the key theme tonight?",
    options: ["Faith in action", "Unwavering hope", "Sacrificial love", "Enduring joy"],
    icon: Sparkles,
  },
  {
    title: "Open challenge",
    description: "Prompt the audience for creative thoughts or testimonies.",
    kind: "challenge",
    prompt: "Share your testimony in 10 words",
    icon: Share2,
  },
];

const emptyDraft: Draft = {
  kind: "poll",
  prompt: "",
  duration: 45,
  points: 0,
  options: ["Not guilty", "Guilty"],
  correctIndex: 0,
};

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Host Studio — Gospel Jamz 2026" },
      {
        name: "description",
        content: "Create, arrange and run Gospel Jamz votes, questions, feedback and games.",
      },
      { property: "og:title", content: "Host Studio — Gospel Jamz 2026" },
      {
        property: "og:description",
        content: "Run every live Gospel Jamz interaction from one control room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<string, Option[]>>({});
  const [liveResponses, setLiveResponses] = useState<Record<string, ResponseRow[]>>({});
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [players, setPlayers] = useState<Participant[]>([]);
  const [playerCount, setPlayerCount] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Gospel Jamz Live");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [passcodePrompt, setPasscodePrompt] = useState<PasscodeRequest | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [checkingPasscode, setCheckingPasscode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => sessions.find((item) => item.id === selectedId) ?? null,
    [selectedId, sessions],
  );
  const roomLive = selected?.status === "live";
  const liveMoments = useMemo(
    () =>
      roomLive
        ? sortLiveMoments(
            activities.filter((activity) => activity.is_published),
            selected?.current_activity_id ?? null,
          )
        : [],
    [activities, roomLive, selected?.current_activity_id],
  );

  const loadSessions = useCallback(async (preferredId?: string) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMessage(`Could not load rooms: ${error.message}`);

    const next = data ?? [];
    setSessions(next);
    setSelectedId(
      (current) =>
        preferredId ??
        (current && next.some((item) => item.id === current) ? current : (next[0]?.id ?? null)),
    );
    setLoading(false);
  }, []);

  // Ignore results from a room the host has already switched away from.
  const roomRequest = useRef<string | null>(null);

  const loadRoom = useCallback(async (sessionId: string) => {
    roomRequest.current = sessionId;
    const [{ data: acts }, { data: people, count }] = await Promise.all([
      supabase.from("activities").select("*").eq("session_id", sessionId).order("position"),
      supabase
        .from("participants")
        .select("*", { count: "exact" })
        .eq("session_id", sessionId)
        .order("score", { ascending: false })
        .order("joined_at")
        .limit(200),
    ]);

    const list = acts ?? [];
    const ids = list.map((activity) => activity.id);
    const liveIds = list.filter((activity) => activity.is_published).map((activity) => activity.id);

    const [optionRows, counts, liveRows] = await Promise.all([
      ids.length
        ? supabase
            .from("activity_options")
            .select("*")
            .in("activity_id", ids)
            .order("position")
            .then(({ data }) => data ?? [])
        : Promise.resolve([] as Option[]),
      Promise.all(
        ids.map((id) =>
          supabase
            .from("responses")
            .select("id", { count: "exact", head: true })
            .eq("activity_id", id)
            .then(({ count: total }) => [id, total ?? 0] as const),
        ),
      ),
      fetchResponses(liveIds),
    ]);

    if (roomRequest.current !== sessionId) return;

    const groupedOptions: Record<string, Option[]> = {};
    for (const option of optionRows) (groupedOptions[option.activity_id] ??= []).push(option);
    const groupedResponses: Record<string, ResponseRow[]> = {};
    for (const row of liveRows) (groupedResponses[row.activity_id] ??= []).push(row);

    setActivities(list);
    setOptionsMap(groupedOptions);
    setResponseCounts(Object.fromEntries(counts));
    setLiveResponses(groupedResponses);
    setPlayers(people ?? []);
    setPlayerCount(count ?? people?.length ?? 0);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setActivities([]);
    setOptionsMap({});
    setLiveResponses({});
    setResponseCounts({});
    setPlayers([]);
    setPlayerCount(0);
    if (selectedId) void loadRoom(selectedId);
  }, [selectedId, loadRoom]);

  // Coalesce bursts of realtime events (a wave of votes) into one refresh.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const reloadTimer = useRef<number | undefined>(undefined);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      void loadSessions();
      if (selectedIdRef.current) void loadRoom(selectedIdRef.current);
    }, 400);
  }, [loadRoom, loadSessions]);

  useEffect(() => () => window.clearTimeout(reloadTimer.current), []);

  const liveIdsKey = liveMoments.map((moment) => moment.id).join(",");
  useEffect(() => {
    if (!selectedId) return;
    let channel = supabase
      .channel(uniqueTopic(`studio-${selectedId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_sessions" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
          filter: `session_id=eq.${selectedId}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${selectedId}`,
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
      );

    if (liveIdsKey) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "responses",
          filter: `activity_id=in.(${liveIdsKey})`,
        },
        scheduleReload,
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, liveIdsKey, scheduleReload]);

  useLiveSyncListener(scheduleReload);

  /** Run a host action, report failures, then tell every screen to refresh. */
  async function perform(
    action: () => Promise<{ error: { message: string } | null } | void>,
    success: string,
    sync: Parameters<typeof broadcastLiveSync>[0]["type"] = "SESSION_UPDATED",
  ) {
    if (!selected) return;
    setWorking(true);
    setMessage("");
    const result = await action();
    setWorking(false);
    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    broadcastLiveSync({ type: sync, sessionId: selected.id, joinCode: selected.join_code });
    await Promise.all([loadSessions(selected.id), loadRoom(selected.id)]);
    setMessage(success);
  }

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");

    // Retry on the rare clash with an existing six-digit code.
    let created: Session | null = null;
    let failure = "";
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const joinCode = String(Math.floor(100000 + Math.random() * 900000));
      const { data, error } = await supabase
        .from("event_sessions")
        .insert({ title: eventTitle.trim(), join_code: joinCode, status: "live" })
        .select("*")
        .single();
      if (data) created = data;
      else if (error && error.code !== "23505") {
        failure = error.message;
        break;
      }
    }

    setWorking(false);
    if (!created) {
      setMessage(failure || "Could not create the room. Please try again.");
      return;
    }

    setCreateOpen(false);
    broadcastLiveSync({
      type: "SESSION_UPDATED",
      sessionId: created.id,
      joinCode: created.join_code,
    });
    await loadSessions(created.id);
    setMessage(`Room "${created.title}" is open with join code ${created.join_code}.`);
  }

  function openTemplate(template?: Template) {
    setDraft(
      template
        ? {
            kind: template.kind,
            prompt: template.prompt,
            duration: 45,
            points: template.kind === "quiz" ? 1000 : 0,
            options: template.options ?? [],
            correctIndex: 0,
          }
        : emptyDraft,
    );
    setBuilderOpen(true);
    setMessage("");
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setWorking(true);
    setMessage("");

    const nextPosition = activities.reduce((max, item) => Math.max(max, item.position + 1), 0);
    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        session_id: selected.id,
        kind: draft.kind,
        prompt: draft.prompt.trim(),
        duration_seconds: draft.duration,
        points: draft.kind === "quiz" ? draft.points : 0,
        position: nextPosition,
        is_published: false,
      })
      .select("*")
      .single();

    if (error || !activity) {
      setWorking(false);
      setMessage(error?.message ?? "Could not add this moment.");
      return;
    }

    const cleanOptions = draft.options.map((label) => label.trim()).filter(Boolean);
    if ((draft.kind === "poll" || draft.kind === "quiz") && cleanOptions.length >= 2) {
      const { data: savedOptions, error: optionError } = await supabase
        .from("activity_options")
        .insert(
          cleanOptions.map((label, position) => ({
            activity_id: activity.id,
            label,
            position,
            is_correct: draft.kind === "quiz" && position === draft.correctIndex,
          })),
        )
        .select("id,position");

      if (optionError) {
        setWorking(false);
        setMessage(optionError.message);
        return;
      }

      if (draft.kind === "quiz") {
        const correct = savedOptions?.find((option) => option.position === draft.correctIndex);
        if (correct) {
          const { error: answerError } = await supabase
            .from("activity_answers")
            .insert({ activity_id: activity.id, correct_option_id: correct.id });
          if (answerError) console.warn("Could not save answer:", answerError.message);
        }
      }
    }

    setWorking(false);
    setBuilderOpen(false);
    broadcastLiveSync({
      type: "SESSION_UPDATED",
      sessionId: selected.id,
      joinCode: selected.join_code,
    });
    await loadRoom(selected.id);
    setMessage(`"${activity.prompt}" added. Press Go live to send it to the room.`);
  }

  function goLive(activity: Activity) {
    return perform(
      async () => {
        const { error } = await supabase
          .from("activities")
          .update({ is_published: true })
          .eq("id", activity.id);
        if (error) return { error };
        return supabase
          .from("event_sessions")
          .update({ status: "live", current_activity_id: activity.id })
          .eq("id", selected!.id);
      },
      `"${activity.prompt}" is live on audience screens.`,
      "ACTIVITY_LAUNCHED",
    );
  }

  function endMoment(activity: Activity) {
    return perform(async () => {
      const { error } = await supabase
        .from("activities")
        .update({ is_published: false })
        .eq("id", activity.id);
      if (error) return { error };
      if (selected!.current_activity_id !== activity.id) return;
      // Hand the big screen to the next live moment, if any.
      const next = liveMoments.find((moment) => moment.id !== activity.id) ?? null;
      return supabase
        .from("event_sessions")
        .update({ current_activity_id: next?.id ?? null })
        .eq("id", selected!.id);
    }, `"${activity.prompt}" has ended.`);
  }

  function showOnBigScreen(activity: Activity) {
    return perform(
      async () =>
        supabase
          .from("event_sessions")
          .update({ current_activity_id: activity.id })
          .eq("id", selected!.id),
      `"${activity.prompt}" is now on the big screen.`,
    );
  }

  async function endAllMoments() {
    const { error } = await supabase
      .from("activities")
      .update({ is_published: false })
      .eq("session_id", selected!.id)
      .eq("is_published", true);
    if (error) return { error };
    return supabase
      .from("event_sessions")
      .update({ current_activity_id: null })
      .eq("id", selected!.id);
  }

  function closeRoom() {
    return perform(
      async () => {
        const ended = await endAllMoments();
        if (ended?.error) return ended;
        return supabase.from("event_sessions").update({ status: "closed" }).eq("id", selected!.id);
      },
      "The room is closed. Players can't answer until you open it again.",
      "ROOM_CLOSED",
    );
  }

  function openRoom() {
    return perform(
      async () => supabase.from("event_sessions").update({ status: "live" }).eq("id", selected!.id),
      `The room is open. Players can join with code ${selected!.join_code}.`,
    );
  }

  function confirmRemoveMoment(activity: Activity) {
    setConfirmation({
      title: "Remove this moment?",
      body: `"${activity.prompt}" and all ${responseCounts[activity.id] ?? 0} of its responses will be deleted.`,
      action: "Remove moment",
      run: () =>
        perform(
          async () => supabase.from("activities").delete().eq("id", activity.id),
          "Moment removed.",
        ),
    });
  }

  function confirmDeleteRoom() {
    if (!selected) return;
    const room = selected;
    setConfirmation({
      title: `Delete ${room.title}?`,
      body: `Room ${room.join_code}, its ${activities.length} moments, ${playerCount} players and all their answers will be permanently deleted.`,
      action: "Delete room",
      run: async () => {
        setWorking(true);
        const { error } = await supabase.from("event_sessions").delete().eq("id", room.id);
        setWorking(false);
        if (error) {
          setMessage(error.message);
          return;
        }
        broadcastLiveSync({ type: "ROOM_CLOSED", sessionId: room.id, joinCode: room.join_code });
        setSelectedId(null);
        await loadSessions();
        setMessage(`Room ${room.join_code} was deleted.`);
      },
    });
  }

  /** Run a host-only database change, asking for the passcode first if this tab hasn't got it. */
  async function withHostPasscode(run: (passcode: string) => Promise<void>) {
    const passcode = getHostPasscode();
    if (passcode) return run(passcode);
    setPasscodeInput("");
    setPasscodeError("");
    setPasscodePrompt({ run });
  }

  async function submitPasscode(event: React.FormEvent) {
    event.preventDefault();
    if (!passcodePrompt) return;
    setCheckingPasscode(true);
    setPasscodeError("");
    const { data, error } = await supabase.rpc("check_host_passcode", {
      p_passcode: passcodeInput,
    });
    setCheckingPasscode(false);
    if (error) {
      setPasscodeError(hostRpcError(error));
      return;
    }
    if (!data) {
      setPasscodeError("That passcode is incorrect.");
      return;
    }
    rememberHostPasscode(passcodeInput);
    const pending = passcodePrompt;
    setPasscodePrompt(null);
    await pending.run(passcodeInput.trim().toUpperCase());
  }

  function confirmRemovePlayer(player: Participant) {
    setConfirmation({
      title: `Remove ${player.nickname}?`,
      body: `${player.nickname} will be taken out of room ${selected?.join_code} and their answers deleted. They can rejoin with a new nickname while the room is open.`,
      action: "Remove player",
      run: () =>
        withHostPasscode((passcode) =>
          perform(async () => {
            const { error } = await supabase.rpc("host_remove_participant", {
              p_passcode: passcode,
              p_participant_id: player.id,
            });
            return error ? { error: { message: hostRpcError(error) } } : undefined;
          }, `${player.nickname} was removed from the room.`),
        ),
    });
  }

  function confirmRemoveAllPlayers() {
    if (!selected) return;
    const room = selected;
    setConfirmation({
      title: "Remove every player?",
      body: `All ${playerCount} players in room ${room.join_code} and all their answers will be deleted. Your moments stay. Use this to clear test joins before the event.`,
      action: "Remove all players",
      run: () =>
        withHostPasscode((passcode) =>
          perform(async () => {
            const { error } = await supabase.rpc("host_remove_all_participants", {
              p_passcode: passcode,
              p_session_id: room.id,
            });
            return error ? { error: { message: hostRpcError(error) } } : undefined;
          }, `Room ${room.join_code} is empty. Every player was removed.`),
        ),
    });
  }

  function handleLock() {
    lockHostStudio();
    void navigate({ to: "/auth" });
  }

  function copyJoinCode() {
    if (!selected) return;
    void navigator.clipboard.writeText(selected.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-primary">
        <LoaderCircle className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4 lg:px-10 bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center bg-primary text-primary-foreground">
              <Radio className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-lg uppercase">Host Studio</h1>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Live Control
                </span>
              </div>
              <p className="text-xs uppercase text-muted-foreground">Gospel Jamz 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLock}
              className="gap-1.5 text-xs uppercase"
              title="Lock Studio and return to passcode screen"
            >
              <Lock className="size-3.5" /> Lock
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Back to event">
              <Link to="/">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Sidebar: Event Rooms */}
          <aside className="border-b border-border pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Event Rooms
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreateOpen(true)}
                className="gap-1 text-xs text-primary"
              >
                <Plus className="size-3.5" /> New
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {sessions.length === 0 ? (
                <div className="border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No rooms created yet.
                </div>
              ) : (
                sessions.map((item) => (
                  <Button
                    key={item.id}
                    variant={item.id === selectedId ? "signal" : "ghost"}
                    onClick={() => setSelectedId(item.id)}
                    className="h-auto w-full justify-between px-3 py-3 text-left transition-all"
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-sm font-semibold">{item.title}</b>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-primary font-bold">
                          Code {item.join_code}
                        </span>
                        <span>·</span>
                        <span
                          className={
                            item.status === "live"
                              ? "text-live font-semibold uppercase"
                              : "uppercase"
                          }
                        >
                          {item.status === "live" ? "Open" : "Closed"}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 opacity-60" />
                  </Button>
                ))
              )}
            </div>

            <Button variant="outline" className="mt-5 w-full" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Create new room
            </Button>
          </aside>

          {/* Main workspace */}
          <section className="min-w-0">
            {!selected ? (
              <EmptyStudio onCreate={() => setCreateOpen(true)} />
            ) : (
              <>
                {/* Room banner */}
                <div className="grid gap-5 border-b border-border pb-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${roomLive ? "bg-live animate-live" : "bg-muted-foreground"}`}
                      />
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {roomLive ? "Room open · Players can join" : "Room closed"}
                      </p>
                    </div>

                    <h2 className="mt-2 truncate font-display text-3xl uppercase sm:text-4xl">
                      {selected.title}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        Join code:{" "}
                        <button
                          type="button"
                          onClick={copyJoinCode}
                          className="font-mono text-base font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                          title="Click to copy code"
                        >
                          {selected.join_code}
                          <Copy className="size-3.5 text-muted-foreground" />
                        </button>
                        {copied && <span className="text-xs text-primary font-bold">Copied!</span>}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" /> {playerCount} in room
                      </span>
                      <span>·</span>
                      <span>
                        {liveMoments.length} live · {activities.length} moments
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/play/$code" params={{ code: selected.join_code }} target="_blank">
                        <ExternalLink className="size-3.5" /> Player view
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href="/#live-board" target="_blank" rel="noreferrer">
                        <Monitor className="size-3.5" /> Big screen
                      </a>
                    </Button>
                    {roomLive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void closeRoom()}
                        disabled={working}
                      >
                        <CircleStop className="size-3.5" /> Close room
                      </Button>
                    ) : (
                      <Button
                        variant="broadcast"
                        size="sm"
                        onClick={() => void openRoom()}
                        disabled={working}
                      >
                        <Play className="size-3.5" /> Open room
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete room"
                      title="Delete room"
                      onClick={confirmDeleteRoom}
                      disabled={working}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {message && (
                  <div
                    role="status"
                    className="mt-5 flex items-center justify-between gap-3 border-l-2 border-primary bg-card px-4 py-3 text-sm"
                  >
                    <span>{message}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMessage("")}
                      className="h-auto p-1 text-xs"
                    >
                      Dismiss
                    </Button>
                  </div>
                )}

                {/* Live now: every moment currently on audience screens */}
                <section className="mt-8">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-live">
                        <span
                          className={`size-2 rounded-full ${liveMoments.length ? "bg-live animate-live" : "bg-muted-foreground"}`}
                        />
                        On audience screens
                      </p>
                      <h3 className="mt-1 font-display text-xl uppercase">
                        Live now ({liveMoments.length})
                      </h3>
                    </div>
                    {liveMoments.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() => void perform(endAllMoments, "All live moments have ended.")}
                      >
                        <CircleStop className="size-3.5" /> End all
                      </Button>
                    )}
                  </div>

                  {liveMoments.length === 0 ? (
                    <div className="mt-4 border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                      {roomLive
                        ? "Nothing is live yet. Press Go live on any moment below. You can run several at once."
                        : "This room is closed. Open it to let people join and answer."}
                    </div>
                  ) : (
                    <div
                      className={`mt-4 grid gap-4 ${liveMoments.length > 1 ? "xl:grid-cols-2" : ""}`}
                    >
                      {liveMoments.map((moment) => (
                        <LiveMonitor
                          key={moment.id}
                          activity={moment}
                          options={optionsMap[moment.id] ?? []}
                          responses={liveResponses[moment.id] ?? []}
                          onBigScreen={moment.id === selected.current_activity_id}
                          disabled={working}
                          onShowOnBigScreen={() => void showOnBigScreen(moment)}
                          onEnd={() => void endMoment(moment)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Run of show */}
                <section className="mt-10">
                  <div className="border-b border-border pb-3">
                    <p className="text-xs font-semibold uppercase text-primary tracking-wider">
                      Run of show
                    </p>
                    <h3 className="mt-1 font-display text-xl uppercase">
                      Moments ({activities.length})
                    </h3>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">
                      Quick add
                    </span>
                    {templates.map((template) => (
                      <Button
                        key={template.title}
                        type="button"
                        variant="outline"
                        size="sm"
                        title={template.description}
                        onClick={() => openTemplate(template)}
                      >
                        <template.icon className="size-3.5 text-primary" /> {template.title}
                      </Button>
                    ))}
                    <Button variant="broadcast" size="sm" onClick={() => openTemplate()}>
                      <Plus className="size-3.5" /> Custom
                    </Button>
                  </div>

                  {activities.length === 0 ? (
                    <div className="mt-6 border border-dashed border-border py-12 text-center">
                      <p className="font-display text-lg uppercase">No moments added yet</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Use Quick add above, or Custom to build one from scratch.
                      </p>
                    </div>
                  ) : (
                    <ol className="mt-4 divide-y divide-border border-t border-border">
                      {activities.map((activity, index) => {
                        const isLive = roomLive && activity.is_published;
                        return (
                          <li
                            key={activity.id}
                            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4 transition-colors ${
                              isLive ? "bg-primary/5 px-3 border-l-4 border-l-primary" : ""
                            }`}
                          >
                            <span className="font-display text-base text-primary font-bold">
                              {String(index + 1).padStart(2, "0")}
                            </span>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-base">{activity.prompt}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase text-muted-foreground">
                                <span className="font-semibold text-secondary">
                                  {kindLabel(activity.kind)}
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock3 className="size-3" /> {activity.duration_seconds}s
                                </span>
                                {activity.points > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{activity.points} pts</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{responseCounts[activity.id] ?? 0} responses</span>
                                {isLive && (
                                  <span className="inline-flex items-center gap-1 rounded bg-live/20 px-2 py-0.5 text-[10px] font-bold text-live">
                                    <span className="size-1.5 rounded-full bg-live animate-live" />{" "}
                                    LIVE NOW
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Remove moment"
                                title={isLive ? "End it before removing" : "Remove moment"}
                                onClick={() => confirmRemoveMoment(activity)}
                                disabled={working || isLive}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>

                              {isLive ? (
                                <Button
                                  variant="signal"
                                  size="sm"
                                  onClick={() => void endMoment(activity)}
                                  disabled={working}
                                  className="gap-1.5 min-w-24"
                                >
                                  <CircleStop className="size-4" /> End
                                </Button>
                              ) : (
                                <Button
                                  variant="broadcast"
                                  size="sm"
                                  onClick={() => void goLive(activity)}
                                  disabled={working}
                                  className="gap-1.5 min-w-24"
                                >
                                  <Play className="size-4" /> Go live
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                {/* Players who have actually joined */}
                <section className="mt-10">
                  <div className="flex items-end justify-between border-b border-border pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-secondary tracking-wider">
                        In the room
                      </p>
                      <h3 className="mt-1 font-display text-xl uppercase">
                        Players ({playerCount})
                      </h3>
                    </div>
                    {playerCount > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={confirmRemoveAllPlayers}
                        disabled={working}
                      >
                        <UserX className="size-3.5" /> Remove all players
                      </Button>
                    ) : (
                      <Users className="size-5 text-muted-foreground" />
                    )}
                  </div>

                  {players.length === 0 ? (
                    <p className="mt-4 border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                      No one has joined yet. Share code{" "}
                      <b className="font-mono text-foreground">{selected.join_code}</b> to fill the
                      room.
                    </p>
                  ) : (
                    <>
                      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {players.map((player, index) => (
                          <li
                            key={player.id}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border border-border bg-card py-1.5 pl-3 pr-1.5 text-sm"
                          >
                            <span className="font-display text-xs text-primary font-bold">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate font-semibold">{player.nickname}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {player.score.toLocaleString()} pts
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${player.nickname}`}
                              title="Remove player"
                              onClick={() => confirmRemovePlayer(player)}
                              disabled={working}
                              className="size-8 text-muted-foreground hover:text-destructive"
                            >
                              <UserX className="size-4" />
                            </Button>
                          </li>
                        ))}
                      </ol>
                      {playerCount > players.length && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Showing the top {players.length} of {playerCount} players.
                        </p>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">Create Event Room</DialogTitle>
            <DialogDescription>
              A private interactive stage with its own six-digit code for your audience.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createEvent} className="space-y-4 pt-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                Room Title
              </label>
              <Input
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                minLength={3}
                maxLength={80}
                required
                className="h-12"
                placeholder="e.g. Gospel Jamz 2026 Main Stage"
              />
            </div>

            <Button variant="broadcast" size="lg" className="w-full" disabled={working}>
              {working ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Save className="size-5" />
              )}
              Create Event Room
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Build Activity Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">Build Live Moment</DialogTitle>
            <DialogDescription>
              Configure the question or prompt. It will be added to your Run of Show.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveActivity} className="space-y-5 pt-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                Format
              </label>
              <Select
                value={draft.kind}
                onValueChange={(value: Kind) =>
                  setDraft({
                    ...draft,
                    kind: value,
                    points: value === "quiz" ? draft.points || 1000 : 0,
                    options:
                      value === "quiz" || value === "poll"
                        ? draft.options.length >= 2
                          ? draft.options
                          : ["Option one", "Option two"]
                        : [],
                  })
                }
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poll">Audience Vote / Verdict (Poll)</SelectItem>
                  <SelectItem value="quiz">Scored Pop Quiz</SelectItem>
                  <SelectItem value="word_cloud">Live Questions & Word Wall</SelectItem>
                  <SelectItem value="rating">Minister Feedback (Written Encouragement)</SelectItem>
                  <SelectItem value="challenge">Open Audience Challenge</SelectItem>
                </SelectContent>
              </Select>
              {draft.kind === "rating" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Each person writes a short message of encouragement for the minister.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                Prompt / Question
              </label>
              <Textarea
                value={draft.prompt}
                onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
                minLength={3}
                maxLength={240}
                required
                className="min-h-24"
                placeholder="Type the question or challenge shown on screen…"
              />
            </div>

            {(draft.kind === "poll" || draft.kind === "quiz") && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Answer Choices {draft.kind === "quiz" && "(click check to mark correct)"}
                </label>
                <div className="space-y-2">
                  {draft.options.map((option, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input
                        value={option}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            ),
                          })
                        }
                        required
                        placeholder={`Option ${index + 1}`}
                      />
                      {draft.kind === "quiz" && (
                        <Button
                          type="button"
                          size="icon"
                          variant={draft.correctIndex === index ? "signal" : "outline"}
                          onClick={() => setDraft({ ...draft, correctIndex: index })}
                          aria-label={`Mark option ${index + 1} correct`}
                        >
                          <Check className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {draft.options.length < 6 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-primary"
                    onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}
                  >
                    <Plus className="size-3.5" /> Add option
                  </Button>
                )}
              </div>
            )}

            <div className={draft.kind === "quiz" ? "grid grid-cols-2 gap-4" : ""}>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Time (seconds)
                </label>
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={draft.duration}
                  onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}
                />
              </div>

              {draft.kind === "quiz" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                    Points for a correct answer
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    step={100}
                    value={draft.points}
                    onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })}
                  />
                </div>
              )}
            </div>

            <Button variant="broadcast" size="lg" className="w-full" disabled={working}>
              {working ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Save className="size-5" />
              )}
              Save to Run of Show
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Host passcode, checked by the database before removing players */}
      <Dialog
        open={passcodePrompt !== null}
        onOpenChange={(open) => !open && setPasscodePrompt(null)}
      >
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">
              Confirm host passcode
            </DialogTitle>
            <DialogDescription>
              Removing players is checked by the server. Enter the Host Studio passcode once for
              this session.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPasscode} className="space-y-4 pt-2">
            <Input
              type="password"
              autoFocus
              autoComplete="off"
              value={passcodeInput}
              onChange={(event) => setPasscodeInput(event.target.value)}
              placeholder="Host passcode"
              className="h-12 font-mono uppercase tracking-widest"
              required
            />
            {passcodeError && (
              <p
                role="status"
                className="border-l-2 border-secondary pl-3 text-sm text-muted-foreground"
              >
                {passcodeError}
              </p>
            )}
            <Button
              variant="broadcast"
              size="lg"
              className="w-full"
              disabled={checkingPasscode || !passcodeInput.trim()}
            >
              {checkingPasscode ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Lock className="size-5" />
              )}
              Confirm
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm destructive actions */}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl uppercase">
              {confirmation?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const pending = confirmation;
                setConfirmation(null);
                if (pending) void pending.run();
              }}
            >
              {confirmation?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LiveMonitor({
  activity,
  options,
  responses,
  onBigScreen,
  disabled,
  onShowOnBigScreen,
  onEnd,
}: {
  activity: Activity;
  options: Option[];
  responses: ResponseRow[];
  onBigScreen: boolean;
  disabled: boolean;
  onShowOnBigScreen: () => void;
  onEnd: () => void;
}) {
  return (
    <section className="flex flex-col border border-primary/40 bg-card p-5 sm:p-6 chrome-edge">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-live">
            <span className="size-2 bg-live rounded-full animate-live" /> {kindLabel(activity.kind)}
            {onBigScreen && (
              <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                <Monitor className="size-3" /> On big screen
              </span>
            )}
          </span>
          <h4 className="mt-1 font-display text-xl uppercase leading-tight sm:text-2xl">
            {activity.prompt}
          </h4>
          <p className="mt-0.5 text-xs uppercase text-muted-foreground">
            Time: {activity.duration_seconds}s
          </p>
        </div>
        <span className="rounded border border-border bg-background px-3 py-1.5 text-xs font-mono font-bold text-foreground">
          {responses.length} responses
        </span>
      </div>

      <div className="mt-5 flex-1">
        <MomentResults activity={activity} options={options} responses={responses} />
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {!onBigScreen && (
          <Button variant="ghost" size="sm" onClick={onShowOnBigScreen} disabled={disabled}>
            <Monitor className="size-3.5" /> Show on big screen
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onEnd} disabled={disabled}>
          <CircleStop className="size-3.5" /> End
        </Button>
      </div>
    </section>
  );
}

function MomentResults({
  activity,
  options,
  responses,
}: {
  activity: Activity;
  options: Option[];
  responses: ResponseRow[];
}) {
  if (activity.kind === "poll" || activity.kind === "quiz") {
    return (
      <div className="space-y-3">
        {options.map((opt) => {
          const count = responses.filter((r) => r.option_id === opt.id).length;
          const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
          return (
            <div key={opt.id} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-2">
                  {opt.label}
                  {opt.is_correct && (
                    <span className="text-primary font-bold text-[10px]">(Correct)</span>
                  )}
                </span>
                <span className="font-mono text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-3 w-full bg-muted rounded-none overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (activity.kind === "word_cloud") {
    return responses.length === 0 ? (
      <p className="text-sm italic text-muted-foreground py-4 text-center">
        Waiting for audience responses from their phones…
      </p>
    ) : (
      <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
        {responses.map((r) => (
          <span
            key={r.id}
            className="inline-block border border-border bg-background px-3 py-1.5 font-display text-sm uppercase text-foreground"
          >
            {r.text_answer}
          </span>
        ))}
      </div>
    );
  }

  const feedback = activity.kind === "rating";
  return responses.length === 0 ? (
    <p className="text-sm italic text-muted-foreground py-4 text-center">
      {feedback
        ? "Words of encouragement will appear here as they arrive…"
        : "Submissions will appear here as audience submits…"}
    </p>
  ) : (
    <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
      {responses.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border border-border bg-background p-3 text-sm"
        >
          {feedback ? (
            <Heart className="mt-0.5 size-4 text-secondary" />
          ) : (
            <Share2 className="mt-0.5 size-4 text-primary" />
          )}
          <p className="text-foreground">
            {r.text_answer ?? (r.rating ? `${r.rating} out of 5 stars` : "")}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="text-xs font-semibold uppercase text-primary tracking-wider">
        Host Control Room
      </p>
      <h2 className="mt-3 max-w-[15ch] font-display text-4xl uppercase sm:text-5xl">
        Run the room. Shape every moment.
      </h2>
      <p className="mt-5 max-w-[48ch] text-muted-foreground leading-relaxed">
        Launch real verdicts, panel questions, minister feedback, and games directly to your
        audience.
      </p>
      <Button variant="broadcast" size="lg" className="mt-8" onClick={onCreate}>
        <Plus className="size-5" /> Create first event
      </Button>
    </div>
  );
}

/** Plain-language message for a failed host-only database call. */
function hostRpcError(error: { code?: string; message: string }) {
  if (error.code === "PGRST202") {
    return "Removing players needs the latest database update. Ask Lovable to apply the pending Supabase migrations, then try again.";
  }
  if (error.code === "28P01") {
    forgetHostPasscode();
    return "The host passcode was not accepted. Try again and enter it when asked.";
  }
  return error.message;
}

function kindLabel(kind: Kind) {
  return {
    quiz: "Quiz",
    poll: "Verdict / Poll",
    word_cloud: "Panel Questions",
    rating: "Minister Feedback",
    challenge: "Creative Challenge",
  }[kind];
}
