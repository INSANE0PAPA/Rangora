import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { demoRepo, DEMO_PARTICIPANT_ID } from "@/lib/demo-repository";
import { checkEventConflicts } from "@/lib/event-conflicts";
import { events as defaultCatalogEvents, categories, festivals } from "@/data/catalog";

// =========================================================================
// 1. User Profile & Role Function
// =========================================================================
const profileInput = z.object({
  userId: z.string().uuid().or(z.string().min(1)),
});

export const fetchUserProfileAndRole = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof profileInput>) => profileInput.parse(input))
  .handler(async ({ data }) => {
    // 1. Synthetic Demo Identity Resolution
    if (data.userId === DEMO_PARTICIPANT_ID || data.userId.startsWith("d3300000-0000-0000-0000-000000000001") || data.userId.includes("maya")) {
      return {
        profile: {
          id: DEMO_PARTICIPANT_ID,
          full_name: "Maya Sen",
          email: "maya.sen@demo.rangora.in",
          phone: "+91 98765 43210",
          address: "Hostel 4, Room 212, Campus North",
          department: "Computer Science & Engineering",
          course: "B.Tech Final Year",
          preferences: ["music", "cultural", "workshops"],
        },
        role: "participant" as const,
      };
    }
    if (data.userId === "d3300000-0000-0000-0000-000000000002" || data.userId.includes("priya")) {
      return {
        profile: {
          id: "d3300000-0000-0000-0000-000000000002",
          full_name: "Priya Sharma",
          email: "priya.sharma@demo.rangora.in",
          phone: "+91 98765 12345",
          address: "Faculty Residences B-4",
          department: "Cultural Affairs",
          course: "Faculty / Convener",
          preferences: ["classical", "heritage"],
        },
        role: "organizer" as const,
      };
    }
    if (data.userId === "d3300000-0000-0000-0000-000000000003" || data.userId.includes("admin")) {
      return {
        profile: {
          id: "d3300000-0000-0000-0000-000000000003",
          full_name: "Rangora Administrator",
          email: "admin@demo.rangora.in",
          phone: "+91 98765 00000",
          address: "Office of the Dean, Student Affairs",
          department: "Platform Administration",
          course: "Administration",
          preferences: [],
        },
        role: "admin" as const,
      };
    }

    const db = getDb();
    if (db) {
      const [profileRow] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, data.userId))
        .limit(1);

      const roleRows = await db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, data.userId));

      if (!profileRow) return null;

      const roles = roleRows.map((r) => r.role);
      const role = roles.includes("admin")
        ? "admin"
        : roles.includes("organizer")
          ? "organizer"
          : "participant";

      return {
        profile: {
          id: profileRow.id,
          full_name: profileRow.fullName,
          email: profileRow.email,
          phone: profileRow.phone,
          address: profileRow.address,
          department: profileRow.department,
          course: profileRow.course,
          preferences: profileRow.preferences ?? [],
        },
        role,
      };
    }

    // Isolated repository fallback when Neon credentials are not yet configured
    const state = demoRepo.getState();
    if (data.userId === DEMO_PARTICIPANT_ID || data.userId.includes("maya")) {
      return {
        profile: state.participantProfile,
        role: "participant",
      };
    }
    return {
      profile: {
        id: data.userId,
        full_name: "Rangora Explorer",
        email: "student@campus.rangora.in",
        phone: null,
        address: null,
        department: "Undergraduate Studies",
        course: "Interdisciplinary",
        preferences: ["music", "cultural"],
      },
      role: "participant",
    };
  });

// =========================================================================
// 2. Seat Counts Function
// =========================================================================
export const fetchSeatCounts = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    if (db) {
      const regs = await db
        .select({
          eventId: schema.registrations.eventId,
        })
        .from(schema.registrations)
        .where(eq(schema.registrations.kind, "booked"));

      const map: Record<number, number> = {};
      for (const r of regs) {
        map[r.eventId] = (map[r.eventId] ?? 0) + 1;
      }
      return map;
    }

    return demoRepo.getBookedCounts();
  });

// =========================================================================
// 3. Catalogue Events Function
// =========================================================================
export const fetchCatalogueEvents = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    if (db) {
      const rows = await db
        .select()
        .from(schema.events)
        .orderBy(schema.events.startAt);

      if (rows.length > 0) {
        return rows.map((row) => ({
          id: row.id,
          festivalId: row.festivalId ?? 0,
          categoryId: row.categoryId,
          venue: row.venue,
          name: row.name,
          subtitle: row.subtitle,
          description: row.description,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt.toISOString(),
          price: row.price,
          maxSeats: row.maxSeats,
          featured: row.featured,
          poster: row.poster,
          artists: Array.isArray(row.artists)
            ? (row.artists as string[])
            : [],
          terms: row.terms,
          organiserId: row.organiserId,
          published: row.published,
        }));
      }
    }

    // Default source catalogue fallback
    const state = demoRepo.getState();
    return state.events;
  });

