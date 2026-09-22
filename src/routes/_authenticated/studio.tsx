import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, CircleStop, Clock3, Copy, Gavel, Heart, LayoutTemplate, LoaderCircle, MessageCircleQuestion, Play, Plus, Radio, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

type Kind = Database["public"]["Enums"]["activity_kind"];
type Activity = Tables<"activities">;
type Session = Tables<"event_sessions">;
type Template = { title: string; description: string; kind: Kind; prompt: string; options?: string[]; icon: typeof Gavel };

const templates: Template[] = [
  { title: "Drama verdict", description: "A bold red-or-green decision for live drama judging.", kind: "poll", prompt: "What is your verdict?", options: ["Not guilty", "Guilty"], icon: Gavel },
  { title: "Panel questions", description: "Let the audience submit questions from their seats.", kind: "word_cloud", prompt: "What would you like to ask the panel?", icon: MessageCircleQuestion },
  { title: "Minister feedback", description: "Collect an encouraging five-star audience response.", kind: "rating", prompt: "How did this ministration speak to you?", icon: Heart },
  { title: "Quick quiz", description: "Create a scored question with your own answer choices.", kind: "quiz", prompt: "Type your question here", options: ["Option one", "Option two", "Option three", "Option four"], icon: Sparkles },
];

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [
    { title: "Host Studio — Gospel Jamz 2026" },
    { name: "description", content: "Create, arrange and run Gospel Jamz votes, questions, feedback and games." },
    { property: "og:title", content: "Host Studio — Gospel Jamz 2026" },
    { property: "og:description", content: "Run every live Gospel Jamz interaction from one control room." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: StudioPage,
});

function StudioPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Gospel Jamz Live");
  const [draft, setDraft] = useState<{ kind: Kind; prompt: string; duration: number; points: number; options: string[]; correctIndex: number }>({ kind: "poll", prompt: "", duration: 45, points: 0, options: ["Not guilty", "Guilty"], correctIndex: 0 });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => sessions.find((item) => item.id === selectedId) ?? null, [selectedId, sessions]);

  async function loadSessions(preferredId?: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); return setMessage("Your host session expired. Please sign in again."); }
    const { data } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    const next = data ?? [];
    setSessions(next);
    setSelectedId(preferredId ?? (next.some((item) => item.id === selectedId) ? selectedId : null) ?? next[0]?.id ?? null);
    setBusy(false);
  }

  async function loadActivities(id: string) {
    const { data } = await supabase.from("activities").select("*").eq("session_id", id).order("position");
    setActivities(data ?? []);
  }

  useEffect(() => { void loadSessions(); }, []);
  useEffect(() => { if (selectedId) void loadActivities(selectedId); else setActivities([]); }, [selectedId]);

  async function createEvent(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); return setMessage("Your host session expired. Please sign in again."); }
    const joinCode = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase.from("event_sessions").insert({ owner_id: auth.user.id, title: eventTitle.trim(), join_code: joinCode }).select("*").single();
    setBusy(false);
    if (error || !data) return setMessage(error?.message ?? "Could not create the event.");
    setCreateOpen(false); await loadSessions(data.id); setMessage("Event created. Add your first live moment.");
  }

  function openTemplate(template?: Template) {
    setDraft(template ? { kind: template.kind, prompt: template.prompt, duration: 45, points: template.kind === "quiz" ? 1000 : 0, options: template.options ?? [], correctIndex: 0 } : { kind: "poll", prompt: "", duration: 45, points: 0, options: ["Option one", "Option two"], correctIndex: 0 });
    setBuilderOpen(true); setMessage("");
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setMessage("");
    const { data: activity, error } = await supabase.from("activities").insert({ session_id: selected.id, kind: draft.kind, prompt: draft.prompt.trim(), duration_seconds: draft.duration, points: draft.points, position: activities.length }).select("*").single();
    if (error || !activity) { setBusy(false); return setMessage(error?.message ?? "Could not add this moment."); }
    const cleanOptions = draft.options.map((label) => label.trim()).filter(Boolean);
    if ((draft.kind === "poll" || draft.kind === "quiz") && cleanOptions.length >= 2) {
      const { data: savedOptions, error: optionError } = await supabase.from("activity_options").insert(cleanOptions.map((label, position) => ({ activity_id: activity.id, label, position, is_correct: draft.kind === "quiz" && position === draft.correctIndex }))).select("id,position");
      if (optionError) { setBusy(false); return setMessage(optionError.message); }
      if (draft.kind === "quiz") {
        const correct = savedOptions?.find((option) => option.position === draft.correctIndex);
        if (correct) {
          const { error: answerError } = await supabase.from("activity_answers").insert({ activity_id: activity.id, correct_option_id: correct.id });
          if (answerError) { setBusy(false); return setMessage(answerError.message); }
        }
      }
    }
    setBusy(false); setBuilderOpen(false); await loadActivities(selected.id); setMessage("Live moment added to the event order.");
  }

  async function launch(activity: Activity) {
    if (!selected) return;
    setBusy(true); setMessage("");
    const { error: publishError } = await supabase.from("activities").update({ is_published: true }).eq("id", activity.id);
    const { error: sessionError } = await supabase.from("event_sessions").update({ status: "live", current_activity_id: activity.id }).eq("id", selected.id);
    setBusy(false);
    if (publishError || sessionError) return setMessage(publishError?.message ?? sessionError?.message ?? "Could not go live.");
    await loadSessions(selected.id); await loadActivities(selected.id); setMessage(`“${activity.prompt}” is live now.`);
  }

  async function closeRoom() {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.from("event_sessions").update({ status: "closed", current_activity_id: null }).eq("id", selected.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    await loadSessions(selected.id); setMessage("The live room is now closed.");
  }

  async function removeActivity(id: string) {
    if (!selected) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) return setMessage(error.message);
    await loadActivities(selected.id); setMessage("Moment removed.");
  }

  if (busy && sessions.length === 0) return <div className="grid min-h-screen place-items-center bg-background text-primary"><LoaderCircle className="size-8 animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4 lg:px-10"><div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center bg-primary text-primary-foreground"><Radio className="size-5"/></span><div className="min-w-0"><h1 className="truncate font-display text-lg uppercase">Host Studio</h1><p className="text-xs uppercase text-muted-foreground">Gospel Jamz 2026</p></div></div><Button asChild variant="ghost" size="icon" aria-label="Back to event"><Link to="/"><ArrowLeft/></Link></Button></div></header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="border-b border-border pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted-foreground">Your events</p><Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)} aria-label="Create event"><Plus/></Button></div><div className="mt-4 space-y-2">{sessions.map((item) => <Button key={item.id} variant={item.id === selectedId ? "signal" : "ghost"} onClick={() => setSelectedId(item.id)} className="h-auto w-full justify-between px-3 py-3 text-left"><span className="min-w-0"><b className="block truncate">{item.title}</b><span className="text-xs font-normal text-muted-foreground">Code {item.join_code} · {item.status}</span></span><ChevronRight/></Button>)}</div><Button variant="outline" className="mt-5 w-full" onClick={() => setCreateOpen(true)}><Plus/> New event</Button></aside>

          <section className="min-w-0">
            {!selected ? <EmptyStudio onCreate={() => setCreateOpen(true)} /> : <>
              <div className="grid gap-5 border-b border-border pb-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-primary">{selected.status === "live" ? "Live control room" : "Event builder"}</p><h2 className="mt-2 truncate font-display text-3xl uppercase sm:text-4xl">{selected.title}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>Join code <b className="text-foreground">{selected.join_code}</b></span><span>{activities.length} live moments</span></div></div><div className="flex gap-2">{selected.status === "live" && <Button variant="outline" onClick={() => void closeRoom()} disabled={busy}><CircleStop/> Close room</Button>}<Button variant="broadcast" onClick={() => openTemplate()}><Plus/> Add moment</Button></div></div>

              {message && <p role="status" className="mt-5 border-l-2 border-primary bg-card px-4 py-3 text-sm">{message}</p>}

              <section className="mt-9"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase text-secondary">Ready-made templates</p><h3 className="mt-1 font-display text-xl uppercase">Start with a proven format</h3></div><LayoutTemplate className="text-muted-foreground"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{templates.map((template) => <Button key={template.title} type="button" variant="ghost" onClick={() => openTemplate(template)} className="group grid h-auto grid-cols-[auto_minmax(0,1fr)_auto] gap-4 whitespace-normal rounded-none border border-border bg-card p-4 text-left hover:border-primary hover:bg-card"><span className="grid size-10 place-items-center bg-muted text-primary"><template.icon className="size-5"/></span><span className="min-w-0"><b className="block font-display text-sm uppercase">{template.title}</b><span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{template.description}</span></span><Plus className="size-4 text-muted-foreground group-hover:text-primary"/></Button>)}</div></section>

              <section className="mt-10"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase text-primary">Final event order</p><h3 className="mt-1 font-display text-xl uppercase">Run of show</h3></div><span className="text-xs text-muted-foreground">Launch in any order</span></div>{activities.length === 0 ? <div className="mt-5 border border-dashed border-border py-12 text-center"><p className="font-display uppercase">No live moments yet</p><p className="mt-2 text-sm text-muted-foreground">Choose a template or build one from scratch.</p></div> : <ol className="mt-5 border-t border-border">{activities.map((activity,index)=><li key={activity.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-5"><span className="font-display text-sm text-primary">{String(index+1).padStart(2,"0")}</span><div className="min-w-0"><p className="truncate font-semibold">{activity.prompt}</p><p className="mt-1 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span>{kindLabel(activity.kind)}</span><span className="flex items-center gap-1"><Clock3 className="size-3"/> {activity.duration_seconds}s</span>{selected.current_activity_id === activity.id && <span className="text-live">Live now</span>}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Delete moment" onClick={() => void removeActivity(activity.id)} disabled={busy || selected.current_activity_id === activity.id}><Trash2/></Button><Button variant={selected.current_activity_id === activity.id ? "signal" : "outline"} onClick={() => void launch(activity)} disabled={busy || selected.current_activity_id === activity.id}>{selected.current_activity_id === activity.id ? <Check/> : <Play/>}<span className="hidden sm:inline">{selected.current_activity_id === activity.id ? "Live" : "Launch"}</span></Button></div></li>)}</ol>}</section>
            </>}
          </section>
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="font-display text-2xl uppercase">Create an event</DialogTitle><DialogDescription>A private control room with its own six-digit audience code.</DialogDescription></DialogHeader><form onSubmit={createEvent} className="space-y-4"><Input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} minLength={3} maxLength={80} required className="h-12"/><Button variant="broadcast" size="lg" className="w-full" disabled={busy}><Save/> Create event</Button></form></DialogContent></Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}><DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-xl"><DialogHeader><DialogTitle className="font-display text-2xl uppercase">Build a live moment</DialogTitle><DialogDescription>Everything here can be changed before it enters your event order.</DialogDescription></DialogHeader><form onSubmit={saveActivity} className="space-y-5"><div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Format</label><Select value={draft.kind} onValueChange={(value: Kind) => setDraft({ ...draft, kind: value, options: value === "quiz" || value === "poll" ? (draft.options.length >= 2 ? draft.options : ["Option one", "Option two"]) : [] })}><SelectTrigger className="h-12"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="poll">Audience vote / verdict</SelectItem><SelectItem value="quiz">Scored quiz</SelectItem><SelectItem value="word_cloud">Questions / word wall</SelectItem><SelectItem value="rating">Feedback rating</SelectItem><SelectItem value="challenge">Open challenge</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Prompt</label><Textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} minLength={3} maxLength={240} required className="min-h-24"/></div>{(draft.kind === "poll" || draft.kind === "quiz") && <div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Answer choices</label><div className="space-y-2">{draft.options.map((option,index)=><div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input value={option} onChange={(event) => setDraft({ ...draft, options: draft.options.map((item,itemIndex)=>itemIndex===index?event.target.value:item) })} required placeholder={`Option ${index+1}`}/>{draft.kind === "quiz" && <Button type="button" size="icon" variant={draft.correctIndex === index ? "signal" : "outline"} onClick={() => setDraft({ ...draft, correctIndex: index })} aria-label={`Mark option ${index+1} correct`}><Check/></Button>}</div>)}</div>{draft.kind === "quiz" && <p className="mt-2 text-xs text-muted-foreground">Select the check beside the correct answer.</p>}{draft.options.length < 6 && <Button type="button" variant="ghost" className="mt-2" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}><Plus/> Add option</Button>}</div>}<div className="grid grid-cols-2 gap-4"><div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Time in seconds</label><Input type="number" min={5} max={600} value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}/></div><div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Points</label><Input type="number" min={0} max={10000} step={100} value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })}/></div></div>{message && <p className="text-sm text-secondary">{message}</p>}<Button variant="broadcast" size="lg" className="w-full" disabled={busy}><Save/> Add to event order</Button></form></DialogContent></Dialog>
    </div>
  );
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) { return <div className="flex min-h-[60vh] flex-col items-start justify-center"><p className="text-xs font-semibold uppercase text-primary">Your stage starts here</p><h2 className="mt-3 max-w-[15ch] font-display text-4xl uppercase sm:text-5xl">Create the room. Shape every moment.</h2><p className="mt-5 max-w-[48ch] text-muted-foreground">Build live verdicts, panel questions, feedback and games from ready-made templates.</p><Button variant="broadcast" size="lg" className="mt-8" onClick={onCreate}><Plus/> Create first event</Button></div>; }
function kindLabel(kind: Kind) { return ({ quiz: "Quiz", poll: "Vote", word_cloud: "Questions", rating: "Feedback", challenge: "Challenge" })[kind]; }