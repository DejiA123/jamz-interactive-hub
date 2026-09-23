import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Gamepad2, Home, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveSyncListener } from "@/lib/live-sync";
import { cn } from "@/lib/utils";

const railItem =
  "group relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-primary/10 data-[active=true]:text-primary lg:px-3.5 [&>svg]:hidden [&>svg]:size-4 [&>svg]:shrink-0 lg:[&>svg]:block";

const dockItem =
  "group relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors focus-visible:bg-foreground/5 focus-visible:outline-none data-[active=true]:text-primary [&_svg]:size-5";

export function AppNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [activeCode, setActiveCode] = useState<string>("260018");
  const [isLive, setIsLive] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [programmeInView, setProgrammeInView] = useState(false);

  async function checkActiveRoom() {
    const { data } = await supabase
      .from("event_sessions")
      .select("join_code, status")
      .eq("status", "live")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.join_code) {
      setActiveCode(data.join_code);
      setIsLive(true);
    }
  }

  useEffect(() => {
    void checkActiveRoom();
  }, []);

  useLiveSyncListener(() => {
    void checkActiveRoom();
  });

  // Solidify the header once the page scrolls away from the hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight "Programme" while its section crosses the middle of the viewport.
  useEffect(() => {
    setProgrammeInView(false);
    const section = pathname === "/" ? document.getElementById("programme") : null;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setProgrammeInView(entry?.isIntersecting ?? false),
      {
        rootMargin: "-45% 0px -45% 0px",
      },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [pathname]);

  const homeActive = pathname === "/" && !programmeInView;
  const programmeActive = pathname === "/" && programmeInView;
  const joinActive = pathname.startsWith("/play/");

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b px-4 transition-[background-color,border-color,box-shadow] duration-300 lg:px-10",
          scrolled
            ? "border-border bg-background/85 shadow-[0_16px_40px_-24px_oklch(0_0_0/90%)] backdrop-blur-xl"
            : "border-transparent bg-background/0",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          <Link
            to="/"
            activeOptions={{ exact: true, includeHash: true }}
            className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <EqualizerMark live={isLive} />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg uppercase leading-none sm:text-xl">
                Gospel Jamz <span className="text-primary">2026</span>
              </span>
              <span className="mt-1 hidden text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-muted-foreground lg:block">
                16–18 Oct · The Power House Int'l
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <nav
              aria-label="Main navigation"
              className="flex items-center gap-0.5 rounded-md border border-border bg-card/60 p-[3px] shadow-[inset_0_1px_0_oklch(1_0_0/8%)] backdrop-blur-md"
            >
              <Link
                to="/"
                activeOptions={{ exact: true, includeHash: true }}
                data-active={homeActive}
                className={railItem}
              >
                <Home /> Home
                <SignalBar />
              </Link>
              <Link
                to="/play/$code"
                params={{ code: activeCode }}
                data-active={joinActive}
                className={railItem}
              >
                <Gamepad2 /> Join Live
                {isLive && <LiveBadge />}
                <SignalBar />
              </Link>
              <Link
                to="/"
                hash="programme"
                activeOptions={{ exact: true, includeHash: true }}
                data-active={programmeActive}
                className={railItem}
              >
                <CalendarDays /> Programme
                <SignalBar />
              </Link>
            </nav>

            <Link
              to="/auth"
              className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-sm bg-primary px-4 font-display text-sm uppercase text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-[background-color,box-shadow] duration-300 hover:bg-secondary hover:shadow-[0_10px_30px_-10px_var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-foreground/35 opacity-0 transition-[left,opacity] duration-700 group-hover:left-[120%] group-hover:opacity-100"
              />
              <Radio className="size-4" />
              <span className="lg:hidden">Host</span>
              <span className="hidden lg:inline">Host Studio</span>
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {isLive && (
            <Link
              to="/play/$code"
              params={{ code: activeCode }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-live/40 bg-live/10 px-2.5 text-[11px] font-bold uppercase tracking-wider text-live md:hidden"
            >
              <span className="size-1.5 rounded-full bg-live animate-live" />
              Live
              <span className="hidden sm:inline">· {activeCode}</span>
            </Link>
          )}
        </div>
      </header>

      <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-40 md:hidden">
        <div className="grid h-16 grid-cols-3 rounded-md border border-border bg-card/90 shadow-chrome backdrop-blur-xl">
          <Link
            to="/"
            activeOptions={{ exact: true, includeHash: true }}
            data-active={homeActive}
            className={dockItem}
          >
            <DockIndicator />
            <Home />
            Home
          </Link>

          <Link
            to="/play/$code"
            params={{ code: activeCode }}
            data-active={joinActive}
            className="group relative flex flex-col items-center justify-end pb-2 text-[10px] font-bold uppercase tracking-wider text-foreground focus-visible:outline-none data-[active=true]:text-primary"
          >
            <span className="absolute -top-5 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_12px_30px_-8px_var(--primary)] ring-4 ring-background transition-transform duration-200 group-active:scale-95 group-focus-visible:ring-ring">
              {isLive && (
                <span aria-hidden className="absolute inset-0 rounded-md animate-signal-ring" />
              )}
              <Gamepad2 className="relative size-6" />
              {isLive && (
                <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-live animate-live" />
              )}
            </span>
            Join Live
          </Link>

          <Link to="/auth" className={dockItem}>
            <Radio />
            Host
          </Link>
        </div>
      </nav>
    </>
  );
}

function EqualizerMark({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 shadow-[inset_0_1px_0_oklch(1_0_0/10%)]"
    >
      <span className="flex h-4 items-end gap-[3px]">
        {[0.55, 1, 0.7, 0.85].map((height, index) => (
          <span
            key={index}
            className={cn(
              "w-[3px] origin-bottom rounded-[1px] bg-primary",
              live && "animate-equalizer",
            )}
            style={{ height: `${height * 100}%`, animationDelay: `${index * -0.23}s` }}
          />
        ))}
      </span>
    </span>
  );
}

function SignalBar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-3 -bottom-1 h-0.5 scale-x-0 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-300 group-hover:scale-x-50 group-data-[active=true]:scale-x-100"
    />
  );
}

function DockIndicator() {
  return (
    <span
      aria-hidden
      className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 scale-x-0 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-300 group-data-[active=true]:scale-x-100"
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[2px] border border-live/40 bg-live/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider text-live">
      <span className="size-1.5 rounded-full bg-live animate-live" />
      Live
    </span>
  );
}