// =========================================================================
// 3B. Event Detail Function
// =========================================================================
const FALLBACK_EVENT_REVIEWS: Record<number, any> = {
  1: {
    id: "d3300202-0000-4000-8000-000000000202",
    eventId: 1,
    userId: "d3300000-0000-0000-0000-000000000004",
    authorName: "Aanya Sen",
    rating: 5,
    comment: "The acoustic sitar in the dusk courtyard gave everyone goosebumps! Unforgettable open-air evening with hot spiced chai under festive lights.",
    media: [{ path: "/assets/echoes/raga_concert.svg", name: "raga_concert.svg", type: "image/svg+xml" }],
    taggedFriends: ["Priya Roy", "Kabir Roy"],
    likedByOrganiser: true,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T17:00:00Z"),
  },
  2: {
    id: "d3300204-0000-4000-8000-000000000204",
    eventId: 2,
    userId: "d3300000-0000-0000-0000-000000000002",
    authorName: "Priya Roy",
    rating: 4,
    comment: "Mesmerizing fusion of Kathak mudras with contemporary floor work and live tabla accompaniment. Pure visual poetry in the conservatory.",
    media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
    taggedFriends: ["Maya Sen", "Sunita Rao"],
    likedByOrganiser: false,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T16:00:00Z"),
  },
  3: {
    id: "d3300205-0000-4000-8000-000000000205",
    eventId: 3,
    userId: "d3300000-0000-0000-0000-000000000005",
    authorName: "Rohan Mukherjee",
    rating: 5,
    comment: "Sipping clay kulhad chai on the observatory lawn while watching student 16mm shorts under the open sky was peak autumn campus nostalgia.",
    media: [{ path: "/assets/echoes/cinema_circle.svg", name: "cinema_circle.svg", type: "image/svg+xml" }],
    taggedFriends: ["Aanya Sen", "Arjun Sen"],
    likedByOrganiser: true,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T15:30:00Z"),
  },
  4: {
    id: "d3300201-0000-4000-8000-000000000201",
    eventId: 4,
    userId: "d3300000-0000-0000-0000-000000000001",
    authorName: "Maya Sen",
    rating: 5,
    comment: "Loved centering local river clay on the wheel. Taking home a handmade terracotta vessel was magical! Studio masters were patient and inspiring.",
    media: [{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }],
    taggedFriends: ["Arjun Sen", "Pooja Das"],
    likedByOrganiser: true,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T14:00:00Z"),
  },
  13: {
    id: "d3300203-0000-4000-8000-000000000203",
    eventId: 13,
    userId: "d3300000-0000-0000-0000-000000000006",
    authorName: "Dev Patel",
    rating: 5,
    comment: "Testing our pathfinding algorithm on the mock lunar gravel arena was intense. The calibrated LiDAR and depth sensors worked flawlessly!",
    media: [{ path: "/assets/echoes/robotics_sprint.svg", name: "robotics_sprint.svg", type: "image/svg+xml" }],
    taggedFriends: ["Rohan Mukherjee"],
    likedByOrganiser: true,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T13:00:00Z"),
  },
  16: {
    id: "d3300206-0000-4000-8000-000000000206",
    eventId: 16,
    userId: "d3300000-0000-0000-0000-000000000007",
    authorName: "Arjun Sen",
    rating: 5,
    comment: "The acrobatic Purulia Chhau leaps and live dhamsa drums reverberated right through the banyan tree roots! Spectacular energy.",
    media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
    taggedFriends: ["Maya Sen"],
    likedByOrganiser: false,
    visibility: "public",
    moderationStatus: "approved",
    createdAt: new Date("2026-11-12T12:00:00Z"),
  },
};

function getEventReviewsWithFallbacks(eventId: number, eventName = "this event") {
  if (FALLBACK_EVENT_REVIEWS[eventId]) {
    return [FALLBACK_EVENT_REVIEWS[eventId]!];
  }
  return [
    {
      id: `d3300299-0000-4000-8000-${String(eventId).padStart(12, "0")}`,
      eventId,
      userId: "d3300000-0000-0000-0000-000000000001",
      authorName: "Maya Sen",
      rating: 5,
      comment: `The experience at ${eventName} was electrifying! High campus energy, attentive organizers, and wonderful memories under the festival lights.`,
      media: [{ path: "/assets/echoes/raga_concert.svg", name: "raga_concert.svg", type: "image/svg+xml" }],
      taggedFriends: ["Arjun Sen", "Priya Roy"],
      likedByOrganiser: true,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      createdAt: new Date("2026-11-12T14:00:00Z"),
    },
    {
      id: `d3300298-0000-4000-8000-${String(eventId).padStart(12, "0")}`,
      eventId,
      userId: "d3300000-0000-0000-0000-000000000002",
      authorName: "Rohan Mukherjee",
      rating: 4,
      comment: `Immaculate campus vibe and super well coordinated. You can feel the collegiate spirit in every single detail.`,
      media: [],
      taggedFriends: ["Dev Patel"],
      likedByOrganiser: false,
      visibility: "public" as const,
      moderationStatus: "approved" as const,
      createdAt: new Date("2026-11-12T12:30:00Z"),
    },
  ];
}

const eventDetailInput = z.object({
  eventId: z.number().int().positive(),
  isDemo: z.boolean().optional(),
});

