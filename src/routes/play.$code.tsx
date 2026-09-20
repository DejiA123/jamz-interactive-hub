import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/play/$code")({
  head: () => ({
    meta: [
      { title: "You're in — Gospel Jamz 2026 Live" },
      { name: "description", content: "Answer live Gospel Jamz questions, polls and challenges from your seat." },
      { property: "og:title", content: "You're in — Gospel Jamz 2026 Live" },
      { property: "og:description", content: "The live Gospel Jamz audience screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center text-foreground">
      <p className="text-xs font-semibold uppercase text-primary">Session {code}</p>
      <h1 className="mt-2 font-display text-4xl uppercase sm:text-5xl">You're in the room</h1>
      <p className="mt-3 max-w-[40ch] text-sm text-muted-foreground">
        Keep this screen open — the next activity appears here the moment the host starts it.
      </p>
      <Button asChild variant="studio" size="lg" className="mt-8">
        <Link to="/">Leave session</Link>
      </Button>
    </div>
  );
}
