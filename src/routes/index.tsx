import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Gavel, Heart, LoaderCircle, MessageCircleQuestion, Mic2, Sparkles, Trophy } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import stageImage from "@/assets/gospel-jamz-stage.jpg";

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

const cloudWords = [
  { word: "FREEDOM", className: "text-4xl sm:text-6xl" },
  { word: "PURPOSE", className: "text-2xl text-primary sm:text-4xl" },
  { word: "GRACE", className: "text-3xl text-secondary sm:text-5xl" },
  { word: "TRUTH", className: "text-xl text-muted-foreground sm:text-3xl" },
  { word: "PEACE", className: "text-3xl sm:text-5xl" },
  { word: "POWER", className: "text-2xl text-primary sm:text-4xl" },
];

const leaders = [
  { name: "Daniel A.", score: "2,450", width: "w-full" },
  { name: "Sarah J.", score: "2,120", width: "w-[84%]" },
  { name: "Marcus W.", score: "1,980", width: "w-[70%]" },
  { name: "GraceFire", score: "1,740", width: "w-[56%]" },
];

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Gospel Jamz 2026 — Join the Live Experience" },
    { name: "description", content: "Join Gospel Jamz live votes, panel questions, feedback and creative challenges with your event code." },
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
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);

  function requestJoin() {
    if (code.length !== 6) return setMessage("Enter the six-digit code shown on screen.");
    setMessage("");
    setJoinOpen(true);
  }

  async function joinSession(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    setMessage("");
    const { data: session } = await supabase.from("event_sessions").select("id").eq("join_code", code).eq("status", "live").maybeSingle();
    if (!session) {
      setJoining(false);
      setMessage("That room is not live. Try the demo code 260018.");
      return;
    }
    const { data: participant, error } = await supabase.from("participants").insert({ session_id: session.id, nickname: nickname.trim() }).select("id").single();
    setJoining(false);
    if (error || !participant) return setMessage(error?.message ?? "Could not join right now.");
    sessionStorage.setItem(`gj-participant-${session.id}`, participant.id);
    void navigate({ to: "/play/$code", params: { code } });
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground selection:bg-primary selection:text-primary-foreground sm:pb-0">
      <AppNavigation />

      <main>
        <section className="relative min-h-[92svh] overflow-hidden border-b border-border">
          <img src={stageImage} alt="Guitarist leading worship under cyan and gold stage lights" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-stage-wash" />
          <div className="relative mx-auto flex min-h-[92svh] max-w-7xl flex-col justify-end px-5 pb-12 pt-28 lg:px-10 lg:pb-16">
            <div className="max-w-4xl">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Sparkles className="size-4" /> Youth Conference · Creative Arts Festival</p>
              <h1 className="font-display text-5xl uppercase leading-[0.95] sm:text-7xl lg:text-8xl">Your voice.<br/><span className="text-secondary">In the room.</span></h1>
              <p className="mt-5 max-w-xl text-base text-foreground/75 sm:text-lg">Vote, ask, encourage and play live at Gospel Jamz. 16–18 October · The Power House Int'l.</p>
            </div>

            <div id="join" className="mt-9 max-w-3xl scroll-mt-24 border border-foreground/20 bg-background/90 p-3 backdrop-blur-md sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <label htmlFor="event-code" className="mb-2 block text-xs font-semibold uppercase text-primary">Enter the code on screen</label>
                  <Input id="event-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => event.key === "Enter" && requestJoin()} placeholder="000000" className="h-14 border-border bg-card px-4 font-display text-2xl text-foreground placeholder:text-muted-foreground sm:h-16" />
                </div>
                <Button variant="broadcast" size="lg" onClick={requestJoin} className="h-14 sm:h-16 sm:px-10">Join live <ArrowRight /></Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <Button variant="link" className="h-auto p-0 text-primary" onClick={() => setCode("260018")}>Use demo code 260018</Button>
                <span className="flex items-center gap-2"><span className="animate-live size-2 bg-live" /> Live room open</span>
              </div>
            </div>
            <a href="#programme" className="mt-8 inline-flex w-fit items-center gap-2 text-xs font-semibold uppercase text-foreground/60 hover:text-primary">Explore the event <ChevronDown className="size-4" /></a>
          </div>
        </section>

        <section className="border-b border-border px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div><p className="text-xs font-semibold uppercase text-primary">Live interaction board</p><h2 className="mt-3 max-w-[15ch] font-display text-3xl uppercase sm:text-5xl">Always ready before the host begins.</h2></div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">The event opens with a living preview of the games, voices and scores your audience will experience.</p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-7 lg:row-span-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"><div><p className="text-xs font-semibold uppercase text-primary">Live interaction · Word cloud</p><h3 className="mt-2 font-display text-xl uppercase">What does worship mean to you?</h3></div><span className="animate-live mt-1 size-2 bg-live" /></div>
                <div className="flex min-h-72 flex-wrap content-center items-center justify-center gap-x-7 gap-y-4 py-9 text-center font-display uppercase sm:min-h-80">{cloudWords.map((item) => <span key={item.word} className={item.className}>{item.word}</span>)}</div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] border-t border-border pt-4 text-sm text-muted-foreground"><span>412 responses received</span><span className="font-semibold text-primary">Add your word</span></div>
              </article>

              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-5">
                <div className="flex items-center justify-between gap-4"><span className="bg-secondary px-3 py-1 text-xs font-bold uppercase text-secondary-foreground">Pop quiz</span><span className="text-xs text-muted-foreground">Preview round</span></div>
                <h3 className="mt-7 max-w-[22ch] font-display text-xl uppercase sm:text-2xl">Which apostle was known as the “Beloved”?</h3>
                <div className="mt-7 grid gap-2">{["Peter", "Paul", "John", "James"].map((option, index) => <div key={option} className="grid h-12 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border border-border px-4 font-semibold"><span className="font-display text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>{option}</div>)}</div>
              </article>

              <article className="border border-border bg-card p-5 sm:p-7 lg:col-span-5">
                <div className="flex items-center justify-between"><h3 className="font-display text-xl uppercase">Top participants</h3><Trophy className="text-secondary" /></div>
                <ol className="mt-6 space-y-4">{leaders.map((leader, index) => <li key={leader.name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4"><span className="font-display text-sm text-primary">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm"><b className="truncate">{leader.name}</b><span>{leader.score}</span></div><div className="mt-2 h-1 bg-muted"><div className={`${leader.width} h-full ${index === 0 ? "bg-primary" : "bg-secondary"}`} /></div></div></li>)}</ol>
              </article>

              <article className="border border-secondary/40 bg-card p-5 sm:p-7 lg:col-span-12">
                <p className="text-xs font-semibold uppercase text-secondary">Active challenge</p>
                <div className="mt-3 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><h3 className="max-w-[24ch] font-display text-2xl uppercase sm:text-4xl">Share your testimony in 10 words.</h3><Button asChild variant="broadcast" size="lg"><Link to="/play/$code" params={{ code: "260018" }}>Open live room <ArrowRight /></Link></Button></div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase text-secondary">More than watching</p><h2 className="mt-3 font-display text-3xl uppercase sm:text-5xl">The audience becomes part of the moment.</h2></div>
            <div className="mt-10 grid border-y border-border md:grid-cols-3">
              {moments.map(({ icon: Icon, number, title, copy }) => <article key={title} className="border-b border-border py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0">
                <div className="flex items-center justify-between text-primary"><Icon className="size-6"/><span className="font-display text-sm">{number}</span></div>
                <h3 className="mt-8 font-display text-xl uppercase">{title}</h3><p className="mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">{copy}</p>
              </article>)}
            </div>
          </div>
        </section>

        <section id="programme" className="px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
              <div><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><CalendarDays className="size-4"/> Final event order</p><h2 className="mt-3 font-display text-4xl uppercase sm:text-5xl">Three days.<br/>One creative gathering.</h2><p className="mt-5 max-w-[42ch] text-muted-foreground">Your live screen will always show what is happening now and what comes next.</p></div>
              <ol className="border-t border-border">
                {programme.map((item, index) => <li key={item.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-border py-6 sm:grid-cols-[6rem_7rem_minmax(0,1fr)]">
                  <span className="font-display text-sm text-primary">{String(index + 1).padStart(2, "0")}</span><span className="hidden text-sm text-muted-foreground sm:block">{item.day}<br/><b className="text-foreground">{item.time}</b></span><div><h3 className="font-display text-lg uppercase">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground sm:hidden">{item.day} · {item.time}</p><p className="mt-2 text-sm text-muted-foreground">{item.note}</p></div>
                </li>)}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-display text-xl uppercase">Gospel Jamz 2026</p><p className="mt-1 text-sm text-muted-foreground">To live is Christ.</p></div><p className="text-xs uppercase text-muted-foreground">16–18 October · The Power House Int'l</p></div></footer>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="font-display text-2xl uppercase">Step into the room</DialogTitle><DialogDescription>Choose the name everyone will see during live moments.</DialogDescription></DialogHeader><form onSubmit={joinSession} className="space-y-4"><Input autoFocus value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={24} placeholder="Your nickname" className="h-12" required />{message && <p role="status" className="border-l-2 border-secondary pl-3 text-sm text-muted-foreground">{message}</p>}<Button variant="broadcast" size="lg" className="w-full" disabled={joining}>{joining ? <LoaderCircle className="animate-spin"/> : <Mic2/>} Join {code}</Button></form></DialogContent></Dialog>
    </div>
  );
}