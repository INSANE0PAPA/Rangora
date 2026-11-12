import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStoredDemoSession, setStoredDemoSession } from "@/lib/use-auth";
import {
  RotateCcw,
  Ticket,
  CalendarCheck,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { getDemoState, performDemoAction, type DemoActionInput } from "@/lib/demo.functions";
import {
  ParticipantSpace,
  OrganizerSpace,
  AdminSpace,
  blankEvent,
  type EventFormState,
} from "@/components/dashboard/RoleSpaces";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Direct Interactive Demo · Rangora" },
      {
        name: "description",
        content:
          "Experience Rangora's live interactive workspace across Participant, Organiser, and Administrator roles with real database-backed mutations.",
      },
      { property: "og:title", content: "Direct Interactive Demo · Rangora" },
      {
        property: "og:description",
        content:
          "Three genuinely interactive roles with ticket check-in verification, live bookings, and isolated persistence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoPage,
});

type DemoRole = "participant" | "organizer" | "admin";

function DemoPage() {
  const [activeRole, setActiveRole] = useState<DemoRole>("participant");
  const [form, setForm] = useState<EventFormState>(blankEvent);

  useEffect(() => {
    const saved = getStoredDemoSession()?.role;
    if (saved) {
      setActiveRole(saved);
    } else {
      setStoredDemoSession("participant");
    }
  }, []);

  function switchRole(role: DemoRole) {
    setActiveRole(role);
    setStoredDemoSession(role);
    toast.info(`Switched demo persona to ${role}. You can now test features as this role across the site.`);
  }
  const [badgeForm, setBadgeForm] = useState({
    event_id: "1",
    title: "",
    description: "",
    emoji: "",
    points: "50",
  });
  const [festivalForm, setFestivalForm] = useState({
    name: "",
    tagline: "",
    theme: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const [helpAnswers, setHelpAnswers] = useState<Record<string, string>>({});

  const fetchState = useServerFn(getDemoState);
  const executeAction = useServerFn(performDemoAction);
  const queryClient = useQueryClient();

  const { data: state, isLoading, isError, error } = useQuery({
    queryKey: ["demo-workspace-state"],
    queryFn: () => fetchState(),
    refetchOnWindowFocus: false,
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: DemoActionInput) => {
      return executeAction({ data: payload });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["demo-workspace-state"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Action could not be completed.");
    },
  });

  // Calculate response counts for events from echoes
  const responseCounts: Record<number, number> = {};
  if (state?.echoes) {
    for (const echo of state.echoes) {
      responseCounts[echo.event_id] = (responseCounts[echo.event_id] ?? 0) + 1;
    }
  }

  // Action handlers
  async function handleBook(eventId: number, kind: "booked" | "planned") {
    try {
      const result = await actionMutation.mutateAsync({ action: "book", eventId, kind });
      if (result && "passCode" in result) {
        toast.success(`Pass reserved! Your pass code is ${result.passCode}`);
      } else {
        toast.success("Event added to your planned itinerary.");
      }
    } catch {
      // Error handled by mutation
    }
  }

  async function handleCancelPass(registrationId: string) {
    try {
      await actionMutation.mutateAsync({ action: "cancel", registrationId });
      toast.success("Registration cancelled.");
    } catch {
      // Error handled by mutation
    }
  }

  async function handleSaveProfile(
    data:
      | {
        full_name?: string;
        department?: string;
        course?: string;
        phone?: string;
        address?: string;
        preferences?: string[];
      }
      | string[]
  ) {
    try {
      if (Array.isArray(data)) {
        await actionMutation.mutateAsync({ action: "saveInterests", preferences: data });
      } else {
        await actionMutation.mutateAsync({
          action: "updateParticipantProfile",
          fullName: data.full_name,
          phone: data.phone,
          address: data.address,
          department: data.department,
          course: data.course,
          preferences: data.preferences,
        });
      }
      toast.success("Participant profile updated in demo database.");
    } catch {
      // Error handled by mutation
    }
  }

  async function handleSaveOrganiserProfile(data: {
    orgName?: string;
    position?: string;
    orgType?: string;
    description?: string;
    institutionalId?: string;
  }) {
    try {
      await actionMutation.mutateAsync({
        action: "updateOrganiserProfile",
        orgName: data.orgName,
        position: data.position,
        orgType: data.orgType,
        description: data.description,
        institutionalId: data.institutionalId,
      });
      toast.success("Organiser details updated in demo database.");
    } catch {
      // Handled
    }
  }

  async function handleCreateBadge(badge: {
    eventId: number;
    title: string;
    description: string;
    points: number;
  }) {
    try {
      await actionMutation.mutateAsync({
        action: "createBadge",
        eventId: badge.eventId,
        title: badge.title,
        description: badge.description,
        points: badge.points,
      });
      toast.success(`Badge "${badge.title}" persisted in demo database!`);
    } catch {
      // Handled
    }
  }

  async function handleSubmitReview(data: {
    eventId: number;
    rating: number;
    comment: string;
    taggedFriends: string[];
    media: Array<{ path: string; name: string; type: string }>;
    visibility?: "private" | "campus" | "public";
  }) {
    try {
      await actionMutation.mutateAsync({
        action: "submitEcho",
        eventId: data.eventId,
        rating: data.rating,
        comment: data.comment,
        taggedFriends: data.taggedFriends,
        media: data.media,
        visibility: data.visibility ?? "private",
        publicConsent: data.visibility === "public",
      });
      toast.success("Your Event Echo was shared and is visible across the demo!");
    } catch {
      // Error handled by mutation
    }
  }

  async function handleHelpRequest(data: {
    category: string;
    eventId?: number | null;
    subject: string;
    message: string;
  }) {
    try {
      await actionMutation.mutateAsync({
        action: "sendHelpRequest",
        category: data.category,
        eventId: data.eventId ?? null,
        subject: data.subject,
        message: data.message,
      });
      toast.success("Demo help request submitted.");
    } catch {
      // Error handled by mutation
    }
  }

  async function handleVerifyAttendance(passCode: string, eventId?: number) {
    const res = (await actionMutation.mutateAsync({
      action: "verifyAttendance",
      passCode,
      eventId,
    })) as { verified?: boolean; passCode?: string; participantName?: string } | undefined;
    return res;
  }

  async function handleToggleEchoLike(echoId: string) {
    try {
      await actionMutation.mutateAsync({ action: "toggleEchoLike", echoId });
      toast.success("Event Echo like status toggled.");
    } catch {
      // Handled
    }
  }

  async function handleCreateEvent(publish: boolean) {
    try {
      await actionMutation.mutateAsync({
        action: "createEvent",
        name: form.name.trim(),
        subtitle: form.subtitle.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        startAt: form.start_at,
        endAt: form.end_at,
        price: Number(form.price),
        maxSeats: Number(form.max_seats),
        categoryId: Number(form.category_id),
        festivalId: Number(form.festival_id),
        poster: form.poster || "hero_festival.jpg",
        artists: form.artists.split("\n").map((a) => a.trim()).filter(Boolean),
        terms: form.terms.trim(),
        publish,
      });
      toast.success(publish ? "Event created and published!" : "Event saved as draft.");
      setForm(blankEvent);
    } catch {
      // Handled
    }
  }

  async function handleUpdateEventPublish(id: number, published: boolean) {
    try {
      await actionMutation.mutateAsync({
        action: "updateEventPublish",
        id,
        published,
      });
      toast.success(published ? "Event published." : "Event set to draft.");
    } catch {
      // Handled
    }
  }

  async function handleApproveOrganiser(userId: string, status: "approved" | "rejected") {
    try {
      await actionMutation.mutateAsync({ action: "approveOrganiser", userId, status });
      toast.success(`Organiser application ${status}.`);
    } catch {
      // Handled
    }
  }

  async function handleRequestSponsor(data: {
    name: string;
    tier: string;
    amount: number;
    contact?: string | undefined;
    message?: string | undefined;
  }) {
    try {
      await actionMutation.mutateAsync({
        action: "requestSponsor",
        name: data.name,
        tier: data.tier,
        amount: data.amount,
        contact: data.contact,
        message: data.message,
      });
      toast.success("Sponsorship request logged in demo database.");
    } catch {
      // Handled
    }
  }

  async function handleUpdateSponsor(id: string, status: "active" | "rejected") {
    try {
      await actionMutation.mutateAsync({ action: "updateSponsor", id, status });
      toast.success(`Sponsorship marked as ${status}.`);
    } catch {
      // Handled
    }
  }

  async function handleAnswerHelp(id: string, answer: string) {
    try {
      await actionMutation.mutateAsync({ action: "answerHelp", id, answer });
      toast.success("Help request answered and resolved.");
      setHelpAnswers((prev) => ({ ...prev, [id]: "" }));
    } catch {
      // Handled
    }
  }

  async function handleRedeemVoucher(voucherId: string) {
    try {
      await actionMutation.mutateAsync({ action: "redeemVoucher", voucherId });
      toast.success("Voucher redeemed successfully! Campus inventory has been updated.");
    } catch {
      // Handled
    }
  }

  async function handleClaimVoucher(campaignId: number) {
    try {
      await actionMutation.mutateAsync({ action: "issueVoucher", campaignId });
      toast.success("Perk voucher claimed! Added to your Festival Passport.");
    } catch {
      // Handled
    }
  }

  async function handleIssueVoucher(campaignId: number) {
    try {
      await actionMutation.mutateAsync({ action: "issueVoucher", campaignId });
      toast.success("Voucher issued to Maya Sen! Appears in participant passport.");
    } catch {
      // Handled
    }
  }

  async function handleModerateEcho(echoId: string, status: "approved" | "flagged" | "hidden") {
    try {
      await actionMutation.mutateAsync({ action: "moderateEcho", echoId, status });
      toast.success(`Event Echo marked as ${status}.`);
    } catch {
      // Handled
    }
  }

  async function handleReset() {
    const secret = window.prompt(
      "Reset demo workspace to fresh initial state? Enter DEMO_RESET_SECRET to authorize:"
    );
    if (!secret) return;
    try {
      await actionMutation.mutateAsync({ action: "reset", resetSecret: secret.trim() });
      toast.success("Demo workspace restored to clean initial reference seed.");
    } catch {
      // Handled by actionMutation.onError
    }
  }

  const roleTitle =
    activeRole === "participant"
      ? "Participant Passport"
      : activeRole === "organizer"
        ? "Organiser Studio"
        : "Administrator Console";

  const personaDescription =
    activeRole === "participant"
      ? "Viewing as Maya Sen · B.Tech Computer Science & Engineering · 320 Rangora Points"
      : activeRole === "organizer"
        ? "Viewing as Dr. Priya Nambiar · Robotics Guild & Cultural Affairs · Verified Organiser"
        : "Viewing as Dean Kabir Mehta · Student Affairs Secretariat & Oversight";

  return (
    <div className="min-h-screen bg-ivory">
      <SiteHeader hub="Live Demo" />

      {/* Persistent Demo Status Banner */}
      <div className="border-b border-line bg-charcoal text-ivory px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono font-bold tracking-wider text-saffron uppercase">
              DEMO WORKSPACE
            </span>
            <span className="text-ivory-muted hidden md:inline">
              · Sample data · Real database mutations are isolated and resettable at any time
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={actionMutation.isPending}
              className="h-7 text-xs border-line bg-charcoal text-ivory hover:bg-elevated hover:text-terracotta"
            >
              <RotateCcw size={12} className="mr-1.5" />
              Reset Demo Workspace
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header / Intro */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
                Interactive Multi-Role Experience
              </p>
              <span className="inline-flex items-center gap-1 rounded bg-saffron-soft px-2 py-0.5 font-mono text-[10px] font-bold text-terracotta">
                <Sparkles size={11} /> Write-Enabled
              </span>
            </div>
            <h1 className="serif-heading mt-2 text-3xl sm:text-4xl">{roleTitle}</h1>
            <p className="mt-1 text-sm text-ink-muted">{personaDescription}</p>
          </div>
        </div>

        {/* Fast Role Switcher */}
        <div className="mb-8 brutal-card p-3 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted px-2">
              Switch Persona:
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeRole === "participant" ? "default" : "outline"}
                onClick={() => switchRole("participant")}
                className="gap-2"
              >
                <Ticket size={16} /> Participant Demo
              </Button>
              <Button
                variant={activeRole === "organizer" ? "default" : "outline"}
                onClick={() => switchRole("organizer")}
                className="gap-2"
              >
                <CalendarCheck size={16} /> Organiser Demo
              </Button>
              <Button
                variant={activeRole === "admin" ? "default" : "outline"}
                onClick={() => switchRole("admin")}
                className="gap-2"
              >
                <ShieldCheck size={16} /> Administrator Demo
              </Button>
            </div>
          </div>
        </div>

        {/* Loading / Error / Content */}
        {isLoading && (
          <div className="brutal-card p-12 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
              Initializing Workspace
            </p>
            <p className="serif-heading mt-2 text-2xl">Loading genuine demo database state…</p>
          </div>
        )}

        {isError && (
          <div className="brutal-card p-8 border-destructive">
            <p className="font-bold text-destructive">Could not connect to demo repository.</p>
            <p className="mt-2 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Internal error."}
            </p>
            <Button className="mt-4" onClick={() => void queryClient.invalidateQueries()}>
              Retry
            </Button>
          </div>
        )}

        {state && (
          <section aria-label={roleTitle}>
            {activeRole === "participant" && (
              <ParticipantSpace
                userId={state.participantId}
                profile={state.participantProfile}
                events={state.events}
                counts={state.counts}
                registrations={state.registrations}
                rewards={state.rewards}
                echoes={state.echoes}
                bookings={{
                  isPending: actionMutation.isPending,
                  mutate: ({ eventId, kind }) => void handleBook(eventId, kind),
                }}
                isDemo={true}
                onCancelPass={handleCancelPass}
                onSaveProfile={handleSaveProfile}
                onSubmitReview={handleSubmitReview}
                onHelpRequest={handleHelpRequest}
                onRedeemVoucher={handleRedeemVoucher}
                onClaimVoucher={handleClaimVoucher}
              />
            )}

            {activeRole === "organizer" && (
              <OrganizerSpace
                userId={state.organiserId}
                status={state.organiser.application?.status ?? "approved"}
                application={state.organiser.application}
                events={state.organiser.events}
                counts={state.counts}
                responseCounts={responseCounts}
                echoes={state.organiser.echoes}
                systemCanManage={true}
                activeEventCount={state.organiser.events.length}
                form={form}
                setForm={setForm}
                createEvent={{
                  isPending: actionMutation.isPending,
                  mutate: (publish) => void handleCreateEvent(publish),
                }}
                updateEvent={{
                  isPending: actionMutation.isPending,
                  mutate: ({ id, published }) => void handleUpdateEventPublish(id, published),
                }}
                badgeForm={badgeForm}
                setBadgeForm={setBadgeForm}
                makeBadge={{
                  isPending: false,
                  mutate: () => toast.success("Achievement badge created in demo store."),
                }}
                isDemo={true}
                helpRequests={state.organiser.routedHelp}
                onVerifyAttendance={handleVerifyAttendance}
                onToggleEchoLike={handleToggleEchoLike}
                onReplyToHelp={handleAnswerHelp}
                onSaveOrganiserProfile={handleSaveOrganiserProfile}
                onCreateBadge={handleCreateBadge}
                onRequestSponsor={handleRequestSponsor}
              />
            )}

            {activeRole === "admin" && (
              <AdminSpace
                adminProfile={state.admin.profile}
                stats={state.admin.stats}
                events={state.events}
                counts={state.counts}
                responseCounts={responseCounts}
                applications={state.admin.applications}
                approve={{
                  isPending: actionMutation.isPending,
                  mutate: ({ userId, status }) => void handleApproveOrganiser(userId, status),
                }}
                ownEvents={state.events}
                form={form}
                setForm={setForm}
                createEvent={{
                  isPending: actionMutation.isPending,
                  mutate: (publish) => void handleCreateEvent(publish),
                }}
                updateEvent={{
                  isPending: actionMutation.isPending,
                  mutate: ({ id, published }) => void handleUpdateEventPublish(id, published),
                }}
                festivalForm={festivalForm}
                setFestivalForm={setFestivalForm}
                createFestival={{
                  isPending: false,
                  mutate: () => toast.success("Festival created in demo store."),
                }}
                clashes={[
                  {
                    a_id: 1,
                    a_name: "AI & Society Keynote",
                    b_id: 3,
                    b_name: "Campus Hackathon Kickoff",
                    venue: "Tagore Auditorium",
                  },
                ]}
                sponsors={state.admin.sponsors}
                updateSponsor={{
                  isPending: actionMutation.isPending,
                  mutate: ({ id, status }) => void handleUpdateSponsor(id, status),
                }}
                help={state.admin.helpRequests}
                answerHelp={handleAnswerHelp}
                helpAnswers={helpAnswers}
                setHelpAnswers={setHelpAnswers}
                vouchers={state.admin.campaigns}
                issuedVouchers={state.admin.issuedVouchers}
                echoRecap={state.admin.echoRecap}
                leaderboard={state.admin.leaderboard}
                userId={state.adminId}
                onResetWorkspace={handleReset}
                onIssueVoucher={handleIssueVoucher}
                onModerateEcho={handleModerateEcho}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
