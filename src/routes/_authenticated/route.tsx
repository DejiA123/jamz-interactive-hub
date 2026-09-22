import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isHostAuthenticated } from "@/lib/live-sync";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (!isHostAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
    return { host: true };
  },
  component: () => <Outlet />,
});