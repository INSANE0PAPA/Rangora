import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DotField } from "@/components/DotField";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { EventCard } from "@/components/EventCard";
import { PreferencePicker } from "@/components/PreferencePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession, useSeatCounts } from "@/lib/use-auth";
import { useCatalogEvents } from "@/lib/use-catalog";
import { useBooking } from "@/lib/use-booking";
import { categories, festivals, voucherCampaigns, achievements } from "@/data/catalog";
import { catById, fmtWhen } from "@/lib/catalog-helpers";
import { canChangeEventPublishing, canManageEvents, canSubmitEventReview } from "@/lib/role-rules";
import {
  executeVerifyPass,
  executeSaveProfile,
  executeSaveOrganiserProfile,
  executeCreateEventBadge,
} from "@/lib/api.functions";
import type { Database, Json } from "@/integrations/supabase/types";

import {
  ParticipantSpace,
  OrganizerSpace,
  AdminSpace,
  blankEvent,
  type EventFormState,
  type EventEchoEntry,
} from "@/components/dashboard/RoleSpaces";

type FestivalInsert = Database["public"]["Tables"]["festivals"]["Insert"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Rangora role dashboard" },
      { name: "description", content: "Manage Rangora passes, event operations, organiser review, and festival oversight." },
      { property: "og:title", content: "Rangora role dashboard" },
      { property: "og:description", content: "Role-specific tools for Rangora participants, organisers, and administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const { data: me } = useProfile(user?.id);
  const { data: counts = {} } = useSeatCounts();
  const { events: catalogEvents } = useCatalogEvents();
  const [tab, setTab] = useState("passes");
  const [helpAnswers, setHelpAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState(blankEvent);
  const [festivalForm, setFestivalForm] = useState({ name: "", tagline: "", theme: "", description: "", start_date: "", end_date: "" });
  const [badgeForm, setBadgeForm] = useState({ event_id: "", title: "", description: "", emoji: "", points: "20" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bookings = useBooking(user?.id);
  const role = me?.role ?? "participant";
  const ownEvents = useMemo(() => catalogEvents.filter((event) => role === "admin" || event.organiserId === user?.id), [catalogEvents, role, user?.id]);
  const roleEvents = role === "participant" ? catalogEvents.filter((event) => event.published !== false) : catalogEvents;
  const activeEventCount = catalogEvents.filter((event) => role === "admin" || event.organiserId === user?.id).length;

  const application = useQuery({
    queryKey: ["organiser-application", user?.id], enabled: Boolean(user?.id && role === "organizer"),
    queryFn: async () => (await supabase.from("organiser_profiles").select("*").eq("user_id", user?.id ?? "").maybeSingle()).data,
  });
  const adminProfile = useQuery({
    queryKey: ["admin-profile", user?.id], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("admin_profiles").select("office,designation,staff_id,status").eq("user_id", user?.id ?? "").maybeSingle()).data,
  });
  const myRegistrations = useQuery({
    queryKey: ["registrations", user?.id], enabled: Boolean(user?.id && role === "participant"),
    queryFn: async () => (await supabase.from("registrations").select("*").eq("user_id", user?.id ?? "").order("created_at", { ascending: false })).data ?? [],
  });
  const myRewards = useQuery({
    queryKey: ["participant-rewards", user?.id], enabled: Boolean(user?.id && role === "participant"),
    queryFn: async () => {
      const [badgeRows, voucherRows] = await Promise.all([
        supabase.from("user_achievements").select("code,earned_at").eq("user_id", user?.id ?? ""),
        supabase.from("user_vouchers").select("id,campaign_id,code,issued_at").eq("user_id", user?.id ?? ""),
      ]);
      return { badges: badgeRows.data ?? [], vouchers: voucherRows.data ?? [] };
    },
  });
  const myEchoes = useQuery({
    queryKey: ["participant-event-echoes", user?.id], enabled: Boolean(user?.id && role === "participant"),
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("id,event_id,author_name,rating,comment,media,tagged_friends,liked_by_organiser,created_at").eq("user_id", user?.id ?? "").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const responseCounts = useQuery({
    queryKey: ["event-response-counts", role, user?.id], enabled: Boolean(user?.id && (role === "organizer" || role === "admin")),
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("event_id");
      if (error) throw error;
      return (data ?? []).reduce<Record<number, number>>((totals, row) => {
        totals[row.event_id] = (totals[row.event_id] ?? 0) + 1;
        return totals;
      }, {});
    },
  });
  const organiserEchoes = useQuery({
    queryKey: ["organiser-event-echoes", user?.id, ownEvents.map((event) => event.id)],
    enabled: Boolean(user?.id && role === "organizer" && ownEvents.length > 0),
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("id,event_id,author_name,rating,comment,media,tagged_friends,liked_by_organiser,created_at").in("event_id", ownEvents.map((event) => event.id)).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  };

  const createEvent = useMutation({
    mutationFn: async (publish: boolean) => {
      const artists = form.artists.split("\n").map((artist) => artist.trim()).filter(Boolean).slice(0, 40);
      const start = new Date(form.start_at);
      const end = new Date(form.end_at);
      const price = Number(form.price);
      const seats = Number(form.max_seats);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error("The event must end after it starts.");
      if (!Number.isInteger(seats) || seats < 1 || seats > 10000 || !Number.isFinite(price) || price < 0) throw new Error("Check the seat limit and ticket price.");
      const data = {
        name: form.name.trim(), subtitle: form.subtitle.trim(), description: form.description.trim(), venue: form.venue.trim(),
        start_at: start.toISOString(), end_at: end.toISOString(),
        price, max_seats: seats, category_id: Number(form.category_id), festival_id: Number(form.festival_id),
        poster: form.poster, artists, terms: form.terms.trim(), featured: false, published: publish, organiser_id: user?.id ?? null,
      };
      const { error } = await supabase.from("events").insert(data);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Event saved."); setForm(blankEvent); await queryClient.invalidateQueries(); },
    onError: (error) => toast.error(error.message.includes("CLASH") ? "This time overlaps another event you manage." : error.message || "Could not save the event."),
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, published }: { id: number; published: boolean }) => {
      const event = catalogEvents.find((item) => item.id === id);
      if (!event || !canChangeEventPublishing([role], event.organiserId, user?.id ?? "")) throw new Error("You cannot change this event.");
      const { error } = await supabase.from("events").update({ published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Event updated."); await queryClient.invalidateQueries(); },
    onError: () => toast.error("Could not update this event."),
  });

  const makeBadge = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in to continue.");
      const points = Number(badgeForm.points);
      if (!badgeForm.title.trim() || points < 0 || points > 500) throw new Error("Enter a badge title and a valid point value.");
      const { error } = await supabase.from("event_badges").insert({ event_id: Number(badgeForm.event_id), title: badgeForm.title.trim(), description: badgeForm.description.trim(), emoji: "Badge", points, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Event badge created."); setBadgeForm({ event_id: "", title: "", description: "", emoji: "", points: "20" }); await queryClient.invalidateQueries(); },
    onError: (error) => toast.error(error.message || "Could not create the badge."),
  });

  const approveOrganiser = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("organiser_profiles").update({ status, reviewed_at: new Date().toISOString() }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Organiser application reviewed."); await queryClient.invalidateQueries(); },
    onError: () => toast.error("Could not update organiser status."),
  });

  const createFestival = useMutation({
    mutationFn: async () => {
      const data: FestivalInsert = { name: festivalForm.name.trim(), tagline: festivalForm.tagline.trim(), theme: festivalForm.theme.trim(), description: festivalForm.description.trim(), start_date: festivalForm.start_date, end_date: festivalForm.end_date, banner: "hero_festival.jpg", created_by: user?.id ?? null };
      if (!data.name || !data.tagline || !data.theme || !data.description || data.end_date < data.start_date) throw new Error("Check the festival details and dates.");
      const { error } = await supabase.from("festivals").insert(data);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Festival created."); setFestivalForm({ name: "", tagline: "", theme: "", description: "", start_date: "", end_date: "" }); await queryClient.invalidateQueries(); },
    onError: () => toast.error("Could not save the festival. Check its dates and details."),
  });

  const platformStats = useQuery({
    queryKey: ["platform-stats"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_stats");
      if (error) throw error;
      return data as { events: number; festivals: number; bookings: number; participants: number; organisers: number; reviews: number; average_rating: number | null };
    },
  });
  const organiserApplications = useQuery({
    queryKey: ["organiser-applications"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("organiser_profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const sponsorRows = useQuery({
    queryKey: ["rangora-sponsors"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("sponsors").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const helpRows = useQuery({
    queryKey: ["rangora-help-requests"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("help_requests").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const eventClashes = useQuery({
    queryKey: ["event-clashes"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.rpc("event_clashes")).data ?? [],
  });
  const adminVouchers = useQuery({
    queryKey: ["voucher-campaigns-admin"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("voucher_campaigns").select("id,title,stock")).data ?? [],
  });
  const issuedVouchers = useQuery({
    queryKey: ["admin-issued-vouchers"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_vouchers").select("campaign_id");
      if (error) throw error;
      const totals: Record<number, number> = {};
      (data ?? []).forEach((row) => { totals[row.campaign_id] = (totals[row.campaign_id] ?? 0) + 1; });
      return totals;
    },
  });
  const echoRecap = useQuery({
    queryKey: ["admin-event-echo-recap"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("id,event_id,author_name,rating,comment,media,tagged_friends,liked_by_organiser,created_at").order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
  const eventSponsorRequests = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "rejected" }) => {
      const { error } = await supabase.from("sponsors").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Sponsorship request updated."); await queryClient.invalidateQueries({ queryKey: ["rangora-sponsors"] }); },
    onError: () => toast.error("Could not update that sponsorship request."),
  });
  const leaderboardRows = useQuery({
    queryKey: ["leaderboard-admin"], enabled: Boolean(user?.id && role === "admin"),
    queryFn: async () => (await supabase.from("leaderboard").select("user_id,display_name,points").order("points", { ascending: false }).limit(10)).data ?? [],
  });
  const systemCanManage = canManageEvents([role], application.data?.status);

  async function answerHelp(id: string, answer: string) {
    if (!answer.trim() || answer.trim().length > 2000) { toast.error("Write a response under 2,000 characters."); return; }
    const { error } = await supabase.from("help_requests").update({ answer: answer.trim(), status: "resolved" }).eq("id", id);
    if (error) toast.error("Could not send the reply."); else { toast.success("Reply sent."); await queryClient.invalidateQueries({ queryKey: ["rangora-help-requests"] }); }
  }

  const runVerifyPass = useServerFn(executeVerifyPass);
  const runSaveProfile = useServerFn(executeSaveProfile);
  const runSaveOrganiserProfile = useServerFn(executeSaveOrganiserProfile);
  const runCreateBadge = useServerFn(executeCreateEventBadge);

  if (!user) {
    return (
      <div className="relative min-h-screen bg-ivory">
        <DotField fixed />
        <SiteHeader />
        <p className="relative z-10 p-10 text-center text-sm text-ink-muted">Loading your Rangora space…</p>
      </div>
    );
  }

  const userProfile = me?.profile || {
    full_name: (user?.user_metadata?.["full_name"] as string) || "Campus Attendee",
    email: user?.email || null,
    phone: null,
    address: null,
    department: null,
    course: null,
    preferences: [],
  };

  const hub = role === "admin" ? "Admin Console" : role === "organizer" ? "Organizer Studio" : "Participant Hub";
  const title = role === "admin" ? "Campus at a glance." : role === "organizer" ? "Bring the next event to life." : `Welcome back, ${userProfile.full_name.split(" ")[0]}.`;

  return (
    <div className="relative min-h-screen bg-ivory text-ink">
      <DotField fixed />
      <SiteHeader hub={hub} />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b-2 border-black dark:border-white pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">{userProfile.email}</p>
            <h1 className="serif-heading mt-2 text-3xl sm:text-4xl font-black">{title}</h1>
          </div>
          <Button variant="outline" onClick={signOut} className="font-bold border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Sign out
          </Button>
        </div>
        {role === "participant" && (
          <ParticipantSpace
            userId={user.id}
            profile={userProfile}
            events={roleEvents}
            counts={counts}
            registrations={myRegistrations.data ?? []}
            rewards={myRewards.data}
            echoes={myEchoes.data ?? []}
            bookings={bookings}
            onSaveProfile={async (data) => {
              if (Array.isArray(data)) {
                await runSaveProfile({ data: { userId: user.id, preferences: data } });
              } else {
                await runSaveProfile({
                  data: {
                    userId: user.id,
                    fullName: data.full_name,
                    phone: data.phone,
                    address: data.address,
                    department: data.department,
                    course: data.course,
                    preferences: data.preferences,
                  },
                });
              }
              await queryClient.invalidateQueries();
            }}
          />
        )}
        {role === "organizer" && (
          <OrganizerSpace
            userId={user.id}
            status={application.data?.status ?? "pending"}
            application={application.data}
            events={ownEvents}
            counts={counts}
            responseCounts={responseCounts.data ?? {}}
            echoes={organiserEchoes.data ?? []}
            systemCanManage={systemCanManage}
            activeEventCount={activeEventCount}
            form={form}
            setForm={setForm}
            createEvent={createEvent}
            updateEvent={updateEvent}
            badgeForm={badgeForm}
            setBadgeForm={setBadgeForm}
            makeBadge={makeBadge}
            onVerifyAttendance={async (passCode, eventId) => {
              return await runVerifyPass({ data: { passCode, eventId, organiserId: user.id } });
            }}
            onSaveOrganiserProfile={async (data) => {
              await runSaveOrganiserProfile({
                data: {
                  userId: user.id,
                  orgName: data.orgName ?? "",
                  position: data.position,
                  orgType: data.orgType,
                  description: data.description,
                  institutionalId: data.institutionalId,
                },
              });
              await queryClient.invalidateQueries();
            }}
            onCreateBadge={async (badge) => {
              await runCreateBadge({
                data: {
                  eventId: badge.eventId,
                  title: badge.title,
                  description: badge.description,
                  emoji: "Badge",
                  points: badge.points,
                  createdBy: user.id,
                },
              });
              await queryClient.invalidateQueries();
            }}
          />
        )}
        {role === "admin" && <AdminSpace adminProfile={adminProfile.data} stats={platformStats.data} events={catalogEvents} counts={counts} responseCounts={responseCounts.data ?? {}} applications={organiserApplications.data ?? []} approve={approveOrganiser} ownEvents={ownEvents} form={form} setForm={setForm} createEvent={createEvent} updateEvent={updateEvent} festivalForm={festivalForm} setFestivalForm={setFestivalForm} createFestival={createFestival} clashes={eventClashes.data ?? []} sponsors={sponsorRows.data ?? []} updateSponsor={eventSponsorRequests} help={helpRows.data ?? []} answerHelp={answerHelp} helpAnswers={helpAnswers} setHelpAnswers={setHelpAnswers} vouchers={adminVouchers.data ?? []} issuedVouchers={issuedVouchers.data ?? {}} echoRecap={echoRecap.data ?? []} leaderboard={leaderboardRows.data ?? []} userId={user.id} />}
      </main>
      <SiteFooter />
    </div>
  );
}

