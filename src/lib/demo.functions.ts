import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  demoDbRepo,
} from "./demo-db/repository";
import {
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_ADMIN_ID,
} from "./demo-db/seed";

export const getDemoState = createServerFn({ method: "GET" })
  .handler(async () => {
    const state = await demoDbRepo.getState();
    const counts = await demoDbRepo.getBookedCounts();

    const participantRegistrations = state.registrations.filter((r) => r.user_id === DEMO_PARTICIPANT_ID);
    const participantBadges = state.userAchievements.filter((a) => a.user_id === DEMO_PARTICIPANT_ID);
    const participantVouchers = state.userVouchers.filter((v) => v.user_id === DEMO_PARTICIPANT_ID);
    const participantEchoes = state.echoes.filter((e) => e.user_id === DEMO_PARTICIPANT_ID);

    const organiserEvents = state.events.filter((e) => e.organiserId === DEMO_ORGANISER_ID);
    const organiserEchoes = state.echoes.filter((e) =>
      organiserEvents.some((ev) => ev.id === e.event_id)
    );
    const organiserApplication = state.organisers.find((o) => o.user_id === DEMO_ORGANISER_ID);

    const adminStats = {
      events: state.events.filter((e) => e.published).length,
      festivals: 6,
      bookings: state.registrations.filter((r) => r.kind === "booked").length,
      participants: 1248 + participantRegistrations.filter((r) => r.kind === "booked").length,
      organisers: state.organisers.filter((o) => o.status === "approved").length,
      reviews: state.echoes.length,
      average_rating:
        state.echoes.length > 0
          ? Number((state.echoes.reduce((sum, e) => sum + e.rating, 0) / state.echoes.length).toFixed(1))
          : 4.8,
    };

    const issuedVouchersMap: Record<number, number> = {};
    for (const v of state.userVouchers) {
      issuedVouchersMap[v.campaign_id] = (issuedVouchersMap[v.campaign_id] ?? 0) + 1;
    }

    return {
      participantId: DEMO_PARTICIPANT_ID,
      organiserId: DEMO_ORGANISER_ID,
      adminId: DEMO_ADMIN_ID,
      participantProfile: state.participantProfile,
      organiserProfile: state.organiserProfile,
      events: state.events,
      counts,
      registrations: participantRegistrations,
      rewards: {
        badges: participantBadges,
        vouchers: participantVouchers,
      },
      echoes: participantEchoes,
      organiser: {
        application: organiserApplication,
        events: organiserEvents,
        echoes: organiserEchoes,
        routedHelp: state.helpRequests.filter((h) => h.routed_to === DEMO_ORGANISER_ID),
        sponsors: state.sponsors.filter((s) => s.user_id === DEMO_ORGANISER_ID),
      },
      admin: {
        profile: {
          office: "Student Affairs Secretariat",
          designation: "Campus Festival Administrator",
          staff_id: "ADMIN-SEC-001",
          status: "approved",
        },
        stats: adminStats,
        applications: state.organisers,
        sponsors: state.sponsors,
        helpRequests: state.helpRequests,
        campaigns: state.campaigns,
        issuedVouchers: issuedVouchersMap,
        echoRecap: state.echoes,
        leaderboard: state.leaderboard,
      },
    };
  });

const demoActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("book"),
    eventId: z.number().int().positive(),
    kind: z.enum(["booked", "planned"]),
  }),
  z.object({
    action: z.literal("cancel"),
    registrationId: z.string().min(1),
  }),
  z.object({
    action: z.literal("saveInterests"),
    preferences: z.array(z.string()),
  }),
  z.object({
    action: z.literal("updateParticipantProfile"),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    department: z.string().optional(),
    course: z.string().optional(),
    preferences: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("updateOrganiserProfile"),
    orgName: z.string().optional(),
    position: z.string().optional(),
    orgType: z.string().optional(),
    description: z.string().optional(),
    institutionalId: z.string().optional(),
  }),
  z.object({
    action: z.literal("createBadge"),
    eventId: z.number().int().positive(),
    title: z.string().min(2),
    description: z.string().default(""),
    points: z.number().int().min(0).max(500).default(20),
  }),
  z.object({
    action: z.literal("verifyAttendance"),
    passCode: z.string().min(3),
    eventId: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("createEvent"),
    name: z.string().min(2),
    subtitle: z.string().min(2),
    description: z.string().min(5),
    venue: z.string().min(2),
    startAt: z.string(),
    endAt: z.string(),
    price: z.number().min(0),
    maxSeats: z.number().min(1).max(10000),
    categoryId: z.number(),
    festivalId: z.number(),
    poster: z.string().default("hero_festival.jpg"),
    artists: z.array(z.string()).default([]),
    terms: z.string().default(""),
    publish: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("updateEventPublish"),
    id: z.number().int().positive(),
    published: z.boolean(),
  }),
  z.object({
    action: z.literal("submitEcho"),
    eventId: z.number().int().positive(),
    rating: z.number().min(1).max(5),
    comment: z.string().min(3).max(1500),
    taggedFriends: z.array(z.string()).default([]),
    media: z.array(z.object({ path: z.string(), name: z.string(), type: z.string() })).default([]),
    visibility: z.enum(["private", "campus", "public"]).default("private"),
    publicConsent: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("toggleEchoLike"),
    echoId: z.string().min(1),
  }),
  z.object({
    action: z.literal("reportEcho"),
    echoId: z.string().min(1),
  }),
  z.object({
    action: z.literal("moderateEcho"),
    echoId: z.string().min(1),
    status: z.enum(["approved", "flagged", "hidden"]),
  }),
  z.object({
    action: z.literal("approveOrganiser"),
    userId: z.string().min(1),
    status: z.enum(["approved", "rejected"]),
  }),
  z.object({
    action: z.literal("updateVoucherStock"),
    id: z.number().int().positive(),
    stock: z.number().int().min(0),
  }),
  z.object({
    action: z.literal("answerHelp"),
    id: z.string().min(1),
    answer: z.string().min(2).max(2000),
  }),
  z.object({
    action: z.literal("sendHelpRequest"),
    category: z.string(),
    eventId: z.number().nullable().optional(),
    subject: z.string().min(3).max(150),
    message: z.string().min(5).max(2000),
  }),
  z.object({
    action: z.literal("requestSponsor"),
    name: z.string().min(2).max(120),
    tier: z.string(),
    amount: z.number().min(0),
    contact: z.string().optional(),
    message: z.string().optional(),
  }),
  z.object({
    action: z.literal("updateSponsor"),
    id: z.string().min(1),
    status: z.enum(["active", "rejected"]),
  }),
  z.object({
    action: z.literal("issueVoucher"),
    campaignId: z.number().int().positive(),
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("redeemVoucher"),
    voucherId: z.string().min(1),
    userId: z.string().optional(),
  }),
  z.object({
    action: z.literal("reset"),
    resetSecret: z.string().optional(),
  }),
]);

export type DemoActionInput = z.infer<typeof demoActionSchema>;

export const performDemoAction = createServerFn({ method: "POST" })
  .validator((input: DemoActionInput) => demoActionSchema.parse(input))
  .handler(async ({ data }) => {
    // Verify demo mode is not globally disabled
    if (typeof process !== "undefined" && process.env["RANGORA_DEMO_MODE"] === "false") {
      throw new Error("Interactive demo mode is disabled on this server instance.");
    }

    switch (data.action) {
      case "book":
        return await demoDbRepo.bookPass(DEMO_PARTICIPANT_ID, data.eventId, data.kind);
      case "cancel":
        await demoDbRepo.cancelPass(DEMO_PARTICIPANT_ID, data.registrationId);
        return { success: true };
      case "saveInterests":
        await demoDbRepo.saveInterests(DEMO_PARTICIPANT_ID, data.preferences);
        return { success: true };
      case "updateParticipantProfile":
        await demoDbRepo.updateParticipantProfile(DEMO_PARTICIPANT_ID, {
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          department: data.department,
          course: data.course,
          preferences: data.preferences,
        });
        return { success: true };
      case "updateOrganiserProfile":
        await demoDbRepo.updateOrganiserProfile(DEMO_ORGANISER_ID, {
          orgName: data.orgName,
          position: data.position,
          orgType: data.orgType,
          description: data.description,
          institutionalId: data.institutionalId,
        });
        return { success: true };
      case "createBadge":
        return await demoDbRepo.createBadge(
          DEMO_ORGANISER_ID,
          data.eventId,
          data.title,
          data.description,
          data.points
        );
      case "verifyAttendance":
        return await demoDbRepo.verifyAttendance(data.passCode, data.eventId, DEMO_ORGANISER_ID);
      case "createEvent":
        return await demoDbRepo.createEvent(
          DEMO_ORGANISER_ID,
          {
            name: data.name,
            subtitle: data.subtitle,
            description: data.description,
            venue: data.venue,
            startAt: data.startAt,
            endAt: data.endAt,
            price: data.price,
            maxSeats: data.maxSeats,
            categoryId: data.categoryId,
            festivalId: data.festivalId,
            poster: data.poster,
            artists: data.artists,
            terms: data.terms,
          },
          data.publish
        );
      case "updateEventPublish":
        await demoDbRepo.updateEventPublish(data.id, data.published);
        return { success: true };
      case "submitEcho":
        return await demoDbRepo.submitEcho(
          DEMO_PARTICIPANT_ID,
          "Maya Sen",
          data.eventId,
          data.rating,
          data.comment,
          data.taggedFriends,
          data.media,
          data.visibility,
          data.publicConsent
        );
      case "toggleEchoLike":
        return { liked: await demoDbRepo.toggleEchoLike(data.echoId) };
      case "reportEcho":
        await demoDbRepo.reportEcho(data.echoId);
        return { success: true };
      case "moderateEcho":
        await demoDbRepo.moderateEcho(data.echoId, data.status);
        return { success: true };
      case "approveOrganiser":
        await demoDbRepo.approveOrganiser(data.userId, data.status);
        return { success: true };
      case "updateVoucherStock":
        await demoDbRepo.updateVoucherStock(data.id, data.stock);
        return { success: true };
      case "issueVoucher":
        return await demoDbRepo.issueVoucher(data.userId || DEMO_PARTICIPANT_ID, data.campaignId);
      case "redeemVoucher":
        await demoDbRepo.redeemVoucher(data.userId || DEMO_PARTICIPANT_ID, data.voucherId);
        return { success: true };
      case "answerHelp":
        await demoDbRepo.answerHelp(data.id, data.answer);
        return { success: true };
      case "sendHelpRequest":
        return await demoDbRepo.createHelpRequest(
          DEMO_PARTICIPANT_ID,
          "Maya Sen",
          data.category,
          data.subject,
          data.message,
          data.eventId ?? null
        );
      case "requestSponsor":
        return await demoDbRepo.requestSponsor(
          DEMO_ORGANISER_ID,
          data.name,
          data.tier,
          data.amount,
          data.contact,
          data.message
        );
      case "updateSponsor":
        await demoDbRepo.updateSponsorStatus(data.id, data.status);
        return { success: true };
      case "reset": {
        const configuredSecret = typeof process !== "undefined" ? process.env["DEMO_RESET_SECRET"] : undefined;
        // Fail-closed policy: Destructive resets require an explicit DEMO_RESET_SECRET on the server.
        if (!configuredSecret) {
          throw new Error("Reset denied: DEMO_RESET_SECRET is not configured on the server. Workspace reset is disabled.");
        }
        if (!data.resetSecret || data.resetSecret !== configuredSecret) {
          throw new Error("Reset denied: Invalid DEMO_RESET_SECRET provided.");
        }
        await demoDbRepo.reset();
        return { success: true, message: "Demo workspace reset to initial reference seed." };
      }
    }
  });

