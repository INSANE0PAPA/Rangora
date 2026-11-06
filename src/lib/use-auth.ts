import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfileAndRole, fetchSeatCounts } from "@/lib/api.functions";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  course: string | null;
  preferences: string[];
};

export const DEMO_STORAGE_KEY = "rangora_demo_session";

export interface DemoSessionData {
  role: "participant" | "organizer" | "admin";
  userId: string;
  name: string;
  email: string;
}

export function getStoredDemoSession(): DemoSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredDemoSession(role: "participant" | "organizer" | "admin") {
  if (typeof window === "undefined") return;
  const config = {
    participant: {
      userId: "d3300000-0000-0000-0000-000000000001",
      name: "Maya Sen",
      email: "maya.sen@demo.rangora.in",
    },
    organizer: {
      userId: "d3300000-0000-0000-0000-000000000002",
      name: "Priya Sharma",
      email: "priya.sharma@demo.rangora.in",
    },
    admin: {
      userId: "d3300000-0000-0000-0000-000000000003",
      name: "Rangora Administrator",
      email: "admin@demo.rangora.in",
    },
  }[role];

  window.localStorage.setItem(
    DEMO_STORAGE_KEY,
    JSON.stringify({ role, ...config })
  );
  window.dispatchEvent(new Event("rangora:session-change"));
}

export function clearStoredDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
  window.dispatchEvent(new Event("rangora:session-change"));
}

/** Client-side session state via Supabase Auth with seamless fallback to active Demo session. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [demoSession, setDemoSession] = useState<DemoSessionData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDemoSession(getStoredDemoSession());
    const refreshDemo = () => setDemoSession(getStoredDemoSession());
    window.addEventListener("rangora:session-change", refreshDemo);
    window.addEventListener("storage", refreshDemo);

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("rangora:session-change", refreshDemo);
      window.removeEventListener("storage", refreshDemo);
    };
  }, []);

  const realUser = session?.user ?? null;
  const isDemo = ready && !realUser && !!demoSession;

  const user: User | null = ready
    ? (realUser ?? (demoSession ? ({
        id: demoSession.userId,
        email: demoSession.email,
        app_metadata: {},
        user_metadata: { full_name: demoSession.name, role: demoSession.role },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as unknown as User) : null))
    : null;

  return {
    session,
    user,
    ready,
    isDemo,
    demoRole: isDemo ? demoSession?.role ?? null : null,
  };
}

/** Authenticated server function query: retrieves user profile & roles from database */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      return fetchUserProfileAndRole({ data: { userId } });
    },
  });
}

/** Database query: retrieves confirmed seat counts per event */
export function useSeatCounts() {
  return useQuery({
    queryKey: ["seat-counts"],
    queryFn: async () => {
      return fetchSeatCounts();
    },
  });
}
