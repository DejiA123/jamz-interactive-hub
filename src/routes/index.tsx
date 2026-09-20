import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Gavel, Heart, LoaderCircle, MessageCircleQuestion, Mic2, Radio, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-foreground/15 px-5 py-5 lg:px-10">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <Link to="/" className="min-w-0 font-display text-xl uppercase sm:text-2xl">Gospel Jamz <span className="text-primary">2026</span></Link>
          <Button asChild variant="ghost" className="text-foreground hover:bg-foreground/10 hover:text-primary"><Link to="/auth"><Radio /> Host studio</Link></Button>
        </div>
      </header>

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

            <div className="mt-9 max-w-3xl border border-foreground/20 bg-background/90 p-3 backdrop-blur-md sm:p-4">
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