// Keep legacy export name for compatibility with any existing imports
export const unlockPresentationDemo = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ passphrase: z.string().optional() }).parse(input))
  .handler(async () => {
    return { token: "public-demo-access-granted" };
  });

export const loadPresentationDemo = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().optional() }).parse(input))
  .handler(async () => {
    const fullState = await getDemoState();
    return {
      participant: {
        name: fullState.participantProfile.full_name,
        department: fullState.participantProfile.department,
        bookings: fullState.registrations.map((r) => ({
          event: fullState.events.find((e) => e.id === r.event_id)?.name ?? `Event #${r.event_id}`,
          pass: r.pass_code,
          date: r.created_at,
        })),
        badges: fullState.rewards.badges.map((b) => b.code),
        vouchers: fullState.rewards.vouchers.map((v) => v.code),
        echoes: fullState.echoes.map((e) => ({
          event: fullState.events.find((ev) => ev.id === e.event_id)?.name ?? `Event #${e.event_id}`,
          rating: e.rating,
          liked: e.liked_by_organiser,
          note: e.comment,
        })),
        rank: 4,
      },
      organiser: {
        name: fullState.organiserProfile.full_name,
        organisation: fullState.organiser.application?.org_name ?? "Campus Arts Guild",
        approval: fullState.organiser.application?.status ?? "approved",
        events: fullState.organiser.events.map((e) => ({
          name: e.name,
          status: e.published ? "Published" : "Draft",
          seats: `${fullState.counts[e.id] ?? 0} / ${e.maxSeats}`,
          responses: fullState.echoes.filter((ec) => ec.event_id === e.id).length,
        })),
        badges: ["Guild Artisan", "Studio Debut"],
        echoes: fullState.organiser.echoes.map((e) => ({
          author: e.author_name,
          rating: e.rating,
          liked: e.liked_by_organiser,
          note: e.comment,
        })),
        venueConflicts: 0,
      },
      administrator: {
        name: "Rangora Administrator",
        metrics: [
          { label: "Published events", value: String(fullState.admin.stats.events) },
          { label: "Festivals", value: String(fullState.admin.stats.festivals) },
          { label: "Participants", value: String(fullState.admin.stats.participants) },
          { label: "Event Echoes", value: String(fullState.admin.stats.reviews) },
        ],
        applications: fullState.admin.applications.map((a) => ({
          organisation: a.org_name,
          status: a.status,
        })),
        sponsorships: fullState.admin.sponsors.map((s) => ({
          name: s.name,
          tier: s.tier,
          status: s.status,
        })),
        echoes: fullState.admin.echoRecap.map((e) => ({
          event: fullState.events.find((ev) => ev.id === e.event_id)?.name ?? `Event #${e.event_id}`,
          author: e.author_name,
          rating: e.rating,
          liked: e.liked_by_organiser,
          note: e.comment,
        })),
        helpRequests: fullState.admin.helpRequests.map((h) => ({
          topic: h.subject,
          routed: h.routed_to ? "Organiser" : "Administrator",
          status: h.status,
        })),
        voucherStock: "184 remaining",
      },
    };
  });
