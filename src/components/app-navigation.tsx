import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Gamepad2, Home, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveSyncListener } from "@/lib/live-sync";
import { cn } from "@/lib/utils";

const island =
  "pointer-events-auto border border-foreground/10 shadow-[0_24px_60px_-24px_oklch(0_0_0/90%),inset_0_1px_0_oklch(1_0_0/10%)] backdrop-blur-xl transition-colors duration-300";

const navItem =
  "group relative isolate inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-primary lg:px-5 [&>svg]:hidden [&>svg]:size-4 [&>svg]:shrink-0 lg:[&>svg]:block";

const dockItem =
  "group relative isolate flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-primary [&_svg]:size-5";

export function AppNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [activeCode, setActiveCode] = useState("");
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

    setActiveCode(data?.join_code ?? "");
    setIsLive(Boolean(data?.join_code));
  }

  useEffect(() => {
    void checkActiveRoom();
  }, []);

  useLiveSyncListener(() => {
    void checkActiveRoom();
  });

  // Firm up the floating islands once the page scrolls away from the hero.
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
      { rootMargin: "-45% 0px -45% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [pathname]);

  const homeActive = pathname === "/" && !programmeInView;
  const programmeActive = pathname === "/" && programmeInView;
  const joinActive = pathname.startsWith("/play/");
  const hostActive = pathname.startsWith("/studio") || pathname.startsWith("/auth");
  const islandSurface = scrolled ? "bg-background/80" : "bg-background/55";

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 lg:px-8">
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b from-background/90 to-transparent opacity-0 transition-opacity duration-300",
            scrolled && "opacity-100",
          )}
        />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <Link
            to="/"
            activeOptions={{ exact: true, includeHash: true }}
            className={cn(
              island,
              islandSurface,
              "flex h-12 min-w-0 items-center gap-3 justify-self-start rounded-xl pl-1.5 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <EqualizerMark live={isLive} />
            <span className="min-w-0 truncate font-display text-lg uppercase leading-none sm:text-xl">
              Gospel Jamz <span className="text-primary">2026</span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className={cn(
              island,
              islandSurface,
              "hidden h-12 items-center gap-1 rounded-2xl p-[3px] md:flex",
            )}
          >
            <Link
              to="/"
              activeOptions={{ exact: true, includeHash: true }}
              data-active={homeActive}
              className={navItem}
            >
              <Spotlight />
              <Home /> Home
            </Link>
            <JoinLink code={isLive ? activeCode : null} active={joinActive} className={navItem}>
              <Spotlight />
              <Gamepad2 /> Join Live
              {isLive && <LiveBadge />}
            </JoinLink>
            <Link
              to="/"
              hash="programme"
              activeOptions={{ exact: true, includeHash: true }}
              data-active={programmeActive}
              className={navItem}
            >
              <Spotlight />
              <CalendarDays /> Programme
            </Link>
          </nav>

          <Link
            to="/auth"
            data-active={hostActive}
            aria-current={hostActive ? "page" : undefined}
            className="group pointer-events-auto relative hidden h-12 items-center gap-2 justify-self-end overflow-hidden rounded-xl bg-primary px-5 font-display text-sm uppercase text-primary-foreground shadow-[0_0_32px_-6px_var(--primary)] transition-[background-color,box-shadow] duration-300 hover:bg-secondary hover:shadow-[0_0_32px_-6px_var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px data-[active=true]:ring-2 data-[active=true]:ring-foreground/70 data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-background md:inline-flex"
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

          {isLive && (
            <Link
              to="/play/$code"
              params={{ code: activeCode }}
              className={cn(
                island,
                islandSurface,
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-live/40 px-3 text-[11px] font-bold uppercase tracking-wider text-live md:hidden",
              )}
            >
              <span className="size-1.5 rounded-full bg-live animate-live" />
              Live
              <span className="hidden sm:inline">· {activeCode}</span>
            </Link>
          )}
        </div>
      </header>

      <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-40 md:hidden">
        <div className={cn(island, "grid h-16 grid-cols-3 rounded-2xl bg-background/80 p-1")}>
          <Link
            to="/"
            activeOptions={{ exact: true, includeHash: true }}
            data-active={homeActive}
            className={dockItem}
          >
            <Spotlight />
            <Home />
            Home
          </Link>

          <JoinLink
            code={isLive ? activeCode : null}
            active={joinActive}
            className="group relative flex flex-col items-center justify-end pb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground focus-visible:outline-none data-[active=true]:text-primary"
          >
            <span className="absolute -top-6 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_32px_-6px_var(--primary)] ring-4 ring-background transition-transform duration-200 group-active:scale-95 group-focus-visible:ring-ring">
              {isLive && (
                <span aria-hidden className="absolute inset-0 rounded-xl animate-signal-ring" />
              )}
              <Gamepad2 className="relative size-6" />
              {isLive && (
                <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-live animate-live" />
              )}
            </span>
            Join Live
          </JoinLink>

          <Link
            to="/auth"
            data-active={hostActive}
            aria-current={hostActive ? "page" : undefined}
            className={dockItem}
          >
            <Spotlight />
            <Radio />
            Host
          </Link>
        </div>
      </nav>
    </>
  );
}

/** The live room when one is open, otherwise the code box on the home page. */
function JoinLink({
  code,
  active,
  className,
  children,
}: {
  code: string | null;
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  return code ? (
    <Link to="/play/$code" params={{ code }} data-active={active} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/" hash="join" data-active={active} className={className}>
      {children}
    </Link>
  );
}

/** Stage-light effect: a lamp on the top edge, a beam washing down, and a pool of light below. */
function Spotlight() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-primary/5 bg-[radial-gradient(80%_120%_at_50%_0%,color-mix(in_oklab,var(--primary)_55%,transparent),transparent_75%)] opacity-0 transition-opacity duration-300 group-hover:opacity-40 group-data-[active=true]:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[3px] w-12 -translate-x-1/2 scale-x-0 rounded-b-full bg-primary shadow-[0_0_18px_4px_var(--primary)] transition-transform duration-300 group-hover:scale-x-50 group-data-[active=true]:scale-x-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 left-1/2 -z-10 h-3 w-3/4 -translate-x-1/2 rounded-full bg-primary/50 opacity-0 blur-md transition-opacity duration-300 group-data-[active=true]:opacity-100"
      />
    </>
  );
}

function EqualizerMark({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 shadow-[inset_0_1px_0_oklch(1_0_0/10%)]"
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

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[2px] border border-live/40 bg-live/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider text-live">
      <span className="size-1.5 rounded-full bg-live animate-live" />
      Live
    </span>
  );
}
