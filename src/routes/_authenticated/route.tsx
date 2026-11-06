import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getStoredDemoSession } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const demo = getStoredDemoSession();
    if (!data.user && !demo) throw redirect({ to: "/auth", search: { mode: "login" } });
  },
  component: () => <Outlet />,
});