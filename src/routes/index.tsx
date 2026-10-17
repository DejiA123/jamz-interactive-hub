import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, LoaderCircle, Mic2, Sparkles } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { friendlyJoinError, nicknameProblem, rememberPlayer, verifyStoredPlayer } from "@/lib/rooms";
import stageImage from "@/assets/gospel-jamz-stage.jpg";

const expectations = [
  { title: "A lively welcome", note: "Icebreakers, audience games and interaction throughout the day" },
  { title: "Praise & worship", note: "Led by Pelumi, Vicky, Bailey333 and more" },
  { title: "Music, poetry & performance", note: "Singing, rap, dance, spoken word and comedy from Merit, Mins Mercy, Rekky, Scripz, Sodiq, Kido, Lois and Lawrenta" },
  { title: "Drama & Drama Judgement", note: "Watch the drama, then cast your verdict live" },
  { title: "Podcast & panel", note: "Truly Crowned Podcast and a Young Leaders Panel taking your questions" },
  { title: "The word", note: "Teaching from Bishop/Dr, a clear Gospel presentation and \"Living Boldly for Christ\"" },
  { title: "Prayer & a snack break", note: "Time to pray together and recharge" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gospel Jamz App" },
      { name: "description", content: "Join Gospel Jamz live votes, panel questions, feedback and creative challenges with your event code." },
      { property: "og:title", content: "Gospel Jamz App" },
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
  const [liveCode, setLiveCode] = useState<string | null>(null);

  // One light lookup so the placeholder can hint the code currently on screen.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("event_sessions")
        .select("join_code")
        .eq("status", "live")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLiveCode(data.join_code);
    })();
  }, []);

  async function requestJoin() {
    if (code.length !== 6) {
      setMessage("Enter the six-digit code shown on screen.");
      return;
    }
    setMessage("");

    const { data: room } = await supabase
      .from("event_sessions")
      .select("id,status")
      .eq("join_code", code)
      .maybeSingle();

    if (!room) {
      setMessage(`There is no room with code ${code}. Check the code on screen.`);
      return;
    }
    if (room.status !== "live") {
      setMessage(`Room ${code} is closed right now. Wait for the host to open it.`);
      return;
    }

    // Already joined this room on this device: go straight back in.
    if (await verifyStoredPlayer(room.id)) {
      void navigate({ to: "/play/$code", params: { code } });
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

    const taken = await nicknameProblem(session.id, name);
    if (taken) {
      setJoining(false);
      setMessage(taken);
      return;
    }

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, nickname: name })
      .select("id")
      .single();

    setJoining(false);
    if (error || !participant) {
      setMessage(friendlyJoinError(error ?? { message: "" }));
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
        {/* Hero + Join */}
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
                    placeholder={liveCode ?? "000000"}
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

              {liveCode && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="animate-live size-2 rounded-full bg-live" />
                  A room is live now — code{" "}
                  <button
                    type="button"
                    onClick={() => setCode(liveCode)}
                    className="font-mono font-bold text-primary underline"
                  >
                    {liveCode}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* What to expect */}
        <section id="programme" className="scroll-mt-16 px-5 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                  <CalendarDays className="size-4" /> What to expect
                </p>
                <h2 className="mt-3 font-display text-4xl uppercase sm:text-5xl">
                  One day.<br />
                  Full of life.
                </h2>
                <p className="mt-5 max-w-[42ch] text-muted-foreground">
                  Saturday at Gospel Jamz is packed with moments for everyone. Enter your code above to join the live room and take part in each one.
                </p>
              </div>
              <ul className="border-t border-border">
                {expectations.map((item) => (
                  <li
                    key={item.title}
                    className="grid grid-cols-[minmax(0,1fr)] gap-1 border-b border-border py-6 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-5"
                  >
                    <h3 className="font-display text-lg uppercase">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground sm:mt-0.5">{item.note}</p>
                  </li>
                ))}
              </ul>
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