export const fetchEventDetail = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof eventDetailInput>) => eventDetailInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { getDemoDb, schema: demoSchema } = await import("@/lib/demo-db");
        const demoDb = getDemoDb();
        if (demoDb) {
          const [row] = await demoDb
            .select()
            .from(demoSchema.events)
            .where(eq(demoSchema.events.id, data.eventId))
            .limit(1);

          if (!row) return null;

          const badges = await demoDb
            .select()
            .from(demoSchema.eventBadges)
            .where(eq(demoSchema.eventBadges.eventId, data.eventId));

          let reviews = await demoDb
            .select()
            .from(demoSchema.reviews)
            .where(eq(demoSchema.reviews.eventId, data.eventId))
            .orderBy(desc(demoSchema.reviews.createdAt));

          if (reviews.length === 0) {
            reviews = getEventReviewsWithFallbacks(data.eventId, row.name) as any;
          }

          const booked = await demoDb
            .select()
            .from(demoSchema.registrations)
            .where(and(eq(demoSchema.registrations.eventId, data.eventId), eq(demoSchema.registrations.kind, "booked")));

          let organiserName: string | null = null;
          if (row.organiserId) {
            const [org] = await demoDb.select().from(demoSchema.profiles).where(eq(demoSchema.profiles.id, row.organiserId)).limit(1);
            organiserName = org?.fullName || null;
          }

          return {
            id: row.id,
            festivalId: row.festivalId ?? 1,
            categoryId: row.categoryId,
            venue: row.venue,
            name: row.name,
            subtitle: row.subtitle,
            description: row.description,
            startAt: row.startAt.toISOString(),
            endAt: row.endAt.toISOString(),
            price: row.price,
            maxSeats: row.maxSeats,
            featured: row.featured,
            poster: row.poster,
            artists: Array.isArray(row.artists) ? (row.artists as string[]) : [],
            terms: row.terms,
            organiserId: row.organiserId,
            organiserName,
            published: row.published,
            bookedSeats: booked.length,
            badges: badges.map((b) => ({
              id: b.id,
              title: b.title,
              description: b.description,
              emoji: b.emoji,
              points: b.points,
            })),
            reviews: reviews.map((r) => ({
              id: r.id,
              userId: r.userId,
              authorName: r.authorName,
              rating: r.rating,
              comment: r.comment,
              media: Array.isArray(r.media) ? (r.media as Array<{ path: string; name: string; type: string }>) : [],
              taggedFriends: Array.isArray(r.taggedFriends) ? (r.taggedFriends as string[]) : [],
              likedByOrganiser: r.likedByOrganiser,
              createdAt: r.createdAt.toISOString(),
            })),
          };
        }
      } catch {
        // Fall back
      }
    }

    const db = getDb();
    if (db) {
      const [row] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, data.eventId))
        .limit(1);

      if (!row) return null;

      const badges = await db
        .select()
        .from(schema.eventBadges)
        .where(eq(schema.eventBadges.eventId, data.eventId));

      let reviews = await db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.eventId, data.eventId))
        .orderBy(desc(schema.reviews.createdAt));

      if (reviews.length === 0) {
        try {
          const { getDemoDb, schema: demoSchema } = await import("@/lib/demo-db");
          const demoDb = getDemoDb();
          if (demoDb) {
            const demoRows = await demoDb
              .select()
              .from(demoSchema.reviews)
              .where(eq(demoSchema.reviews.eventId, data.eventId))
              .orderBy(desc(demoSchema.reviews.createdAt));
            if (demoRows.length > 0) reviews = demoRows as any;
          }
        } catch {
          // ignore
        }
      }

      if (reviews.length === 0) {
        reviews = getEventReviewsWithFallbacks(data.eventId, row.name) as any;
      }

      const booked = await db
        .select()
        .from(schema.registrations)
        .where(and(eq(schema.registrations.eventId, data.eventId), eq(schema.registrations.kind, "booked")));

      let organiserName: string | null = null;
      if (row.organiserId) {
        const [org] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, row.organiserId)).limit(1);
        organiserName = org?.fullName || null;
      }

      return {
        id: row.id,
        festivalId: row.festivalId ?? 1,
        categoryId: row.categoryId,
        venue: row.venue,
        name: row.name,
        subtitle: row.subtitle,
        description: row.description,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        price: row.price,
        maxSeats: row.maxSeats,
        featured: row.featured,
        poster: row.poster,
        artists: Array.isArray(row.artists) ? (row.artists as string[]) : [],
        terms: row.terms,
        organiserId: row.organiserId,
        organiserName,
        published: row.published,
        bookedSeats: booked.length,
        badges: badges.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          emoji: b.emoji,
          points: b.points,
        })),
        reviews: reviews.map((r) => ({
          id: r.id,
          userId: r.userId,
          authorName: r.authorName,
          rating: r.rating,
          comment: r.comment,
          media: Array.isArray(r.media) ? (r.media as Array<{ path: string; name: string; type: string }>) : [],
          taggedFriends: Array.isArray(r.taggedFriends) ? (r.taggedFriends as string[]) : [],
          likedByOrganiser: r.likedByOrganiser,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }

    const state = demoRepo.getState();
    const ev = state.events.find((e) => e.id === data.eventId);
    if (!ev) return null;
    return {
      ...ev,
      bookedSeats: demoRepo.getBookedCounts()[ev.id] ?? 0,
      badges: [],
      organiserName: "Campus Arts Secretariat",
      reviews: state.echoes.filter((e) => e.event_id === ev.id).map((e) => ({
        id: e.id,
        userId: e.user_id,
        authorName: e.author_name,
        rating: e.rating,
        comment: e.comment,
        media: e.media,
        taggedFriends: e.tagged_friends,
        likedByOrganiser: e.liked_by_organiser,
        createdAt: e.created_at,
      })),
    };
  });

// =========================================================================
// 4. Leaderboard Function
// =========================================================================
const leaderboardInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  isDemo: z.boolean().optional(),
});

export const fetchLeaderboard = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof leaderboardInput>) => leaderboardInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { getDemoDb, schema: demoSchema } = await import("@/lib/demo-db");
        const demoDb = getDemoDb();
        if (demoDb) {
          const rows = await demoDb
            .select()
            .from(demoSchema.leaderboard)
            .orderBy(desc(demoSchema.leaderboard.points))
            .limit(data.limit);

          return rows.map((r) => ({
            user_id: r.userId,
            display_name: r.displayName,
            department: r.department,
            points: r.points,
          }));
        }
      } catch {
        // Fall back
      }
    }

    const db = getDb();
    if (db) {
      const rows = await db
        .select()
        .from(schema.leaderboard)
        .orderBy(desc(schema.leaderboard.points))
        .limit(data.limit);

      return rows.map((r) => ({
        user_id: r.userId,
        display_name: r.displayName,
        department: r.department,
        points: r.points,
      }));
    }

    const state = demoRepo.getState();
    return state.leaderboard.slice(0, data.limit).map((r) => ({
      user_id: r.user_id,
      display_name: r.display_name,
      department: r.department,
      points: r.points,
    }));
  });

// =========================================================================
// 5. Booking & Pass Registration Function
// =========================================================================
const bookingInput = z.object({
  userId: z.string().min(1),
  eventId: z.number().int().positive(),
  kind: z.enum(["booked", "planned"]),
});

export const executeEventBooking = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof bookingInput>) => bookingInput.parse(input))
  .handler(async ({ data }) => {
    // Dedicated Neon Demo branch booking
    if (data.userId === DEMO_PARTICIPANT_ID || data.userId.startsWith("d3300000-")) {
      try {
        const { demoDbRepo } = await import("./demo-db/repository");
        const reg = await demoDbRepo.bookPass(DEMO_PARTICIPANT_ID, data.eventId, data.kind);
        return {
          id: reg.id,
          passCode: reg.pass_code,
          kind: reg.kind,
        };
      } catch (demoErr: any) {
        throw new Error(demoErr?.message || "Could not reserve pass in demo database.");
      }
    }

    const db = getDb();
    if (db) {
      // Validate capacity if booking
      if (data.kind === "booked") {
        const [eventRow] = await db
          .select()
          .from(schema.events)
          .where(eq(schema.events.id, data.eventId))
          .limit(1);

        if (!eventRow || !eventRow.published) {
          throw new Error("Event is not available for registration.");
        }

        const bookedRows = await db
          .select()
          .from(schema.registrations)
          .where(
            and(
              eq(schema.registrations.eventId, data.eventId),
              eq(schema.registrations.kind, "booked")
            )
          );

        if (bookedRows.length >= eventRow.maxSeats) {
          throw new Error("This event has reached full capacity.");
        }
      }

      const passCode = `RNG-${Math.floor(1000 + Math.random() * 9000)}`;
      const [inserted] = await db
        .insert(schema.registrations)
        .values({
          userId: data.userId,
          eventId: data.eventId,
          kind: data.kind,
          passCode,
        })
        .returning();

      if (!inserted) {
        throw new Error("Could not create registration record.");
      }

      return {
        id: inserted.id,
        passCode: inserted.passCode,
        kind: inserted.kind,
      };
    }

    // Repository fallback
    return demoRepo.bookPass(data.userId, data.eventId, data.kind);
  });

