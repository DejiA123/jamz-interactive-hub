import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Gamepad2, Home, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLiveSyncListener } from "@/lib/live-sync";

export function AppNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [activeCode, setActiveCode] = useState<string>("260018");
  const [isLive, setIsLive] = useState(false);

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

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:px-10">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <Link to="/" className="min-w-0 truncate font-display text-lg uppercase sm:text-xl">
            Gospel Jamz <span className="text-primary">2026</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
            <Button asChild variant={pathname === "/" ? "signal" : "ghost"}>
              <Link to="/">
                <Home className="size-4" /> Home
              </Link>
            </Button>
            <Button asChild variant={pathname.startsWith("/play/") ? "signal" : "ghost"}>
              <Link to="/play/$code" params={{ code: activeCode }}>
                <Gamepad2 className="size-4" /> Join Live
                {isLive && <span className="size-1.5 rounded-full bg-live animate-live ml-1" />}
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <a href="/#programme">
                <CalendarDays className="size-4" /> Programme
              </a>
            </Button>
            <Button asChild variant="broadcast">
              <Link to="/auth">
                <Radio className="size-4" /> Host Studio
              </Link>
            </Button>
          </nav>
          <Button asChild variant="broadcast" size="sm" className="sm:hidden">
            <Link to="/auth">
              <Radio className="size-4" /> Host
            </Link>
          </Button>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-40 grid h-16 grid-cols-3 border border-border bg-card/95 p-1.5 shadow-chrome backdrop-blur-xl sm:hidden"
      >
        <Button
          asChild
          variant={pathname === "/" ? "signal" : "ghost"}
          className="h-full flex-col gap-1 px-2 text-[10px]"
        >
          <Link to="/">
            <Home className="size-4" />
            Home
          </Link>
        </Button>
        <Button
          asChild
          variant={pathname.startsWith("/play/") ? "signal" : "ghost"}
          className="h-full flex-col gap-1 px-2 text-[10px]"
        >
          <Link to="/play/$code" params={{ code: activeCode }}>
            <Gamepad2 className="size-4" />
            Join Live
          </Link>
        </Button>
        <Button
          asChild
          variant={pathname === "/auth" ? "signal" : "ghost"}
          className="h-full flex-col gap-1 px-2 text-[10px]"
        >
          <Link to="/auth">
            <Radio className="size-4" />
            Host
          </Link>
        </Button>
      </nav>
    </>
  );
}