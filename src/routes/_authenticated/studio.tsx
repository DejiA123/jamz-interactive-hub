import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Copy,
  ExternalLink,
  Gavel,
  Heart,
  LayoutTemplate,
  LoaderCircle,
  Lock,
  MessageCircleQuestion,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { broadcastLiveSync, lockHostStudio, useLiveSyncListener } from "@/lib/live-sync";

type Kind = Database["public"]["Enums"]["activity_kind"];
type Activity = Tables<"activities">;
type Session = Tables<"event_sessions">;
type Option = Tables<"activity_options">;
type ResponseRow = Tables<"responses">;
type Template = { title: string; description: string; kind: Kind; prompt: string; options?: string[]; icon: typeof Gavel };

const templates: Template[] = [
  { title: "Drama verdict", description: "A bold red-or-green decision for live drama judging.", kind: "poll", prompt: "What is your verdict?", options: ["Not guilty", "Guilty"], icon: Gavel },
  { title: "Panel questions", description: "Let the audience submit questions from their seats.", kind: "word_cloud", prompt: "What would you like to ask the panel?", icon: MessageCircleQuestion },
  { title: "Minister feedback", description: "Collect an encouraging five-star audience response.", kind: "rating", prompt: "How did this ministration speak to you?", icon: Heart },
  { title: "Quick quiz", description: "Create a scored question with your own answer choices.", kind: "quiz", prompt: "Which of these was the key theme tonight?", options: ["Faith in action", "Unwavering hope", "Sacrificial love", "Enduring joy"], icon: Sparkles },
  { title: "Open challenge", description: "Prompt the audience for creative thoughts or testimonies.", kind: "challenge", prompt: "Share your testimony in 10 words", icon: Share2 },
];

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Host Studio — Gospel Jamz 2026" },
      { name: "description", content: "Create, arrange and run Gospel Jamz votes, questions, feedback and games." },
      { property: "og:title", content: "Host Studio — Gospel Jamz 2026" },
      { property: "og:description", content: "Run every live Gospel Jamz interaction from one control room." },
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
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [participantsCount, setParticipantsCount] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Gospel Jamz Live");
  const [draft, setDraft] = useState<{
    kind: Kind;
    prompt: string;
    duration: number;
    points: number;
    options: string[];
    correctIndex: number;
  }>({
    kind: "poll",
    prompt: "",
    duration: 45,
    points: 0,
    options: ["Not guilty", "Guilty"],
    correctIndex: 0,
  });

  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => sessions.find((item) => item.id === selectedId) ?? null, [selectedId, sessions]);
  const currentActivity = useMemo(() => activities.find((a) => a.id === selected?.current_activity_id) ?? null, [activities, selected]);

  const loadSessions = useCallback(async (preferredId?: string) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not load sessions:", error.message);
    }

    const next = data ?? [];
    setSessions(next);
    setSelectedId(preferredId ?? (next.some((item) => item.id === selectedId) ? selectedId : null) ?? next[0]?.id ?? null);
    setBusy(false);
  }, [selectedId]);

  const loadActivities = useCallback(async (sessionId: string) => {
    const [{ data: actData }, { data: optData }, { data: partData }] = await Promise.all([
      supabase.from("activities").select("*").eq("session_id", sessionId).order("position"),
      supabase.from("activity_options").select("*"),
      supabase.from("participants").select("id").eq("session_id", sessionId),
    ]);

    setActivities(actData ?? []);
    setParticipantsCount(partData?.length ?? 0);

    const map: Record<string, Option[]> = {};
    if (optData) {
      for (const opt of optData) {
        const list = map[opt.activity_id] ?? [];
        list.push(opt);
        map[opt.activity_id] = list;
      }
      for (const actId in map) {
        const items = map[actId];
        if (items) items.sort((a, b) => a.position - b.position);
      }
    }
    setOptionsMap(map);
  }, []);

  const loadLiveResponses = useCallback(async (activityId: string) => {
    const { data } = await supabase
      .from("responses")
      .select("*")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: false });
    setResponses(data ?? []);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedId) {
      void loadActivities(selectedId);
    } else {
      setActivities([]);
      setResponses([]);
    }
  }, [selectedId, loadActivities]);

  useEffect(() => {
    if (selected?.current_activity_id) {
      void loadLiveResponses(selected.current_activity_id);
    } else {
      setResponses([]);
    }
  }, [selected?.current_activity_id, loadLiveResponses]);

  // Listen to realtime responses and sync
  useEffect(() => {
    if (!selected) return;

    const channel = supabase
      .channel(`studio-responses-${selected.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, () => {
        if (selected.current_activity_id) void loadLiveResponses(selected.current_activity_id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${selected.id}` }, () => {
        void loadActivities(selected.id);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selected, loadLiveResponses, loadActivities]);

  // Hook into local broadcast sync
  useLiveSyncListener(() => {
    if (selectedId) {
      void loadActivities(selectedId);
      if (selected?.current_activity_id) {
        void loadLiveResponses(selected.current_activity_id);
      }
    }
  });

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const joinCode = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase
      .from("event_sessions")
      .insert({
        title: eventTitle.trim(),
        join_code: joinCode,
        status: "live",
      })
      .select("*")
      .single();

    setBusy(false);
    if (error || !data) {
      setMessage(error?.message ?? "Could not create the event session.");
      return;
    }

    setCreateOpen(false);
    broadcastLiveSync({ type: "SESSION_UPDATED", sessionId: data.id, joinCode: data.join_code });
    await loadSessions(data.id);
    setMessage(`Event "${data.title}" created with join code ${data.join_code}.`);
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
        : {
            kind: "poll",
            prompt: "",
            duration: 45,
            points: 0,
            options: ["Not guilty", "Guilty"],
            correctIndex: 0,
          }
    );
    setBuilderOpen(true);
    setMessage("");
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");

    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        session_id: selected.id,
        kind: draft.kind,
        prompt: draft.prompt.trim(),
        duration_seconds: draft.duration,
        points: draft.points,
        position: activities.length,
        is_published: false,
      })
      .select("*")
      .single();

    if (error || !activity) {
      setBusy(false);
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
          }))
        )
        .select("id,position");

      if (optionError) {
        setBusy(false);
        setMessage(optionError.message);
        return;
      }

      if (draft.kind === "quiz") {
        const correct = savedOptions?.find((option) => option.position === draft.correctIndex);
        if (correct) {
          const { error: answerError } = await supabase
            .from("activity_answers")
            .insert({ activity_id: activity.id, correct_option_id: correct.id });
          if (answerError) {
            console.warn("Could not save answer:", answerError.message);
          }
        }
      }
    }

    setBusy(false);
    setBuilderOpen(false);
    broadcastLiveSync({ type: "SESSION_UPDATED", sessionId: selected.id, joinCode: selected.join_code });
    await loadActivities(selected.id);
    setMessage(`"${activity.prompt}" added. Click "Launch" to send it live to the room.`);
  }

  async function launch(activity: Activity) {
    if (!selected) return;
    setBusy(true);
    setMessage("");

    const { error: publishError } = await supabase
      .from("activities")
      .update({ is_published: true })
      .eq("id", activity.id);

    const { error: sessionError } = await supabase
      .from("event_sessions")
      .update({ status: "live", current_activity_id: activity.id })
      .eq("id", selected.id);

    setBusy(false);
    if (publishError || sessionError) {
      setMessage(publishError?.message ?? sessionError?.message ?? "Could not launch live.");
      return;
    }

    broadcastLiveSync({
      type: "ACTIVITY_LAUNCHED",
      sessionId: selected.id,
      activityId: activity.id,
      joinCode: selected.join_code,
    });

    await loadSessions(selected.id);
    await loadActivities(selected.id);
    await loadLiveResponses(activity.id);
    setMessage(`"${activity.prompt}" is now LIVE on audience screens.`);
  }

  async function closeRoom() {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from("event_sessions")
      .update({ status: "closed", current_activity_id: null })
      .eq("id", selected.id);

    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    broadcastLiveSync({
      type: "ROOM_CLOSED",
      sessionId: selected.id,
      joinCode: selected.join_code,
    });

    await loadSessions(selected.id);
    setMessage("The live room is now closed.");
  }

  async function removeActivity(id: string) {
    if (!selected) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    broadcastLiveSync({ type: "SESSION_UPDATED", sessionId: selected.id });
    await loadActivities(selected.id);
    setMessage("Moment removed.");
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

  if (busy && sessions.length === 0) {
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
          {/* Sidebar: Event Sessions */}
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
                        <span className="font-mono text-primary font-bold">Code {item.join_code}</span>
                        <span>·</span>
                        <span className={item.status === "live" ? "text-live font-semibold uppercase" : "uppercase"}>
                          {item.status}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 opacity-60" />
                  </Button>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Create new room
            </Button>
          </aside>

          {/* Main workspace */}
          <section className="min-w-0">
            {!selected ? (
              <EmptyStudio onCreate={() => setCreateOpen(true)} />
            ) : (
              <>
                {/* Active Session Header Banner */}
                <div className="grid gap-5 border-b border-border pb-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block size-2 rounded-full ${selected.status === "live" ? "bg-live animate-live" : "bg-muted-foreground"}`} />
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {selected.status === "live" ? "Live Broadcast Active" : "Event Room Paused"}
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
                        <Users className="size-3.5" /> {participantsCount} in room
                      </span>
                      <span>·</span>
                      <span>{activities.length} moments ready</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/play/$code" params={{ code: selected.join_code }} target="_blank">
                        <ExternalLink className="size-3.5" /> Participant View
                      </Link>
                    </Button>
                    {selected.status === "live" && (
                      <Button variant="outline" size="sm" onClick={() => void closeRoom()} disabled={busy}>
                        <CircleStop className="size-3.5" /> Close room
                      </Button>
                    )}
                    <Button variant="broadcast" size="sm" onClick={() => openTemplate()}>
                      <Plus className="size-3.5" /> Add moment
                    </Button>
                  </div>
                </div>

                {message && (
                  <div role="status" className="mt-5 flex items-center justify-between border-l-2 border-primary bg-card px-4 py-3 text-sm">
                    <span>{message}</span>
                    <Button variant="ghost" size="sm" onClick={() => setMessage("")} className="h-auto p-1 text-xs">
                      Dismiss
                    </Button>
                  </div>
                )}

                {/* Real-time Response Monitor for Currently Live Interaction */}
                {currentActivity && (
                  <section className="mt-8 border border-primary/40 bg-card p-5 sm:p-7 chrome-edge">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                      <div>
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-live">
                          <span className="size-2 bg-live rounded-full animate-live" /> Currently on audience screens
                        </span>
                        <h3 className="mt-1 font-display text-2xl uppercase">{currentActivity.prompt}</h3>
                        <p className="mt-0.5 text-xs uppercase text-muted-foreground">
                          Format: {kindLabel(currentActivity.kind)} · Time: {currentActivity.duration_seconds}s
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded border border-border bg-background px-3 py-1.5 text-xs font-mono font-bold text-foreground">
                          {responses.length} responses
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void loadLiveResponses(currentActivity.id)}
                          title="Refresh responses"
                        >
                          <RefreshCw className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Results Display by Kind */}
                    <div className="mt-5">
                      {(currentActivity.kind === "poll" || currentActivity.kind === "quiz") && (
                        <div className="space-y-3">
                          {(optionsMap[currentActivity.id] ?? []).map((opt) => {
                            const count = responses.filter((r) => r.option_id === opt.id).length;
                            const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                            return (
                              <div key={opt.id} className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="flex items-center gap-2">
                                    {opt.label}
                                    {opt.is_correct && <span className="text-primary font-bold text-[10px]">(Correct)</span>}
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
                      )}

                      {currentActivity.kind === "word_cloud" && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                            Audience Questions & Words ({responses.length})
                          </p>
                          {responses.length === 0 ? (
                            <p className="text-sm italic text-muted-foreground py-4 text-center">
                              Waiting for audience responses from their phones…
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {responses.map((r) => (
                                <span
                                  key={r.id}
                                  className="inline-block border border-border bg-background px-3 py-1.5 font-display text-sm uppercase text-foreground"
                                >
                                  {r.text_answer}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {currentActivity.kind === "rating" && (
                        <div>
                          <div className="flex items-center gap-4 py-2">
                            <div className="text-center">
                              <p className="font-display text-4xl text-secondary">
                                {responses.length > 0
                                  ? (responses.reduce((sum, r) => sum + (r.rating ?? 0), 0) / responses.length).toFixed(1)
                                  : "0.0"}
                              </p>
                              <p className="text-[10px] uppercase text-muted-foreground">Average Stars</p>
                            </div>
                            <div className="flex-1 space-y-1">
                              {[5, 4, 3, 2, 1].map((stars) => {
                                const count = responses.filter((r) => r.rating === stars).length;
                                const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                                return (
                                  <div key={stars} className="flex items-center gap-2 text-xs">
                                    <span className="w-10 font-mono text-muted-foreground flex items-center gap-0.5">
                                      {stars} <Star className="size-2.5 fill-current text-secondary" />
                                    </span>
                                    <div className="h-2 flex-1 bg-muted">
                                      <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-6 font-mono text-right text-muted-foreground">{count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {currentActivity.kind === "challenge" && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                            Audience Submissions ({responses.length})
                          </p>
                          {responses.length === 0 ? (
                            <p className="text-sm italic text-muted-foreground py-4 text-center">
                              Submissions will appear here as audience submits…
                            </p>
                          ) : (
                            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                              {responses.map((r) => (
                                <div key={r.id} className="border border-border bg-background p-3 text-sm">
                                  <p className="text-foreground">{r.text_answer}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Templates Grid */}
                <section className="mt-9">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-secondary tracking-wider">Ready-made formats</p>
                      <h3 className="mt-1 font-display text-xl uppercase">Instant Interaction Templates</h3>
                    </div>
                    <LayoutTemplate className="text-muted-foreground size-5" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {templates.map((template) => (
                      <Button
                        key={template.title}
                        type="button"
                        variant="ghost"
                        onClick={() => openTemplate(template)}
                        className="group grid h-auto grid-cols-[auto_minmax(0,1fr)_auto] gap-4 whitespace-normal rounded-none border border-border bg-card p-4 text-left hover:border-primary hover:bg-card transition-all"
                      >
                        <span className="grid size-10 place-items-center bg-muted text-primary">
                          <template.icon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <b className="block font-display text-sm uppercase">{template.title}</b>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {template.description}
                          </span>
                        </span>
                        <Plus className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    ))}
                  </div>
                </section>

                {/* Run of Show: Moments Queue */}
                <section className="mt-10">
                  <div className="flex items-end justify-between border-b border-border pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary tracking-wider">Run of show</p>
                      <h3 className="mt-1 font-display text-xl uppercase">Event Order ({activities.length})</h3>
                    </div>
                    <Button variant="broadcast" size="sm" onClick={() => openTemplate()}>
                      <Plus className="size-3.5" /> Custom moment
                    </Button>
                  </div>

                  {activities.length === 0 ? (
                    <div className="mt-6 border border-dashed border-border py-12 text-center">
                      <p className="font-display text-lg uppercase">No live moments added yet</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Pick a template above or click "Custom moment" to build one from scratch.
                      </p>
                    </div>
                  ) : (
                    <ol className="divide-y divide-border">
                      {activities.map((activity, index) => {
                        const isLive = selected.current_activity_id === activity.id;
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
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs uppercase text-muted-foreground">
                                <span className="font-semibold text-secondary">{kindLabel(activity.kind)}</span>
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
                                {isLive && (
                                  <span className="inline-flex items-center gap-1 rounded bg-live/20 px-2 py-0.5 text-[10px] font-bold text-live">
                                    <span className="size-1.5 rounded-full bg-live animate-live" /> LIVE NOW
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete moment"
                                onClick={() => void removeActivity(activity.id)}
                                disabled={busy || isLive}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>

                              <Button
                                variant={isLive ? "signal" : "broadcast"}
                                size="sm"
                                onClick={() => void launch(activity)}
                                disabled={busy || isLive}
                                className="gap-1.5 min-w-24"
                              >
                                {isLive ? <Check className="size-4" /> : <Play className="size-4" />}
                                <span>{isLive ? "Live" : "Launch"}</span>
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
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

            <Button variant="broadcast" size="lg" className="w-full" disabled={busy}>
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}
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
                  <SelectItem value="rating">Encouragement / Feedback Rating</SelectItem>
                  <SelectItem value="challenge">Open Audience Challenge</SelectItem>
                </SelectContent>
              </Select>
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
                              itemIndex === index ? event.target.value : item
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

            <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Points
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
            </div>

            <Button variant="broadcast" size="lg" className="w-full" disabled={busy}>
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}
              Save to Run of Show
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="text-xs font-semibold uppercase text-primary tracking-wider">Host Control Room</p>
      <h2 className="mt-3 max-w-[15ch] font-display text-4xl uppercase sm:text-5xl">
        Run the room. Shape every moment.
      </h2>
      <p className="mt-5 max-w-[48ch] text-muted-foreground leading-relaxed">
        Launch real verdicts, panel questions, feedback ratings, and games directly to your audience.
      </p>
      <Button variant="broadcast" size="lg" className="mt-8" onClick={onCreate}>
        <Plus className="size-5" /> Create first event
      </Button>
    </div>
  );
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