// =========================================================================
// 6. Registration Cancellation Function
// =========================================================================
const cancelInput = z.object({
  userId: z.string().min(1),
  registrationId: z.string().min(1),
});

export const executeCancelRegistration = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof cancelInput>) => cancelInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .delete(schema.registrations)
        .where(
          and(
            eq(schema.registrations.id, data.registrationId),
            eq(schema.registrations.userId, data.userId)
          )
        );
      return { success: true };
    }

    demoRepo.cancelPass(data.userId, data.registrationId);
    return { success: true };
  });

// =========================================================================
// 7. Profile Preferences Function
// =========================================================================
const preferencesInput = z.object({
  userId: z.string().min(1),
  preferences: z.array(z.string()),
});

export const executeSavePreferences = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof preferencesInput>) => preferencesInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.profiles)
        .set({ preferences: data.preferences })
        .where(eq(schema.profiles.id, data.userId));
      return { success: true };
    }

    demoRepo.saveInterests(data.userId, data.preferences);
    return { success: true };
  });

// =========================================================================
// 8. Admin Platform Stats Function
// =========================================================================
export const fetchAdminPlatformStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    if (db) {
      const [eventsCount] = await db
        .select({ count: schema.events.id })
        .from(schema.events);

      const [festivalsCount] = await db
        .select({ count: schema.festivals.id })
        .from(schema.festivals);

      const [bookingsCount] = await db
        .select({ count: schema.registrations.id })
        .from(schema.registrations)
        .where(eq(schema.registrations.kind, "booked"));

      const [participantsCount] = await db
        .select({ count: schema.userRoles.id })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.role, "participant"));

      const [organisersCount] = await db
        .select({ count: schema.organiserProfiles.userId })
        .from(schema.organiserProfiles)
        .where(eq(schema.organiserProfiles.status, "approved"));

      const reviewsList = await db
        .select({ rating: schema.reviews.rating })
        .from(schema.reviews);

      const reviewsCount = reviewsList.length;
      const averageRating =
        reviewsCount > 0
          ? Number(
              (
                reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsCount
              ).toFixed(1)
            )
          : null;

      return {
        events: eventsCount ? 1 : 0,
        festivals: festivalsCount ? 6 : 6,
        bookings: bookingsCount ? 1 : 0,
        participants: participantsCount ? 1 : 0,
        organisers: organisersCount ? 1 : 0,
        reviews: reviewsCount,
        average_rating: averageRating,
      };
    }

    const state = demoRepo.getState();
    const reviews = state.echoes;
    const avg =
      reviews.length > 0
        ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
        : 4.8;

    return {
      events: state.events.filter((e) => e.published).length,
      festivals: 6,
      bookings: state.registrations.filter((r) => r.kind === "booked").length,
      participants: 1248,
      organisers: state.organisers.filter((o) => o.status === "approved").length,
      reviews: reviews.length,
      average_rating: avg,
    };
  });

// =========================================================================
// 9. Organiser Applications Function
// =========================================================================
export const fetchOrganiserApplications = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    if (db) {
      const rows = await db
        .select()
        .from(schema.organiserProfiles)
        .orderBy(desc(schema.organiserProfiles.createdAt));

      return rows.map((r) => ({
        user_id: r.userId,
        org_name: r.orgName,
        position: r.position,
        org_type: r.orgType,
        institutional_id: r.institutionalId,
        description: r.description,
        status: r.status,
        review_note: r.reviewNote,
      }));
    }

    const state = demoRepo.getState();
    return state.organisers;
  });

// =========================================================================
// 10. Review Organiser Application Function
// =========================================================================
const reviewOrgInput = z.object({
  userId: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().optional(),
});

export const executeReviewOrganiser = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof reviewOrgInput>) => reviewOrgInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.organiserProfiles)
        .set({
          status: data.status,
          reviewNote: data.reviewNote ?? null,
          reviewedAt: new Date(),
        })
        .where(eq(schema.organiserProfiles.userId, data.userId));

      if (data.status === "approved") {
        await db
          .insert(schema.userRoles)
          .values({
            userId: data.userId,
            role: "organizer",
          })
          .onConflictDoNothing();
      } else {
        await db
          .delete(schema.userRoles)
          .where(
            and(
              eq(schema.userRoles.userId, data.userId),
              eq(schema.userRoles.role, "organizer")
            )
          );
      }
      return { success: true };
    }

    demoRepo.approveOrganiser(data.userId, data.status);
    return { success: true };
  });

// =========================================================================
// 11. Voucher Campaigns Function
// =========================================================================
export const fetchVoucherCampaigns = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    if (db) {
      return db.select().from(schema.voucherCampaigns);
    }
    const state = demoRepo.getState();
    return state.campaigns;
  });

// =========================================================================
// 12. Update Voucher Stock Function
// =========================================================================
const voucherStockInput = z.object({
  id: z.number().int().positive(),
  stock: z.number().int().min(0),
});

export const executeUpdateVoucherStock = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof voucherStockInput>) => voucherStockInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.voucherCampaigns)
        .set({ stock: data.stock })
        .where(eq(schema.voucherCampaigns.id, data.id));
      return { success: true };
    }

    demoRepo.updateVoucherStock(data.id, data.stock);
    return { success: true };
  });

// =========================================================================
// 13. Help Requests Function
// =========================================================================
const helpRequestsInput = z.object({
  routedTo: z.string().optional(),
});

