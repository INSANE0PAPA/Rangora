import crypto from "node:crypto";
import { eq, and, desc, asc, sql as dSql, inArray } from "drizzle-orm";
import { getDemoDb, getDemoSql, schema } from "./index";
import {
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_ADMIN_ID,
  DEMO_APPLICANT_AARAV,
  DEMO_APPLICANT_SNEHA,
  resolveDemoUserId,
  seedDemoDatabase,
} from "./seed";
import {
  categories as defaultCategories,
  festivals as defaultFestivals,
  achievements as defaultAchievements,
  voucherCampaigns as defaultVouchers,
} from "@/data/catalog";
import type {
  DemoState,
  DemoEvent,
  DemoRegistration,
  DemoUserAchievement,
  DemoUserVoucher,
  DemoCampaign,
  DemoEcho,
  DemoOrganiserProfile,
  DemoSponsor,
  DemoHelpRequest,
  DemoLeaderboardRow,
} from "@/lib/demo-repository";

/**
 * Recomputes badges and leaderboard points for a participant based on genuine database rows.
 */
export async function recomputeParticipantRewardsInDb(
  userId: string
): Promise<number> {
  const db = getDemoDb();
  const sql = getDemoSql();

  const userRegs = await sql<
    { event_id: number; category_id: number; verified: boolean }[]
  >`
    SELECT 
      r.event_id,
      e.category_id,
      (a.id IS NOT NULL) AS verified
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    LEFT JOIN public.attendance a ON (a.user_id = r.user_id AND a.event_id = r.event_id)
    WHERE r.user_id = ${userId}::uuid AND r.kind = 'booked'
  `;

  const bookedCount = userRegs.length;
  const verifiedCount = userRegs.filter((r) => r.verified).length;

  const currentAchievements = await sql<{ code: string }[]>`
    SELECT code FROM public.user_achievements WHERE user_id = ${userId}::uuid
  `;
  const earnedCodes = new Set(currentAchievements.map((a) => a.code));

  const badgesToAward: string[] = [];
  const checkAndAward = (code: string) => {
    if (!earnedCodes.has(code)) {
      earnedCodes.add(code);
      badgesToAward.push(code);
    }
  };

  if (bookedCount >= 1) checkAndAward("first_experience");
  if (verifiedCount >= 1) checkAndAward("verified_debut");
  if (verifiedCount >= 3) checkAndAward("festival_finisher");

  for (const reg of userRegs) {
    if (reg.category_id === 4) checkAndAward("guild_artisan");
    if (reg.category_id === 1) checkAndAward("music_connoisseur");
    if (reg.category_id === 2) checkAndAward("cultural_explorer");
    if (reg.category_id === 3) checkAndAward("tech_trailblazer");
    if (reg.category_id === 5) checkAndAward("gaming_champion");
  }

  for (const code of badgesToAward) {
    await sql`
      INSERT INTO public.user_achievements (user_id, code)
      VALUES (${userId}::uuid, ${code})
      ON CONFLICT (user_id, code) DO NOTHING
    `;
  }

  // Calculate points: 10 per booked pass, 25 per verified checkin + sum of achievement definitions
  let points = bookedCount * 10 + verifiedCount * 25;
  for (const code of earnedCodes) {
    const def = defaultAchievements.find((item) => item.code === code);
    if (def) points += def.points;
  }

  // Sync to leaderboard
  const [profile] = await sql<{ full_name: string; department: string }[]>`
    SELECT full_name, department FROM public.profiles WHERE id = ${userId}::uuid
  `;
  const displayName = profile?.full_name || "Maya Sen";
  const department = profile?.department || "Visual Arts · Year 2";

  await sql`
    INSERT INTO public.leaderboard (user_id, display_name, department, points)
    VALUES (${userId}::uuid, ${displayName}, ${department}, ${points})
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      department = EXCLUDED.department,
      points = EXCLUDED.points
  `;

  return points;
}

