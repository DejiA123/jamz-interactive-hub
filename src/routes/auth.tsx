import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, KeyRound, LoaderCircle, Lock, Radio, ShieldCheck } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isHostAuthenticated, verifyAndSetHostPasscode } from "@/lib/live-sync";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Host Studio Access — Gospel Jamz App" },
      { name: "description", content: "Enter passcode to access Gospel Jamz Host Studio." },
      { property: "og:title", content: "Host Studio Access — Gospel Jamz App" },
      { property: "og:description", content: "Enter passcode to access Gospel Jamz Host Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (isHostAuthenticated()) {
      void navigate({ to: "/studio", replace: true });
    }
  }, [navigate]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const isValid = verifyAndSetHostPasscode(passcode);
    if (isValid) {
      setUnlocked(true);
      setTimeout(() => {
        void navigate({ to: "/studio", replace: true });
      }, 500);
    } else {
      setBusy(false);
      setError("Incorrect passcode. Please enter the valid Host Studio passcode.");
    }
  }

  return (
    <main className="stage-grid flex min-h-screen items-center justify-center px-5 pb-28 pt-24 md:pb-12">
      <AppNavigation />
      <div className="w-full max-w-md border border-border bg-card p-7 chrome-edge sm:p-9">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to event
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center bg-primary text-primary-foreground">
            <Radio className="size-5" />
          </span>
          <div>
            <p className="font-display text-xl uppercase leading-tight">Host Studio</p>
            <p className="text-xs uppercase text-muted-foreground">Gospel Jamz 2026</p>
          </div>
        </div>

        <h1 className="font-display text-3xl uppercase tracking-tight">
          Control Room Access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Enter the private Host passcode to manage live polls, quizzes, word clouds, and audience moments.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="host-passcode"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
            >
              <KeyRound className="size-3.5" /> Host Passcode
            </label>
            <div className="relative">
              <Input
                id="host-passcode"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter passcode"
                required
                className="h-14 border-border bg-background px-4 font-mono text-lg tracking-widest uppercase placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground sm:text-xl"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="size-4" />
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {unlocked && (
            <div className="flex items-center gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
              <Check className="size-4" /> Passcode verified. Opening Host Studio…
            </div>
          )}

          <Button
            type="submit"
            variant="broadcast"
            size="lg"
            className="mt-2 w-full h-14 text-base"
            disabled={busy || unlocked || !passcode.trim()}
          >
            {busy ? (
              <>
                <LoaderCircle className="size-5 animate-spin" /> Unlocking Studio…
              </>
            ) : unlocked ? (
              <>
                <ShieldCheck className="size-5" /> Access Granted
              </>
            ) : (
              <>
                <KeyRound className="size-5" /> Enter Studio
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Authorised event controllers only.
          </p>
        </div>
      </div>
    </main>
  );
}