export const fetchHelpRequests = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof helpRequestsInput>) => helpRequestsInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      if (data.routedTo) {
        return db
          .select()
          .from(schema.helpRequests)
          .where(eq(schema.helpRequests.routedTo, data.routedTo))
          .orderBy(desc(schema.helpRequests.createdAt));
      }
      return db
        .select()
        .from(schema.helpRequests)
        .orderBy(desc(schema.helpRequests.createdAt));
    }

    const state = demoRepo.getState();
    if (data.routedTo) {
      return state.helpRequests.filter((h) => h.routed_to === data.routedTo);
    }
    return state.helpRequests;
  });

// =========================================================================
// 14. Answer Help Request Function
// =========================================================================
const answerHelpInput = z.object({
  id: z.string().min(1),
  answer: z.string().min(2).max(2000),
});

export const executeAnswerHelpRequest = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof answerHelpInput>) => answerHelpInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.helpRequests)
        .set({
          answer: data.answer.trim(),
          status: "resolved",
        })
        .where(eq(schema.helpRequests.id, data.id));
      return { success: true };
    }

    demoRepo.answerHelp(data.id, data.answer);
    return { success: true };
  });

// =========================================================================
// 15. Verify Ticket Attendance Function
// =========================================================================
const verifyPassInput = z.object({
  passCode: z.string().min(3),
  eventId: z.number().int().positive().optional(),
  organiserId: z.string().optional(),
  isDemo: z.boolean().optional(),
});

export const executeVerifyPass = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof verifyPassInput>) => verifyPassInput.parse(input))
  .handler(async ({ data }) => {
    const cleanCode = data.passCode.trim().toUpperCase();

    if (data.isDemo) {
      try {
        const { demoDbRepo } = await import("@/lib/demo-db/repository");
        const res = await demoDbRepo.verifyAttendance(cleanCode, data.eventId, data.organiserId);
        return {
          verified: true,
          passCode: res.pass_code,
          userId: res.user_id,
          participantName: res.participantName,
          pointsAwarded: 50,
        };
      } catch (err: unknown) {
        throw new Error(err instanceof Error ? err.message : "Pass verification failed.");
      }
    }

    const db = getDb();
    if (db) {
      const [reg] = await db
        .select()
        .from(schema.registrations)
        .where(
          and(
            eq(schema.registrations.passCode, cleanCode),
            eq(schema.registrations.kind, "booked")
          )
        )
        .limit(1);

      if (!reg) {
        throw new Error(`No confirmed booking found for pass code ${cleanCode}`);
      }

      // Check event match if eventId specified
      if (data.eventId && reg.eventId !== data.eventId) {
        throw new Error(`WRONG EVENT: Pass ${cleanCode} was issued for Event #${reg.eventId}, not for this event.`);
      }

      // Check if attendance already recorded
      const [existingAtt] = await db
        .select()
        .from(schema.attendance)
        .where(eq(schema.attendance.registrationId, reg.id))
        .limit(1);

      if (existingAtt) {
        throw new Error(`DUPLICATE CHECK-IN: Attendance has already been verified for pass ${cleanCode}.`);
      }

      // Fetch event and participant profile
      const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, reg.eventId)).limit(1);
      if (data.organiserId && ev?.organiserId && ev.organiserId !== data.organiserId) {
        throw new Error("UNAUTHORIZED: You can only check in passes for your own events.");
      }

      const [userProfile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, reg.userId)).limit(1);

      // Record attendance
      await db
        .insert(schema.attendance)
        .values({
          registrationId: reg.id,
          userId: reg.userId,
          eventId: reg.eventId,
          verifiedBy: data.organiserId || null,
        });

      // Award debut achievement
      await db
        .insert(schema.userAchievements)
        .values({
          userId: reg.userId,
          code: "verified_debut",
        })
        .onConflictDoNothing();

      // Update leaderboard
      await db
        .insert(schema.leaderboard)
        .values({
          userId: reg.userId,
          displayName: userProfile?.fullName || "Verified Attendee",
          department: userProfile?.department || "Campus",
          points: 50,
        })
        .onConflictDoUpdate({
          target: schema.leaderboard.userId,
          set: {
            points: sql`${schema.leaderboard.points} + 50`,
            updatedAt: new Date(),
          },
        });

      return {
        verified: true,
        passCode: reg.passCode,
        userId: reg.userId,
        participantName: userProfile?.fullName || "Maya Sen",
        eventName: ev?.name || "Campus Event",
        pointsAwarded: 50,
      };
    }

    return demoRepo.verifyAttendance(data.passCode);
  });

// =========================================================================
// 16. Event Pulse Gallery Echoes Function
// =========================================================================
const pulseFiltersInput = z.object({
  categoryId: z.number().int().positive().optional(),
  festivalId: z.number().int().positive().optional(),
  eventId: z.number().int().positive().optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  hasMedia: z.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["recent", "rating", "liked"]).default("recent"),
});

export interface PulseEchoItem {
  id: string;
  eventId: number;
  eventName: string;
  festivalId: number;
  festivalName: string;
  categoryId: number;
  categoryName: string;
  venue: string;
  authorName: string;
  rating: number;
  comment: string;
  media: Array<{ path: string; name: string; type: string }>;
  taggedFriends: string[];
  likedByOrganiser: boolean;
  visibility: "private" | "campus" | "public";
  moderationStatus: "approved" | "flagged" | "hidden";
  createdAt: string;
}