export const demoDbRepo = {
  /**
   * Fetch the complete aggregated demo workspace state directly from Neon PostgreSQL.
   */
  async getState(): Promise<DemoState> {
    const db = getDemoDb();
    const sql = getDemoSql();

    // 1. Fetch Events
    const eventRows = await db
      .select()
      .from(schema.events)
      .orderBy(asc(schema.events.id));

    const events: DemoEvent[] = eventRows.map((e) => ({
      id: e.id,
      festivalId: e.festivalId ?? 1,
      categoryId: e.categoryId,
      venue: e.venue,
      name: e.name,
      subtitle: e.subtitle,
      description: e.description,
      startAt: new Date(e.startAt).toISOString(),
      endAt: new Date(e.endAt).toISOString(),
      price: e.price,
      maxSeats: e.maxSeats,
      featured: e.featured,
      poster: e.poster,
      artists: (Array.isArray(e.artists) ? e.artists : []) as string[],
      terms: e.terms,
      organiserId: e.organiserId,
      published: e.published,
    }));

    // 2. Fetch Registrations joined with attendance
    const regRows = await sql<
      {
        id: string;
        user_id: string;
        event_id: number;
        kind: "booked" | "planned";
        pass_code: string;
        created_at: string;
        verified: boolean;
      }[]
    >`
      SELECT 
        r.id,
        r.user_id,
        r.event_id,
        r.kind,
        r.pass_code,
        r.created_at,
        (a.id IS NOT NULL) AS verified
      FROM public.registrations r
      LEFT JOIN public.attendance a ON (a.user_id = r.user_id AND a.event_id = r.event_id)
      ORDER BY r.created_at DESC
    `;

    const registrations: DemoRegistration[] = regRows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      event_id: r.event_id,
      kind: r.kind,
      pass_code: r.pass_code,
      verified: r.verified,
      created_at: new Date(r.created_at).toISOString(),
    }));

    // 3. User Achievements
    const achRows = await db
      .select()
      .from(schema.userAchievements)
      .orderBy(desc(schema.userAchievements.earnedAt));

    const userAchievements: DemoUserAchievement[] = achRows.map((a) => ({
      user_id: a.userId,
      code: a.code,
      earned_at: new Date(a.earnedAt).toISOString(),
    }));

    // 4. User Vouchers
    const voucherRows = await db
      .select()
      .from(schema.userVouchers)
      .orderBy(desc(schema.userVouchers.issuedAt));

    const userVouchers: DemoUserVoucher[] = voucherRows.map((v) => ({
      id: v.id,
      user_id: v.userId,
      campaign_id: v.campaignId,
      code: v.code,
      issued_at: new Date(v.issuedAt).toISOString(),
    }));

    // 5. Campaigns
    const campRows = await db
      .select()
      .from(schema.voucherCampaigns)
      .orderBy(asc(schema.voucherCampaigns.id));

    const campaigns: DemoCampaign[] = campRows.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      pct: c.pct,
      description: c.description,
      stock: c.stock,
    }));

    // 6. Echoes (Reviews)
    const reviewRows = await db
      .select()
      .from(schema.reviews)
      .orderBy(desc(schema.reviews.createdAt));

    const echoes: DemoEcho[] = reviewRows.map((r) => ({
      id: r.id,
      event_id: r.eventId,
      user_id: r.userId,
      author_name: r.authorName,
      rating: r.rating,
      comment: r.comment,
      media: (Array.isArray(r.media) ? r.media : []) as Array<{
        path: string;
        name: string;
        type: string;
      }>,
      tagged_friends: r.taggedFriends ?? [],
      liked_by_organiser: r.likedByOrganiser,
      visibility: (r.visibility as "private" | "campus" | "public") || "private",
      moderation_status:
        (r.moderationStatus as "approved" | "flagged" | "hidden") || "approved",
      created_at: new Date(r.createdAt).toISOString(),
    }));

    // 7. Organisers
    const orgRows = await db
      .select()
      .from(schema.organiserProfiles)
      .orderBy(desc(schema.organiserProfiles.createdAt));

    const organisers: DemoOrganiserProfile[] = orgRows.map((o) => ({
      user_id: o.userId,
      org_name: o.orgName,
      position: o.position,
      org_type: o.orgType,
      institutional_id: o.institutionalId,
      description: o.description,
      status: o.status as "pending" | "approved" | "rejected",
      review_note: o.reviewNote,
      reviewed_at: o.reviewedAt ? new Date(o.reviewedAt).toISOString() : null,
      created_at: new Date(o.createdAt).toISOString(),
    }));

    // 8. Sponsors
    const sponsorRows = await db
      .select()
      .from(schema.sponsors)
      .orderBy(desc(schema.sponsors.createdAt));

    const sponsors: DemoSponsor[] = sponsorRows.map((s) => ({
      id: s.id,
      user_id: s.userId,
      name: s.name,
      tier: s.tier,
      amount: Number(s.amount) || 0,
      contact: s.contact,
      message: s.message,
      status: s.status as "requested" | "approved" | "rejected" | "active",
      created_at: new Date(s.createdAt).toISOString(),
    }));

    // 9. Help Requests
    const helpRows = await db
      .select()
      .from(schema.helpRequests)
      .orderBy(desc(schema.helpRequests.createdAt));

    const helpRequests: DemoHelpRequest[] = helpRows.map((h) => ({
      id: h.id,
      user_id: h.userId,
      author_name: h.authorName,
      event_id: h.eventId,
      category: h.category,
      subject: h.subject,
      message: h.message,
      status: h.status as "open" | "routed" | "resolved",
      answer: h.answer,
      routed_to: h.routedTo,
      created_at: new Date(h.createdAt).toISOString(),
    }));

    // 10. Leaderboard
    const leaderRows = await db
      .select()
      .from(schema.leaderboard)
      .orderBy(desc(schema.leaderboard.points));

    const leaderboard: DemoLeaderboardRow[] = leaderRows.map((l) => ({
      user_id: l.userId,
      display_name: l.displayName,
      department: l.department || "Campus",
      points: l.points,
    }));

    // 11. Profiles
    const [participantProfileRow] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, DEMO_PARTICIPANT_ID))
      .limit(1);

    const [organiserProfileRow] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, DEMO_ORGANISER_ID))
      .limit(1);

    return {
      events,
      registrations,
      userAchievements,
      userVouchers,
      campaigns,
      echoes,
      organisers,
      sponsors,
      helpRequests,
      leaderboard,
      participantProfile: participantProfileRow
        ? {
            id: participantProfileRow.id,
            full_name: participantProfileRow.fullName,
            email: participantProfileRow.email || "",
            phone: participantProfileRow.phone || "",
            address: participantProfileRow.address || "",
            department: participantProfileRow.department || "",
            course: participantProfileRow.course || "",
            preferences: participantProfileRow.preferences || [],
          }
        : {
            id: DEMO_PARTICIPANT_ID,
            full_name: "Maya Sen",
            email: "maya.sen@campus.rangora.in",
            phone: "+91 98301 23456",
            address: "Salt Lake Campus Hostel 3, Room 204",
            department: "Visual Arts · Year 2",
            course: "B.Des Interaction Design",
            preferences: ["workshops", "cultural", "music"],
          },
      organiserProfile: organiserProfileRow
        ? {
            id: organiserProfileRow.id,
            full_name: organiserProfileRow.fullName,
            email: organiserProfileRow.email || "",
            phone: organiserProfileRow.phone || "",
            address: organiserProfileRow.address || "",
            department: organiserProfileRow.department || "",
            course: organiserProfileRow.course || "",
            preferences: organiserProfileRow.preferences || [],
          }
        : {
            id: DEMO_ORGANISER_ID,
            full_name: "Ritwik Das",
            email: "ritwik.arts@campus.rangora.in",
            phone: "+91 98312 87654",
            address: "Faculty of Fine Arts, Studio 4B",
            department: "Fine Arts & Design",
            course: "M.F.A. Printmaking",
            preferences: ["workshops", "cultural"],
          },
    };
  },

  /**
   * Count confirmed bookings per event for Seat Pulse calculations.
   */
  async getBookedCounts(): Promise<Record<number, number>> {
    const db = getDemoDb();
    const rows = await db
      .select({ eventId: schema.registrations.eventId })
      .from(schema.registrations)
      .where(eq(schema.registrations.kind, "booked"));

    const counts: Record<number, number> = {};
    for (const r of rows) {
      counts[r.eventId] = (counts[r.eventId] ?? 0) + 1;
    }
    return counts;
  },

  /**
   * ACID-protected pass reservation using a Neon database transaction.
   */
  async bookPass(
    userId: string,
    eventId: number,
    kind: "booked" | "planned"
  ): Promise<DemoRegistration> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    return await sql.begin(async (tx) => {
      // 1. Fetch event specs
      const [event] = await tx<{ id: number; max_seats: number; published: boolean }[]>`
        SELECT id, max_seats, published 
        FROM public.events 
        WHERE id = ${eventId}
        FOR UPDATE
      `;
      if (!event) throw new Error("Event not found in demo catalogue.");

      // 2. Check existing pass
      const [existing] = await tx<
        { id: string; user_id: string; event_id: number; kind: "booked" | "planned"; pass_code: string; created_at: string }[]
      >`
        SELECT id, user_id, event_id, kind, pass_code, created_at
        FROM public.registrations
        WHERE user_id = ${resolvedUserId}::uuid AND event_id = ${eventId}
      `;

      if (existing) {
        if (existing.kind === kind) {
          throw new Error("You already hold this pass.");
        }
        // Update kind (e.g. from planned to booked)
        await tx`
          UPDATE public.registrations
          SET kind = ${kind}
          WHERE id = ${existing.id}::uuid
        `;
        await recomputeParticipantRewardsInDb(resolvedUserId);
        return {
          id: existing.id,
          user_id: resolvedUserId,
          event_id: eventId,
          kind,
          pass_code: existing.pass_code,
          verified: false,
          created_at: new Date(existing.created_at).toISOString(),
        };
      }

      // 3. Check seat capacity atomically if booking
      if (kind === "booked") {
        const countRows = await tx<{ count: string }[]>`
          SELECT count(*)::text AS count
          FROM public.registrations
          WHERE event_id = ${eventId} AND kind = 'booked'
        `;
        const currentCount = parseInt(countRows[0]?.count ?? "0", 10);
        if (currentCount >= event.max_seats) {
          throw new Error("This event has reached full capacity. No seats remaining.");
        }
      }

      // 4. Generate unique pass code
      const regId = crypto.randomUUID();
      const passCode = `RNG-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;

      await tx`
        INSERT INTO public.registrations (id, user_id, event_id, kind, pass_code)
        VALUES (${regId}::uuid, ${resolvedUserId}::uuid, ${eventId}, ${kind}, ${passCode})
      `;

      await recomputeParticipantRewardsInDb(resolvedUserId);

      return {
        id: regId,
        user_id: resolvedUserId,
        event_id: eventId,
        kind,
        pass_code: passCode,
        verified: false,
        created_at: new Date().toISOString(),
      };
    });
  },

  /**
   * Cancel an existing booking and restore seat capacity.
   */
  async cancelPass(userId: string, registrationId: string): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    await sql.begin(async (tx) => {
      const [reg] = await tx<{ id: string; user_id: string }[]>`
        SELECT id, user_id 
        FROM public.registrations 
        WHERE id = ${registrationId}::uuid AND user_id = ${resolvedUserId}::uuid
      `;
      if (!reg) {
        throw new Error("Registration not found or not owned by you.");
      }

      await tx`
        DELETE FROM public.registrations 
        WHERE id = ${registrationId}::uuid
      `;

      await recomputeParticipantRewardsInDb(resolvedUserId);
    });
  },

  /**
   * Organiser verifies a participant pass on-site, recording verified attendance.
   */
  async verifyAttendance(
    passCode: string,
    expectedEventId?: number,
    expectedOrganiserId?: string
  ): Promise<DemoRegistration & { participantName: string; verified: boolean }> {
    const sql = getDemoSql();
    const cleanCode = passCode.trim().toUpperCase();

    return await sql.begin(async (tx) => {
      const [reg] = await tx<
        { id: string; user_id: string; event_id: number; kind: "booked" | "planned"; pass_code: string; created_at: string }[]
      >`
        SELECT id, user_id, event_id, kind, pass_code, created_at
        FROM public.registrations
        WHERE UPPER(pass_code) = ${cleanCode} AND kind = 'booked'
        FOR UPDATE
      `;

      if (!reg) {
        throw new Error(`No confirmed booking found matching pass code ${cleanCode}`);
      }

      // Check event match if expectedEventId specified
      if (expectedEventId && reg.event_id !== expectedEventId) {
        throw new Error(`WRONG EVENT: Pass ${cleanCode} was issued for Event #${reg.event_id}, not for this event.`);
      }

      // Check duplicate check-in
      const [existingAtt] = await tx<{ id: string }[]>`
        SELECT id FROM public.attendance WHERE registration_id = ${reg.id}::uuid LIMIT 1
      `;
      if (existingAtt) {
        throw new Error(`DUPLICATE CHECK-IN: Attendance has already been verified for pass ${cleanCode}.`);
      }

      // Check event organiser ownership if expectedOrganiserId specified
      if (expectedOrganiserId) {
        const resolvedOrg = resolveDemoUserId(expectedOrganiserId);
        const [ev] = await tx<{ organiser_id: string | null }[]>`
          SELECT organiser_id FROM public.events WHERE id = ${reg.event_id}
        `;
        if (ev && ev.organiser_id && ev.organiser_id !== resolvedOrg) {
          throw new Error("UNAUTHORIZED: You can only check in passes for your own events.");
        }
      }

      // Record attendance check-in
      const attId = crypto.randomUUID();
      await tx`
        INSERT INTO public.attendance (id, registration_id, user_id, event_id, verified_by)
        VALUES (${attId}::uuid, ${reg.id}::uuid, ${reg.user_id}::uuid, ${reg.event_id}, ${DEMO_ORGANISER_ID}::uuid)
        ON CONFLICT (user_id, event_id) DO UPDATE SET
          verified_at = now(),
          verified_by = EXCLUDED.verified_by
      `;

      await recomputeParticipantRewardsInDb(reg.user_id);

      const [profile] = await tx<{ full_name: string }[]>`
        SELECT full_name FROM public.profiles WHERE id = ${reg.user_id}::uuid
      `;
      const participantName = profile?.full_name || "Maya Sen";

      return {
        id: reg.id,
        user_id: reg.user_id,
        event_id: reg.event_id,
        kind: reg.kind,
        pass_code: reg.pass_code,
        verified: true,
        created_at: new Date(reg.created_at).toISOString(),
        participantName,
      };
    });
  },

  /**
   * Save participant discipline preferences.
   */
  async saveInterests(userId: string, preferences: string[]): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();
    await sql`
      UPDATE public.profiles
      SET preferences = ${preferences}
      WHERE id = ${resolvedUserId}::uuid
    `;
  },

  /**
   * Full update for participant profile.
   */
  async updateParticipantProfile(
    userId: string,
    data: {
      fullName?: string | undefined;
      phone?: string | undefined;
      address?: string | undefined;
      department?: string | undefined;
      course?: string | undefined;
      preferences?: string[] | undefined;
    }
  ): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    await sql`
      UPDATE public.profiles
      SET
        full_name = COALESCE(${data.fullName ?? null}, full_name),
        phone = COALESCE(${data.phone ?? null}, phone),
        address = COALESCE(${data.address ?? null}, address),
        department = COALESCE(${data.department ?? null}, department),
        course = COALESCE(${data.course ?? null}, course),
        preferences = COALESCE(${data.preferences ?? null}, preferences)
      WHERE id = ${resolvedUserId}::uuid
    `;
  },

  /**
   * Update organiser profile and club details.
   */
  async updateOrganiserProfile(
    userId: string,
    data: {
      orgName?: string | undefined;
      position?: string | undefined;
      orgType?: string | undefined;
      description?: string | undefined;
      institutionalId?: string | undefined;
    }
  ): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    await sql`
      UPDATE public.organiser_profiles
      SET
        org_name = COALESCE(${data.orgName ?? null}, org_name),
        position = COALESCE(${data.position ?? null}, position),
        org_type = COALESCE(${data.orgType ?? null}, org_type),
        description = COALESCE(${data.description ?? null}, description),
        institutional_id = COALESCE(${data.institutionalId ?? null}, institutional_id)
      WHERE user_id = ${resolvedUserId}::uuid
    `;
  },

  /**
   * Organiser creates an event, verifying venue and time slot conflicts.
   */
  async createEvent(
    organiserId: string,
    data: Partial<DemoEvent>,
    published = false
  ): Promise<DemoEvent> {
    const resolvedOrgId = resolveDemoUserId(organiserId);
    const sql = getDemoSql();
    const venue = data.venue?.trim() || "Courtyard Stage";
    const startAt = data.startAt || new Date().toISOString();
    const endAt =
      data.endAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    // Level 1: Same organiser schedule clash
    const [organiserClash] = await sql<{ name: string; venue: string }[]>`
      SELECT name, venue FROM public.events
      WHERE organiser_id = ${resolvedOrgId}::uuid
        AND start_at < ${endAt}::timestamptz
        AND end_at > ${startAt}::timestamptz
      LIMIT 1
    `;

    if (organiserClash) {
      throw new Error(
        `Schedule clash (ORGANISER CONFLICT): You are already managing "${organiserClash.name}" at ${organiserClash.venue} during this time window.`
      );
    }

    // Level 2: Venue schedule clash
    const [venueClash] = await sql<{ name: string }[]>`
      SELECT name FROM public.events
      WHERE LOWER(venue) = LOWER(${venue})
        AND start_at < ${endAt}::timestamptz
        AND end_at > ${startAt}::timestamptz
      LIMIT 1
    `;

    if (venueClash) {
      throw new Error(
        `Schedule clash (VENUE CONFLICT): ${venue} is already reserved for "${venueClash.name}" during this time window.`
      );
    }

    const [newEvent] = await sql<
      {
        id: number;
        category_id: number;
        festival_id: number | null;
        organiser_id: string | null;
        name: string;
        subtitle: string;
        description: string;
        venue: string;
        start_at: string;
        end_at: string;
        price: number;
        max_seats: number;
        featured: boolean;
        published: boolean;
        poster: string;
        artists: string[];
        terms: string;
      }[]
    >`
      INSERT INTO public.events (
        category_id, festival_id, organiser_id, name, subtitle, description,
        venue, start_at, end_at, price, max_seats, featured, published, poster, artists, terms
      ) VALUES (
        ${Number(data.categoryId) || 1},
        ${Number(data.festivalId) || 1},
        ${resolvedOrgId}::uuid,
        ${data.name?.trim() || "Untitled Campus Event"},
        ${data.subtitle?.trim() || ""},
        ${data.description?.trim() || ""},
        ${venue},
        ${startAt}::timestamptz,
        ${endAt}::timestamptz,
        ${Number(data.price) || 0},
        ${Number(data.maxSeats) || 30},
        false,
        ${published},
        ${data.poster || "hero_festival.jpg"},
        ${JSON.stringify(data.artists ?? [])}::jsonb,
        ${data.terms || "Standard festival entry terms apply."}
      )
      RETURNING *
    `;

    return {
      id: newEvent!.id,
      festivalId: newEvent!.festival_id ?? 1,
      categoryId: newEvent!.category_id,
      venue: newEvent!.venue,
      name: newEvent!.name,
      subtitle: newEvent!.subtitle,
      description: newEvent!.description,
      startAt: new Date(newEvent!.start_at).toISOString(),
      endAt: new Date(newEvent!.end_at).toISOString(),
      price: newEvent!.price,
      maxSeats: newEvent!.max_seats,
      featured: newEvent!.featured,
      poster: newEvent!.poster,
      artists: (Array.isArray(newEvent!.artists) ? newEvent!.artists : []) as string[],
      terms: newEvent!.terms,
      organiserId: newEvent!.organiser_id,
      published: newEvent!.published,
    };
  },

  /**
   * Update event publication status.
   */
  async updateEventPublish(id: number, published: boolean): Promise<void> {
    const sql = getDemoSql();
    const result = await sql`
      UPDATE public.events
      SET published = ${published}
      WHERE id = ${id}
      RETURNING id
    `;
    if (result.length === 0) throw new Error("Event not found.");
  },

  /**
   * Organiser creates an achievement badge for their event.
   */
  async createBadge(
    userId: string,
    eventId: number,
    title: string,
    description: string,
    points: number = 20
  ): Promise<{ id: string; title: string }> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();
    const badgeId = crypto.randomUUID();

    await sql`
      INSERT INTO public.event_badges (id, event_id, title, description, emoji, points, created_by)
      VALUES (${badgeId}::uuid, ${eventId}, ${title.trim()}, ${description.trim()}, 'Badge', ${points}, ${resolvedUserId}::uuid)
    `;

    return { id: badgeId, title: title.trim() };
  },

  /**
   * Submit an Event Echo with verified attendance check.
   */
  async submitEcho(
    userId: string,
    authorName: string,
    eventId: number,
    rating: number,
    comment: string,
    taggedFriends: string[] = [],
    media: Array<{ path: string; name: string; type: string }> = [],
    visibility: "private" | "campus" | "public" = "private",
    publicConsent: boolean = false
  ): Promise<DemoEcho> {
    if (visibility === "public" && !publicConsent) {
      throw new Error(
        "Explicit participant consent is required for public Event Pulse visibility."
      );
    }

    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    // 1. Verify event concluded
    const [event] = await sql<{ id: number; end_at: string }[]>`
      SELECT id, end_at FROM public.events WHERE id = ${eventId}
    `;
    if (!event) throw new Error("Event not found.");
    const eventEnded =
      new Date(event.end_at).getTime() < Date.now() || eventId === 1 || eventId === 4;
    if (!eventEnded) {
      throw new Error("Event Echo feedback opens only after the event has concluded.");
    }

    // 2. Verify confirmed booking
    const [reg] = await sql<{ id: string }[]>`
      SELECT id FROM public.registrations
      WHERE user_id = ${resolvedUserId}::uuid AND event_id = ${eventId} AND kind = 'booked'
    `;
    if (!reg) {
      throw new Error(
        "Only participants holding a confirmed pass for this event may submit an Event Echo."
      );
    }

    // 3. Verify on-site attendance check-in
    const [att] = await sql<{ id: string }[]>`
      SELECT id FROM public.attendance
      WHERE user_id = ${resolvedUserId}::uuid AND event_id = ${eventId}
    `;
    if (!att) {
      throw new Error(
        "Attendance check-in must be verified by the event organiser before submitting an Event Echo."
      );
    }

    const echoId = crypto.randomUUID();
    const cleanRating = Math.min(5, Math.max(1, rating));

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO public.reviews (
        id, event_id, user_id, author_name, rating, comment, media,
        tagged_friends, liked_by_organiser, visibility, moderation_status
      ) VALUES (
        ${echoId}::uuid, ${eventId}, ${resolvedUserId}::uuid, ${authorName}, ${cleanRating},
        ${comment.trim()}, ${JSON.stringify(media)}::jsonb, ${taggedFriends}, false,
        ${visibility}, 'approved'
      )
      ON CONFLICT (event_id, user_id) DO UPDATE SET
        author_name = EXCLUDED.author_name,
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        media = EXCLUDED.media,
        tagged_friends = EXCLUDED.tagged_friends,
        liked_by_organiser = false,
        visibility = EXCLUDED.visibility,
        moderation_status = EXCLUDED.moderation_status
      RETURNING id
    `;

    const actualId = row?.id || echoId;

    return {
      id: actualId,
      event_id: eventId,
      user_id: resolvedUserId,
      author_name: authorName,
      rating: cleanRating,
      comment: comment.trim(),
      media,
      tagged_friends: taggedFriends,
      liked_by_organiser: false,
      visibility,
      moderation_status: "approved",
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Report an inappropriate Event Echo.
   */
  async reportEcho(echoId: string): Promise<void> {
    const sql = getDemoSql();
    const res = await sql`
      UPDATE public.reviews
      SET moderation_status = 'flagged'
      WHERE id = ${echoId}::uuid
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Event Echo not found.");
  },

  /**
   * Moderate an Event Echo (Admin operation).
   */
  async moderateEcho(
    echoId: string,
    status: "approved" | "flagged" | "hidden"
  ): Promise<void> {
    const sql = getDemoSql();
    const res = await sql`
      UPDATE public.reviews
      SET moderation_status = ${status}
      WHERE id = ${echoId}::uuid
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Event Echo not found.");
  },

  /**
   * Organiser like/pick an Event Echo.
   */
  async toggleEchoLike(echoId: string): Promise<boolean> {
    const sql = getDemoSql();
    const [review] = await sql<{ liked_by_organiser: boolean }[]>`
      UPDATE public.reviews
      SET liked_by_organiser = NOT liked_by_organiser
      WHERE id = ${echoId}::uuid
      RETURNING liked_by_organiser
    `;
    if (!review) throw new Error("Event Echo not found.");
    return review.liked_by_organiser;
  },

  /**
   * Admin reviews and approves an organiser application.
   */
  async approveOrganiser(
    userId: string,
    status: "approved" | "rejected"
  ): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    await sql.begin(async (tx) => {
      const res = await tx`
        UPDATE public.organiser_profiles
        SET status = ${status}, reviewed_at = now()
        WHERE user_id = ${resolvedUserId}::uuid
        RETURNING user_id
      `;
      if (res.length === 0) {
        throw new Error("Organiser application not found.");
      }

      if (status === "approved") {
        await tx`
          INSERT INTO public.user_roles (user_id, role)
          VALUES (${resolvedUserId}::uuid, 'organizer'::public.app_role)
          ON CONFLICT (user_id, role) DO NOTHING
        `;
      }
    });
  },

  /**
   * Update voucher campaign stock.
   */
  async updateVoucherStock(campaignId: number, stock: number): Promise<void> {
    const sql = getDemoSql();
    const res = await sql`
      UPDATE public.voucher_campaigns
      SET stock = ${stock}
      WHERE id = ${campaignId}
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Voucher campaign not found.");
  },

  /**
   * Issue a voucher from campaign stock to participant.
   */
  async issueVoucher(
    userId: string,
    campaignId: number
  ): Promise<DemoUserVoucher> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();

    return await sql.begin(async (tx) => {
      // 1. Fetch campaign and verify stock
      const [camp] = await tx<{ id: number; pct: number; stock: number }[]>`
        SELECT id, pct, stock 
        FROM public.voucher_campaigns 
        WHERE id = ${campaignId}
        FOR UPDATE
      `;
      if (!camp) throw new Error("Voucher campaign not found.");
      if (camp.stock <= 0) {
        throw new Error("This voucher campaign has zero remaining stock.");
      }

      // 2. Check duplicate claim
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM public.user_vouchers
        WHERE user_id = ${resolvedUserId}::uuid AND campaign_id = ${campaignId}
      `;
      if (existing) {
        throw new Error("You have already claimed a voucher from this campaign.");
      }

      // 3. Decrement stock
      await tx`
        UPDATE public.voucher_campaigns
        SET stock = stock - 1
        WHERE id = ${campaignId}
      `;

      // 4. Issue voucher
      const voucherId = crypto.randomUUID();
      const code = `RNG-${camp.pct}PCT-${Math.floor(1000 + Math.random() * 9000)}`;

      await tx`
        INSERT INTO public.user_vouchers (id, user_id, campaign_id, code)
        VALUES (${voucherId}::uuid, ${resolvedUserId}::uuid, ${campaignId}, ${code})
      `;

      return {
        id: voucherId,
        user_id: resolvedUserId,
        campaign_id: campaignId,
        code,
        issued_at: new Date().toISOString(),
      };
    });
  },

  /**
   * Redeem a voucher from the participant's wallet.
   */
  async redeemVoucher(userId: string, voucherId: string): Promise<void> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();
    const res = await sql`
      DELETE FROM public.user_vouchers
      WHERE id = ${voucherId}::uuid AND user_id = ${resolvedUserId}::uuid
      RETURNING id
    `;
    if (res.length === 0) {
      throw new Error("Voucher not found in your wallet.");
    }
  },

  /**
   * Answer a help request.
   */
  async answerHelp(id: string, answer: string): Promise<void> {
    const sql = getDemoSql();
    const res = await sql`
      UPDATE public.help_requests
      SET answer = ${answer.trim()}, status = 'resolved'
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Help request not found.");
  },

  /**
   * Create a new help request.
   */
  async createHelpRequest(
    userId: string,
    authorName: string,
    category: string,
    subject: string,
    message: string,
    eventId: number | null
  ): Promise<DemoHelpRequest> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();
    const reqId = crypto.randomUUID();
    const routedTo = eventId === 4 ? DEMO_ORGANISER_ID : null;

    await sql`
      INSERT INTO public.help_requests (id, user_id, author_name, event_id, category, subject, message, status, routed_to)
      VALUES (
        ${reqId}::uuid, ${resolvedUserId}::uuid, ${authorName}, ${eventId}, ${category},
        ${subject.trim()}, ${message.trim()}, 'open', ${routedTo ? sql`${routedTo}::uuid` : null}
      )
    `;

    return {
      id: reqId,
      user_id: resolvedUserId,
      author_name: authorName,
      category,
      event_id: eventId,
      subject: subject.trim(),
      message: message.trim(),
      status: "open",
      answer: null,
      routed_to: routedTo,
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Create a sponsorship request.
   */
  async requestSponsor(
    userId: string,
    name: string,
    tier: string,
    amount: number,
    contact?: string,
    message?: string
  ): Promise<DemoSponsor> {
    const resolvedUserId = resolveDemoUserId(userId);
    const sql = getDemoSql();
    const spId = crypto.randomUUID();

    await sql`
      INSERT INTO public.sponsors (id, user_id, name, tier, amount, contact, message, requested_by, status)
      VALUES (
        ${spId}::uuid, ${resolvedUserId}::uuid, ${name.trim()}, ${tier}, ${amount},
        ${contact?.trim() || null}, ${message?.trim() || null}, ${resolvedUserId}::uuid, 'requested'
      )
    `;

    return {
      id: spId,
      user_id: resolvedUserId,
      name: name.trim(),
      tier,
      amount,
      contact: contact?.trim() || null,
      message: message?.trim() || null,
      status: "requested",
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Update sponsorship status.
   */
  async updateSponsorStatus(
    id: string,
    status: "active" | "rejected"
  ): Promise<void> {
    const sql = getDemoSql();
    const res = await sql`
      UPDATE public.sponsors
      SET status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Sponsor not found.");
  },

  /**
   * Resets the demo database to the reference seed state.
   */
  async reset(): Promise<DemoState> {
    await seedDemoDatabase();
    return this.getState();
  },
};
