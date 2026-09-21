import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Host Sign In — Gospel Jamz 2026" },
    { name: "description", content: "Sign in to create and run Gospel Jamz live audience sessions." },
    { property: "og:title", content: "Host Sign In — Gospel Jamz 2026" },
    { property: "og:description", content: "Create quizzes, polls, word clouds and live Gospel Jamz challenges." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/studio", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === "signup" && !result.data.session) return setMessage("Check your email to confirm your host account.");
    void navigate({ to: "/studio" });
  }

  async function signInGoogle() {
    setBusy(true); setMessage("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    if (!result.redirected) void navigate({ to: "/studio" });
  }

  return <main className="stage-grid flex min-h-screen items-center justify-center px-5 py-12">
    <div className="w-full max-w-md border border-border bg-card p-7 chrome-edge sm:p-9">
      <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft /> Back to the event</Link>
      <div className="mb-8 flex items-center gap-3"><span className="grid size-11 place-items-center bg-primary text-primary-foreground"><Radio /></span><div><p className="font-display text-xl uppercase">Host Studio</p><p className="text-xs uppercase text-muted-foreground">Gospel Jamz 2026</p></div></div>
      <h1 className="font-display text-3xl uppercase">{mode === "signin" ? "Run the room" : "Create host account"}</h1>
      <p className="mt-2 text-muted-foreground">Build and launch interactive moments for your audience.</p>
      <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">There are no preset credentials. Continue with Google, or create your own host account below.</p>
      <Button type="button" variant="outline" size="lg" className="mt-7 w-full" onClick={signInGoogle} disabled={busy}><Sparkles /> Continue with Google</Button>
      <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />or email<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-4">
        <Input aria-label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Host email" required className="h-12" />
        <Input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required className="h-12" />
        {message && <p role="status" className="border-l-2 border-secondary pl-3 text-sm text-muted-foreground">{message}</p>}
        <Button variant="broadcast" size="lg" className="w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}{mode === "signin" ? "Enter studio" : "Create account"}</Button>
      </form>
      <Button type="button" variant="link" className="mt-6 w-full" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New host? Create an account" : "Already a host? Sign in"}</Button>
    </div>
  </main>;
}