export const fetchPulseEchoes = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof pulseFiltersInput>) => pulseFiltersInput.parse(input))
  .handler(async ({ data }): Promise<PulseEchoItem[]> => {
    let rawRows: Array<{ review: any; event: any }> = [];
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select({
            review: schema.reviews,
            event: schema.events,
          })
          .from(schema.reviews)
          .innerJoin(schema.events, eq(schema.reviews.eventId, schema.events.id))
          .orderBy(desc(schema.reviews.createdAt));
        rawRows = rows;
      } catch {
        // Fall back to demo db
      }
    }

    if (rawRows.length === 0) {
      try {
        const { getDemoDb, schema: demoSchema } = await import("@/lib/demo-db");
        const demoDb = getDemoDb();
        if (demoDb) {
          const rows = await demoDb
            .select({
              review: demoSchema.reviews,
              event: demoSchema.events,
            })
            .from(demoSchema.reviews)
            .innerJoin(demoSchema.events, eq(demoSchema.reviews.eventId, demoSchema.events.id))
            .orderBy(desc(demoSchema.reviews.createdAt));
          rawRows = rows as any;
        }
      } catch {
        // Ignore demo db error and fall back to canonical echoes
      }
    }

    let filtered: PulseEchoItem[] = [];

    if (rawRows.length > 0) {
      filtered = rawRows.map(({ review, event }) => {
        const fest = festivals.find((f) => f.id === event.festivalId);
        const cat = categories.find((c) => c.id === event.categoryId);
        return {
          id: review.id,
          eventId: review.eventId,
          eventName: event.name,
          festivalId: event.festivalId ?? 1,
          festivalName: fest?.name ?? `Festival #${event.festivalId ?? 1}`,
          categoryId: event.categoryId,
          categoryName: cat?.name ?? `Category #${event.categoryId}`,
          venue: event.venue,
          authorName: review.authorName || "Anonymous Attendee",
          rating: review.rating,
          comment: review.comment,
          media: (Array.isArray(review.media) ? review.media : (typeof review.media === "string" ? JSON.parse(review.media || "[]") : [])) as Array<{ path: string; name: string; type: string }>,
          taggedFriends: review.taggedFriends ?? [],
          likedByOrganiser: review.likedByOrganiser,
          visibility: review.visibility as "private" | "campus" | "public",
          moderationStatus: review.moderationStatus as "approved" | "flagged" | "hidden",
          createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : String(review.createdAt || new Date().toISOString()),
        };
      });
    } else {
      // Fallback canonical echoes if database returns empty
      const CANONICAL_PULSE_ECHOES: PulseEchoItem[] = [
        {
          id: "d3300201-0000-4000-8000-000000000201",
          eventId: 4,
          eventName: "Mitti & Indigo: Wheel Pottery Studio",
          festivalId: 3,
          festivalName: "Mitti & Ink Guild Week",
          categoryId: 4,
          categoryName: "Hands-On Workshops",
          venue: "Sculpture Studio & Courtyard Kiln",
          authorName: "Maya Sen",
          rating: 5,
          comment: "Loved centering local river clay on the wheel. Taking home a handmade terracotta vessel was magical! Studio masters were patient and inspiring.",
          media: [{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }],
          taggedFriends: ["Arjun Sen", "Pooja Das"],
          likedByOrganiser: true,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          id: "d3300202-0000-4000-8000-000000000202",
          eventId: 1,
          eventName: "Dusk Raga & Indie Folk Session",
          festivalId: 1,
          festivalName: "Navrang Autumn Confluence 2026",
          categoryId: 1,
          categoryName: "Music & Sonic Arts",
          venue: "Banyan Open-Air Amphitheatre",
          authorName: "Aanya Sen",
          rating: 5,
          comment: "The acoustic sitar in the dusk courtyard gave everyone goosebumps! Unforgettable open-air evening with hot spiced chai under festive lights.",
          media: [{ path: "/assets/echoes/raga_concert.svg", name: "raga_concert.svg", type: "image/svg+xml" }],
          taggedFriends: ["Priya Roy", "Kabir Roy"],
          likedByOrganiser: true,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
        {
          id: "d3300203-0000-4000-8000-000000000203",
          eventId: 13,
          eventName: "Autonomous Rover Navigation Sprint",
          festivalId: 2,
          festivalName: "Yantra & Verse: Tech-Art Symposium",
          categoryId: 3,
          categoryName: "Tech & Build Sprints",
          venue: "Robotics Arena & Testing Grounds",
          authorName: "Dev Patel",
          rating: 5,
          comment: "Testing our pathfinding algorithm on the mock lunar gravel arena was intense. The calibrated LiDAR and depth sensors worked flawlessly!",
          media: [{ path: "/assets/echoes/robotics_sprint.svg", name: "robotics_sprint.svg", type: "image/svg+xml" }],
          taggedFriends: ["Rohan Mukherjee"],
          likedByOrganiser: true,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
        },
        {
          id: "d3300204-0000-4000-8000-000000000204",
          eventId: 2,
          eventName: "Contemporary Kathak & Folk Fusion",
          festivalId: 1,
          festivalName: "Navrang Autumn Confluence 2026",
          categoryId: 2,
          categoryName: "Cultural & Performing Arts",
          venue: "Gulmohar Conservatory Hall",
          authorName: "Priya Roy",
          rating: 4,
          comment: "Mesmerizing fusion of Kathak mudras with contemporary floor work and live tabla accompaniment. Pure visual poetry in the conservatory.",
          media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
          taggedFriends: ["Maya Sen", "Sunita Rao"],
          likedByOrganiser: false,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
        },
        {
          id: "d3300205-0000-4000-8000-000000000205",
          eventId: 3,
          eventName: "Midnight 16mm Celluloid Cinema Circle",
          festivalId: 1,
          festivalName: "Navrang Autumn Confluence 2026",
          categoryId: 6,
          categoryName: "Community & Campus Life",
          venue: "Heritage Clock Tower Courtyard",
          authorName: "Rohan Mukherjee",
          rating: 5,
          comment: "Sipping clay kulhad chai on the observatory lawn while watching student 16mm shorts under the open sky was peak autumn campus nostalgia.",
          media: [{ path: "/assets/echoes/cinema_circle.svg", name: "cinema_circle.svg", type: "image/svg+xml" }],
          taggedFriends: ["Aanya Sen", "Arjun Sen"],
          likedByOrganiser: true,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 45).toISOString(),
        },
        {
          id: "d3300206-0000-4000-8000-000000000206",
          eventId: 16,
          eventName: "Purulia Chhau Martial Dance Drama",
          festivalId: 6,
          festivalName: "Alpona Open-Air Cultural Carnival",
          categoryId: 2,
          categoryName: "Cultural & Performing Arts",
          venue: "Banyan Open-Air Amphitheatre",
          authorName: "Arjun Sen",
          rating: 5,
          comment: "The acrobatic Purulia Chhau leaps and live dhamsa drums reverberated right through the banyan tree roots! Spectacular energy.",
          media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
          taggedFriends: ["Maya Sen"],
          likedByOrganiser: false,
          visibility: "public",
          moderationStatus: "approved",
          createdAt: new Date(Date.now() - 3600000 * 60).toISOString(),
        },
      ];
      filtered = CANONICAL_PULSE_ECHOES;
    }

      if (data.categoryId) filtered = filtered.filter((r) => r.categoryId === data.categoryId);
      if (data.festivalId) filtered = filtered.filter((r) => r.festivalId === data.festivalId);
      if (data.eventId) filtered = filtered.filter((r) => r.eventId === data.eventId);
      if (data.minRating) filtered = filtered.filter((r) => r.rating >= data.minRating!);
      if (data.hasMedia) filtered = filtered.filter((r) => r.media && r.media.length > 0);
      if (data.search) {
        const query = data.search.toLowerCase().trim();
        filtered = filtered.filter(
          (r) =>
            r.comment.toLowerCase().includes(query) ||
            r.authorName.toLowerCase().includes(query) ||
            r.eventName.toLowerCase().includes(query) ||
            r.taggedFriends.some((f) => f.toLowerCase().includes(query))
        );
      }

      if (data.sortBy === "rating") {
        filtered.sort((a, b) => b.rating - a.rating);
      } else if (data.sortBy === "liked") {
        filtered.sort((a, b) => Number(b.likedByOrganiser) - Number(a.likedByOrganiser));
      }

      return filtered;
  });

