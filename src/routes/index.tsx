import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Mic2, Plus, Radio, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import stageImage from "@/assets/gospel-jamz-stage.jpg";

const DEMO_SESSION = "10000000-0000-4000-8000-000000000001";
type Participant = { id: string; nickname: string; score: number };
type WordResponse = { id: string; text_answer: string | null };

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Gospel Jamz 2026 — Join the Live Experience" },
    { name: "description", content: "Join Gospel Jamz live quizzes, polls, word clouds and creative challenges with your event code." },
    { property: "og:title", content: "Gospel Jamz 2026 — Join the Live Experience" },
    { property: "og:description", content: "Youth Conference Creative Arts Festival, 16–18 October. To live is Christ." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [words, setWords] = useState<WordResponse[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState("");

  async function refreshLive() {
    const [{ data: people }, { data: cloud }] = await Promise.all([
      supabase.from("participants").select("id,nickname,score").eq("session_id", DEMO_SESSION).order("score", { ascending: false }).limit(8),
      supabase.from("responses").select("id,text_answer").eq("activity_id", "20000000-0000-4000-8000-000000000001").not("text_answer", "is", null).limit(40),
    ]);
    setParticipants(people ?? []); setWords(cloud ?? []);
  }

  useEffect(() => {
    void refreshLive();
    const channel = supabase.channel("gospel-jamz-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, refreshLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, refreshLive)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const cloudWords = useMemo(() => {
    const defaults = ["Freedom", "Purpose", "Grace", "Truth", "Peace", "Power"];
    return [...new Set([...words.map((item) => item.text_answer).filter((word): word is string => Boolean(word)), ...defaults])].slice(0, 12);
  }, [words]);

  function requestJoin() {
    if (code.length !== 6) { setJoinError("Enter the six-digit code shown on screen."); return; }
    setJoinError(""); setJoinOpen(true);
  }

  async function joinSession(event: React.FormEvent) {
    event.preventDefault(); setJoining(true); setJoinError("");
    const { data: session } = await supabase.from("event_sessions").select("id").eq("join_code", code).eq("status", "live").maybeSingle();
    if (!session) { setJoining(false); setJoinError("That session is not live. Try demo code 260018."); return; }
    const { data: participant, error } = await supabase.from("participants").insert({ session_id: session.id, nickname: nickname.trim() }).select("id").single();
    setJoining(false);
    if (error || !participant) { setJoinError(error?.message ?? "Could not join right now."); return; }
    sessionStorage.setItem(`gj-participant-${session.id}`, participant.id);
    void navigate({ to: "/play/$code", params: { code } });
  }

  function selectPreviewAnswer(label: string) {
    setSelected(label); setAnswerMessage(label === "John" ? "Correct — +1,000 points!" : "Good try — John is the Beloved Apostle.");
  }

  return <div className="min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
    <header className="border-b border-border px-5 pb-5 pt-7 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-end">
        <div><p className="text-xs font-semibold uppercase text-primary">Youth Conference · Creative Arts Festival</p><h1 className="font-display text-5xl uppercase leading-none sm:text-6xl">Gospel Jamz <span className="text-primary">2026</span></h1></div>
        <div className="md:text-right"><p className="font-display text-xl uppercase text-secondary">To live is Christ</p><p className="text-sm uppercase text-muted-foreground">16th–18th October · The Power House Int'l</p></div>
      </div>
    </header>

    <section className="border-b border-border px-5 py-9 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-1 bg-foreground p-1 text-background md:flex-row md:items-center">
        <div className="flex-1 px-5 py-4"><p className="font-display text-2xl uppercase">Enter access code</p><p className="text-sm opacity-65">Join the current live session and make your voice count.</p></div>
        <div className="flex flex-col gap-2 p-2 sm:flex-row">
          <Input aria-label="Six-digit session code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="h-14 min-w-0 border-background/20 bg-background/5 px-4 font-display text-2xl tracking-[0.28em] text-background placeholder:text-background/20 sm:w-64" />
          <Button variant="studio" size="lg" onClick={requestJoin}>Connect <ArrowRight /></Button>
        </div>
      </div>
      {joinError && !joinOpen && <p className="mx-auto mt-3 max-w-7xl text-sm text-secondary">{joinError}</p>}
      <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-3 text-xs text-muted-foreground"><button className="hover:text-primary" onClick={() => setCode("260018")}>Try demo code: <b className="text-foreground">260018</b></button><Link to="/auth" className="hover:text-primary">Host sign in</Link></div>
    </section>

    <div className="overflow-hidden border-y border-background bg-secondary py-3 text-background"><div className="animate-ticker flex w-max items-center gap-12 px-6 text-sm font-semibold uppercase"><span>Live now: Main Arena</span><i className="size-2 rounded-full bg-background"/><span>14:30 Creative Arts Workshop</span><i className="size-2 rounded-full bg-background"/><span>16:00 Worship Encounter</span><i className="size-2 rounded-full bg-background"/><span>18:00 The Creative Spirit</span><i className="size-2 rounded-full bg-background"/><span>Live now: Main Arena</span><i className="size-2 rounded-full bg-background"/><span>14:30 Creative Arts Workshop</span></div></div>

    <main className="mx-auto grid max-w-7xl grid-cols-12 gap-8 px-5 py-14 lg:px-10">
      <div className="col-span-12 space-y-10 lg:col-span-8">
        <section><div className="mb-4 flex items-center gap-3"><span className="animate-live size-3 rounded-full bg-primary"/><h2 className="font-display text-2xl uppercase">Live interaction · Word cloud</h2></div>
          <div className="chrome-edge border border-border bg-card p-6 sm:p-8"><p className="text-sm font-semibold uppercase text-primary">What does worship mean to you?</p><div className="flex min-h-64 flex-wrap items-center justify-center gap-x-6 gap-y-3 py-8">{cloudWords.map((word, index) => <span key={word} className={`font-display uppercase ${index % 4 === 0 ? "text-5xl text-foreground" : index % 4 === 1 ? "text-3xl text-primary" : index % 4 === 2 ? "text-4xl text-secondary" : "text-2xl text-muted-foreground"}`}>{word}</span>)}</div><div className="flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground"><span>{Math.max(412, words.length)} responses received</span><button onClick={() => { setCode("260018"); setJoinOpen(true); }} className="font-semibold text-primary underline underline-offset-4">Add your word</button></div></div>
        </section>
        <div className="grid gap-8 md:grid-cols-2">
          <section className="chrome-edge flex min-h-[420px] flex-col border border-border bg-card p-6"><div className="mb-6 flex justify-between"><span className="bg-secondary px-2 py-1 font-display text-[10px] uppercase text-secondary-foreground">Pop quiz</span><span className="text-xs text-muted-foreground">Preview round</span></div><h3 className="font-display text-xl uppercase">Which apostle was known as the “Beloved”?</h3><div className="mt-auto space-y-2 pt-6">{["Peter", "Paul", "John", "James"].map((answer) => <Button key={answer} variant={selected === answer ? "signal" : "outline"} className="h-11 w-full justify-between" onClick={() => selectPreviewAnswer(answer)}>{answer}{selected === answer && <Check />}</Button>)}</div>{answerMessage && <p role="status" className="mt-4 text-sm text-primary">{answerMessage}</p>}</section>
          <figure className="relative min-h-[420px] overflow-hidden"><img src={stageImage} alt="Guitarist leading worship on a cyan and gold lit stage" width={1024} height={1024} loading="lazy" className="h-full w-full object-cover"/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-6 pt-24"><p className="font-display text-xl uppercase">The rhythm of faith · 2026 energy</p></div></figure>
        </div>
      </div>

      <aside className="col-span-12 space-y-8 lg:col-span-4">
        <section className="chrome-edge border border-border bg-card p-6"><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-xl uppercase">Top participants</h2><Trophy className="text-secondary" /></div><div className="space-y-5">{participants.slice(0,5).map((person,index)=><div key={person.id} className="flex items-center gap-4"><span className={`font-display ${index===0?"text-primary":"text-muted-foreground"}`}>{String(index+1).padStart(2,"0")}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-sm"><b className="truncate">{person.nickname}</b><span>{person.score.toLocaleString()}</span></div><div className="mt-1 h-1 bg-muted"><div className={index===0?"h-full bg-primary":"h-full bg-secondary"} style={{width:`${Math.max(24,92-index*13)}%`}} /></div></div></div>)}</div></section>
        <section className="bg-primary p-6 text-primary-foreground"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl uppercase">Host panel</h2><Radio /></div><p className="mb-6 max-w-[30ch] text-sm font-medium">Create a quiz, live poll, word cloud or audience challenge in seconds.</p><Button asChild variant="studio" size="lg" className="w-full"><Link to="/auth">Open Host Studio <Plus /></Link></Button></section>
        <section className="border-l-4 border-secondary py-2 pl-6"><p className="text-xs font-semibold uppercase text-secondary">Active challenge</p><h2 className="mt-2 font-display text-xl uppercase">Share your testimony in 10 words</h2><p className="mt-2 text-sm text-muted-foreground">The best three will be featured on the main stage screen.</p><div className="mt-5 flex items-center gap-4 text-xs uppercase text-muted-foreground"><span className="flex items-center gap-1"><Users /> 412 joined</span><span className="flex items-center gap-1"><Sparkles /> Live</span></div></section>
      </aside>
    </main>

    <footer className="border-t border-border px-5 py-10 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row"><div><p className="font-display text-2xl uppercase">GJ2026</p><p className="text-sm text-muted-foreground">The Creative Arts Festival of The Power House Int'l.</p></div><p className="text-sm text-muted-foreground">Built for every voice in the room.</p></div></footer>

    <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="font-display text-2xl uppercase">Step into the session</DialogTitle><DialogDescription>Choose the name everyone will see on the live board.</DialogDescription></DialogHeader><form onSubmit={joinSession} className="space-y-4"><Input autoFocus value={nickname} onChange={(e)=>setNickname(e.target.value)} minLength={2} maxLength={24} placeholder="Your nickname" className="h-12" required />{joinError && <p className="text-sm text-secondary">{joinError}</p>}<Button variant="broadcast" size="lg" className="w-full" disabled={joining}>{joining?<LoaderCircle className="animate-spin"/>:<Mic2/>}Join {code}</Button></form></DialogContent></Dialog>
  </div>;
}