import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Host Studio — Gospel Jamz 2026" },
      { name: "description", content: "Create and run live Gospel Jamz quizzes, polls, word clouds and challenges." },
      { property: "og:title", content: "Host Studio — Gospel Jamz 2026" },
      { property: "og:description", content: "Run the live Gospel Jamz session from one control room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <div className="min-h-screen bg-background px-5 py-12 text-foreground lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase text-primary">Host panel</p>
        <h1 className="font-display text-4xl uppercase sm:text-5xl">Host Studio</h1>
        <p className="mt-3 max-w-[50ch] text-sm text-muted-foreground">
          Your control room for live sessions. Session building tools land here next.
        </p>
        <div className="mt-8">
          <Button asChild variant="studio" size="lg">
            <Link to="/">Back to the live page</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