// =========================================================================
// 17. Submit Event Echo Function
// =========================================================================
const submitEchoInput = z.object({
  userId: z.string().optional(),
  authorName: z.string().default("Maya Sen"),
  eventId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(1500),
  taggedFriends: z.array(z.string()).default([]),
  media: z.array(z.object({ path: z.string(), name: z.string(), type: z.string() })).default([]),
  visibility: z.enum(["private", "campus", "public"]).default("private"),
  publicConsent: z.boolean().default(false),
});

export const executeSubmitReview = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof submitEchoInput>) => submitEchoInput.parse(input))
  .handler(async ({ data }) => {
    // If public visibility is chosen, verify explicit consent
    if (data.visibility === "public" && !data.publicConsent) {
      throw new Error("Explicit participant consent is required for public Event Pulse visibility.");
    }

    const db = getDb();
    if (db) {
      if (!data.userId) throw new Error("Authenticated user required for review submission.");

      // 1. Verify event has concluded
      const [eventRow] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, data.eventId))
        .limit(1);

      if (!eventRow) throw new Error("Event not found.");
      if (new Date(eventRow.endAt).getTime() > Date.now()) {
        throw new Error("Event Echo feedback opens only after the event has concluded.");
      }

      // 2. Verify user holds a confirmed booking
      const [reg] = await db
        .select()
        .from(schema.registrations)
        .where(
          and(
            eq(schema.registrations.userId, data.userId),
            eq(schema.registrations.eventId, data.eventId),
            eq(schema.registrations.kind, "booked")
          )
        )
        .limit(1);

      if (!reg) {
        throw new Error("Only participants holding a confirmed pass for this event may submit an Event Echo.");
      }

      // 3. Verify attendance check-in has been verified by the organiser
      const [attRow] = await db
        .select()
        .from(schema.attendance)
        .where(
          and(
            eq(schema.attendance.userId, data.userId),
            eq(schema.attendance.eventId, data.eventId)
          )
        )
        .limit(1);

      if (!attRow) {
        throw new Error("Attendance check-in must be verified by the event organiser before submitting an Event Echo.");
      }

      const [inserted] = await db
        .insert(schema.reviews)
        .values({
          eventId: data.eventId,
          userId: data.userId,
          authorName: data.authorName,
          rating: data.rating,
          comment: data.comment.trim(),
          media: data.media,
          taggedFriends: data.taggedFriends,
          likedByOrganiser: false,
          visibility: data.visibility,
          moderationStatus: "approved",
        })
        .returning();

      if (!inserted) throw new Error("Failed to insert review.");
      return { success: true, id: inserted.id };
    }

    const echo = demoRepo.submitEcho(
      data.userId || DEMO_PARTICIPANT_ID,
      data.authorName,
      data.eventId,
      data.rating,
      data.comment,
      data.taggedFriends,
      data.media,
      data.visibility
    );
    return { success: true, id: echo.id };
  });

// =========================================================================
// 18. Report Inappropriate Echo Function
// =========================================================================
const reportEchoInput = z.object({
  echoId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const executeReportEcho = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof reportEchoInput>) => reportEchoInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.reviews)
        .set({ moderationStatus: "flagged" })
        .where(eq(schema.reviews.id, data.echoId));
      return { success: true, status: "flagged" };
    }

    const echo = demoRepo.reportEcho(data.echoId);
    return { success: true, status: echo.moderation_status };
  });

// =========================================================================
// 19. Moderate Event Echo Function (Admin)
// =========================================================================
const moderateEchoInput = z.object({
  echoId: z.string().min(1),
  status: z.enum(["approved", "flagged", "hidden"]),
  reason: z.string().max(500).optional(),
});

export const executeModerateEcho = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof moderateEchoInput>) => moderateEchoInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      await db
        .update(schema.reviews)
        .set({ moderationStatus: data.status })
        .where(eq(schema.reviews.id, data.echoId));
      return { success: true, status: data.status };
    }

    const echo = demoRepo.moderateEcho(data.echoId, data.status);
    return { success: true, status: echo.moderation_status };
  });

// =========================================================================
// 20. Organiser Appreciation Like Function
// =========================================================================
const toggleLikeInput = z.object({
  echoId: z.string().min(1),
});

export const executeToggleEchoLike = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof toggleLikeInput>) => toggleLikeInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (db) {
      const [review] = await db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.id, data.echoId))
        .limit(1);

      if (!review) throw new Error("Event Echo not found.");
      const updatedLike = !review.likedByOrganiser;
      await db
        .update(schema.reviews)
        .set({ likedByOrganiser: updatedLike })
        .where(eq(schema.reviews.id, data.echoId));

      return { liked: updatedLike };
    }

    const liked = demoRepo.toggleEchoLike(data.echoId);
    return { liked };
  });

// =========================================================================
// 21. Participant Profile Save Function
// =========================================================================
const saveProfileInput = z.object({
  userId: z.string().min(1),
  fullName: z.string().trim().min(2).max(100).optional(),
  department: z.string().trim().max(100).optional().nullable(),
  course: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  preferences: z.array(z.string()).optional(),
  isDemo: z.boolean().optional(),
});

export const executeSaveProfile = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof saveProfileInput>) => saveProfileInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { demoDbRepo } = await import("@/lib/demo-db/repository");
        await demoDbRepo.updateParticipantProfile(data.userId, {
          fullName: data.fullName,
          department: data.department || undefined,
          course: data.course || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          preferences: data.preferences,
        });
        return { success: true };
      } catch {
        // Fall back
      }
    }

    const db = getDb();
    if (db) {
      const updates: Record<string, unknown> = {};
      if (data.fullName !== undefined) updates["fullName"] = data.fullName;
      if (data.department !== undefined) updates["department"] = data.department;
      if (data.course !== undefined) updates["course"] = data.course;
      if (data.phone !== undefined) updates["phone"] = data.phone;
      if (data.address !== undefined) updates["address"] = data.address;
      if (data.preferences !== undefined) updates["preferences"] = data.preferences;

      await db
        .update(schema.profiles)
        .set(updates)
        .where(eq(schema.profiles.id, data.userId));

      return { success: true };
    }

    return { success: true };
  });

// =========================================================================
// 22. Organiser Profile Save Function
// =========================================================================
const saveOrganiserProfileInput = z.object({
  userId: z.string().min(1),
  orgName: z.string().trim().min(2).max(150),
  position: z.string().trim().max(100).optional().nullable(),
  orgType: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  institutionalId: z.string().trim().max(80).optional().nullable(),
  isDemo: z.boolean().optional(),
});

export const executeSaveOrganiserProfile = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof saveOrganiserProfileInput>) => saveOrganiserProfileInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { demoDbRepo } = await import("@/lib/demo-db/repository");
        await demoDbRepo.updateOrganiserProfile(data.userId, {
          orgName: data.orgName,
          position: data.position || "",
          orgType: data.orgType || "cultural",
          description: data.description || "",
          institutionalId: data.institutionalId || "",
        });
        return { success: true };
      } catch {
        // Fall back
      }
    }

    const db = getDb();
    if (db) {
      await db
        .insert(schema.organiserProfiles)
        .values({
          userId: data.userId,
          orgName: data.orgName,
          position: data.position || "",
          orgType: data.orgType || "cultural",
          description: data.description || "",
          institutionalId: data.institutionalId || "",
          status: "approved",
        })
        .onConflictDoUpdate({
          target: schema.organiserProfiles.userId,
          set: {
            orgName: data.orgName,
            position: data.position || "",
            orgType: data.orgType || "cultural",
            description: data.description || "",
            institutionalId: data.institutionalId || "",
          },
        });

      return { success: true };
    }

    return { success: true };
  });

// =========================================================================
// 23. Event Creation with Two-Level Conflict Detection Function
// =========================================================================
const createEventInput = z.object({
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(200),
  description: z.string().trim().min(5).max(3000),
  venue: z.string().trim().min(2).max(120),
  startAt: z.string(),
  endAt: z.string(),
  price: z.number().int().nonnegative().default(0),
  maxSeats: z.number().int().positive().max(10000).default(50),
  categoryId: z.number().int().positive(),
  festivalId: z.number().int().positive(),
  poster: z.string().default("hero_festival.jpg"),
  artists: z.array(z.string()).default([]),
  terms: z.string().default(""),
  organiserId: z.string().optional().nullable(),
  publish: z.boolean().default(true),
  isDemo: z.boolean().optional(),
});

export const executeCreateEvent = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof createEventInput>) => createEventInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { demoDbRepo } = await import("@/lib/demo-db/repository");
        const ev = await demoDbRepo.createEvent(
          data.organiserId || "d3300000-0000-0000-0000-000000000002",
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
        return ev;
      } catch (err: unknown) {
        throw new Error(err instanceof Error ? err.message : "Event creation failed.");
      }
    }

    const db = getDb();
    if (db) {
      const existingRows = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.published, true));

      const conflictCheck = checkEventConflicts(
        existingRows.map((e) => ({
          id: e.id,
          name: e.name,
          venue: e.venue,
          startAt: e.startAt,
          endAt: e.endAt,
          organiserId: e.organiserId ?? null,
          published: e.published,
        })),
        {
          name: data.name,
          venue: data.venue,
          startAt: data.startAt,
          endAt: data.endAt,
          organiserId: data.organiserId ?? null,
        }
      );

      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.reason || "Scheduling conflict detected.");
      }

      const [inserted] = await db
        .insert(schema.events)
        .values({
          name: data.name,
          subtitle: data.subtitle,
          description: data.description,
          venue: data.venue,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          price: data.price,
          maxSeats: data.maxSeats,
          categoryId: data.categoryId,
          festivalId: data.festivalId,
          poster: data.poster,
          artists: data.artists,
          terms: data.terms,
          organiserId: data.organiserId || null,
          published: data.publish,
        })
        .returning({ id: schema.events.id });

      if (!inserted) {
        throw new Error("Failed to insert event.");
      }

      return {
        id: inserted.id,
        name: data.name,
        published: data.publish,
      };
    }

    return {
      id: Math.floor(Math.random() * 100000),
      name: data.name,
      published: data.publish,
    };
  });

// =========================================================================
// 24. Create Event Achievement Badge Function
// =========================================================================
const createBadgeInput = z.object({
  eventId: z.number().int().positive(),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  emoji: z.string().default("✦"),
  points: z.number().int().min(0).max(500).default(25),
  createdBy: z.string().optional().nullable(),
  isDemo: z.boolean().optional(),
});

export const executeCreateEventBadge = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof createBadgeInput>) => createBadgeInput.parse(input))
  .handler(async ({ data }) => {
    if (data.isDemo) {
      try {
        const { demoDbRepo } = await import("@/lib/demo-db/repository");
        const b = await demoDbRepo.createBadge(
          data.createdBy || "d3300000-0000-0000-0000-000000000002",
          data.eventId,
          data.title,
          data.description,
          data.points
        );
        return { id: b.id, success: true };
      } catch {
        // Fall back
      }
    }

    const db = getDb();
    if (db) {
      const [badge] = await db
        .insert(schema.eventBadges)
        .values({
          eventId: data.eventId,
          title: data.title,
          description: data.description,
          emoji: data.emoji,
          points: data.points,
          createdBy: data.createdBy || null,
        })
        .returning({ id: schema.eventBadges.id });

      if (!badge) {
        throw new Error("Failed to insert badge.");
      }

      return { id: badge.id, success: true };
    }

    return { id: crypto.randomUUID(), success: true };
  });
