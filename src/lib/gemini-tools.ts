import { z } from "zod";
import { Type } from "@google/genai";
import { getDb, schema } from "@/lib/db";
import { demoRepo, DEMO_PARTICIPANT_ID } from "@/lib/demo-repository";
import { events as defaultCatalogEvents, categories as defaultCategories, festivals as defaultFestivals } from "@/data/catalog";
import { eq, and } from "drizzle-orm";

// =========================================================================
// 1. Zod Schemas for Tool Arguments
// =========================================================================

export const searchEventsSchema = z.object({
  query: z.string().optional().describe("Text search keyword in title, subtitle, or description"),
  categoryId: z.number().int().optional().describe("Category ID filter (1-8)"),
  festivalId: z.number().int().optional().describe("Festival ID filter (1-6)"),
  maxPrice: z.number().int().min(0).optional().describe("Maximum ticket price in INR (0 for free events)"),
  onlyAvailable: z.boolean().optional().describe("True to only show events with remaining seats"),
});

export const getEventDetailsSchema = z.object({
  eventId: z.number().int().describe("The numeric event ID"),
});

export const getLiveSeatAvailabilitySchema = z.object({
  eventId: z.number().int().describe("The numeric event ID"),
});

export const getMyRegistrationStatusSchema = z.object({
  eventId: z.number().int().describe("The numeric event ID to check registration for"),
});

export const searchRangoraFaqSchema = z.object({
  query: z.string().min(2).describe("Search term or policy question"),
});

export const proposeActionSchema = z.object({
  action: z.enum(["book_pass", "cancel_pass", "redeem_voucher"]).describe("The consequential action to propose"),
  eventId: z.number().int().optional().describe("The event ID involved, if applicable"),
  voucherId: z.string().optional().describe("The voucher campaign ID or code, if applicable"),
  summary: z.string().describe("Human-readable explanation of what this action will do"),
  buttonLabel: z.string().describe("Short, clear label for the action button (e.g. 'Book Pass for ₹150')"),
});

export type ProposedAction = z.infer<typeof proposeActionSchema>;

// =========================================================================
// 2. Curated FAQ Knowledge Base
// =========================================================================

export const RANGORA_FAQ = [
  {
    category: "passes" as const,
    question: "How do event pass bookings work?",
    answer: "Participants can book passes for free and paid campus events directly on each event page. Bookings issue a unique pass code and reserve a seat. Because bookings alter official ticket counts, the AI assistant will propose a booking action that you confirm with a single click."
  },
  {
    category: "passes" as const,
    question: "What is the cancellation policy for event passes?",
    answer: "Free passes can be cancelled at any time before the event begins to release your seat to fellow students. Paid passes can be cancelled up to 24 hours prior to the festival start time."
  },
  {
    category: "echoes" as const,
    question: "How do Event Echoes work and what are the submission requirements?",
    answer: "Event Echoes are student memory capsules. Submission requires three conditions: (1) a confirmed booking, (2) the event must have finished, and (3) your attendance must be verified on-site by an organiser. Submissions are strictly private by default; public display on the Event Pulse gallery requires your explicit consent."
  },
  {
    category: "vouchers" as const,
    question: "How do voucher campaigns and campus perks work?",
    answer: "Rangora offers partner perks including 15% off at campus cafés, Maker Materials workshop vouchers, 10% festival friend pair discounts, and 20% late-night chai tokens. Claim vouchers through your Participant Space or ask Rangora AI to view your active vouchers."
  },
  {
    category: "badges" as const,
    question: "How do achievement badges, stamps, and the leaderboard work?",
    answer: "Participants earn points and badges for exploring campus culture. E.g. 'First Experience' (50 pts), 'Festival Finisher' (120 pts for 3 events), 'All-Round Explorer' (100 pts across 3 categories), and 'Verified Debut' (50 pts on first organiser-verified check-in). Points populate the campus-wide leaderboard."
  },
  {
    category: "venues" as const,
    question: "Where are the primary festival courtyards and stages located?",
    answer: "Key festival hubs include: Banyan Open-Air Amphitheatre (central courtyard for headliners and folk theatre), Gulmohar Conservatory Hall (indoor acoustic, dance and classical stage), Observatory Terrace & Lawn (rooftop cinema and midnight astronomy), Terracotta Craft & Print Studio (hands-on workshops), and The Brick Lounge & Arcade Commons (indie gaming and tabletop)."
  },
  {
    category: "general" as const,
    question: "How can student clubs and societies organise an event?",
    answer: "Registered student societies and student groups can apply for Organiser status through the /demo portal or dashboard. Applications require an institutional ID and statement of intent, and are approved by the campus administration."
  }
];

// =========================================================================
// 3. Official @google/genai Tool Declarations
// =========================================================================

export const geminiToolDeclarations = [
  {
    name: "search_events",
    description: "Search for campus festival events by keyword, category, festival, maximum price, or seat availability.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Text keyword matching title, subtitle, or description" },
        categoryId: { type: Type.INTEGER, description: "Category ID (1: Music, 2: Cultural, 3: Tech, 4: Workshops, 5: Gaming, 6: Community, 7: Sports, 8: Entrepreneurship)" },
        festivalId: { type: Type.INTEGER, description: "Festival ID (1-6)" },
        maxPrice: { type: Type.INTEGER, description: "Maximum ticket price in INR (0 for free events)" },
        onlyAvailable: { type: Type.BOOLEAN, description: "True to only return events with remaining open seats" },
      },
    },
  },
  {
    name: "get_event_details",
    description: "Retrieve comprehensive details for a specific event including full description, artists, venue, timings, pricing, and badges.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.INTEGER, description: "The numeric event ID (e.g. 1, 2, 4, 16)" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "get_live_seat_availability",
    description: "Check live Seat Pulse status, total seats, booked seats, and remaining capacity for an event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.INTEGER, description: "The numeric event ID" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "get_my_registration_status",
    description: "Check whether the current logged-in participant has booked or planned a specific event pass.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.INTEGER, description: "The event ID to check" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "get_my_itinerary",
    description: "Fetch the logged-in user's personalized festival schedule including booked passes, dates, venues, and pass codes.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "check_my_schedule_conflicts",
    description: "Run Rangora Plan Rescue to analyze the user's booked events and identify overlapping time windows.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "search_rangora_faq",
    description: "Search official campus festival policies, guidelines, ticket rules, Event Echo rules, and venue directories.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query or policy keyword" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_my_vouchers",
    description: "Retrieve active, redeemed, and available discount vouchers for the current participant.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "propose_consequential_action",
    description: "Propose a consequential state-modifying action (such as booking a pass or claiming a voucher) for the user to confirm with a single click. Do NOT attempt to book directly.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "Action type: 'book_pass', 'cancel_pass', or 'redeem_voucher'" },
        eventId: { type: Type.INTEGER, description: "Event ID involved in the booking or cancellation" },
        voucherId: { type: Type.STRING, description: "Voucher identifier or campaign code involved" },
        summary: { type: Type.STRING, description: "Clear summary of the action" },
        buttonLabel: { type: Type.STRING, description: "Button label, e.g. 'Confirm Pass Booking (₹150)'" },
      },
      required: ["action", "summary", "buttonLabel"],
    },
  },
];

// =========================================================================
// 4. Server-Side Tool Resolvers
// =========================================================================

export interface ToolContext {
  userId?: string | null;
  isDemo?: boolean;
}

export async function searchEvents(
  args: z.infer<typeof searchEventsSchema>,
  ctx: ToolContext = {}
) {
  const db = getDb();
  if (db && !ctx.isDemo) {
    const rows = await db.select().from(schema.events);
    const catRows = await db.select().from(schema.categories);
    const festRows = await db.select().from(schema.festivals);
    const regRows = await db.select().from(schema.registrations);

    const catMap = new Map(catRows.map(c => [c.id, c.name]));
    const festMap = new Map(festRows.map(f => [f.id, f.name]));

    let results = rows.map(e => {
      const bookedCount = regRows.filter(r => r.eventId === e.id && r.kind === "booked").length;
      return {
        id: e.id,
        name: e.name,
        subtitle: e.subtitle,
        category: catMap.get(e.categoryId) || "General",
        categoryId: e.categoryId,
        festivalId: e.festivalId,
        festivalName: e.festivalId ? festMap.get(e.festivalId) || "Festival" : "Campus Series",
        venue: e.venue,
        startAt: new Date(e.startAt).toISOString(),
        endAt: new Date(e.endAt).toISOString(),
        price: e.price,
        maxSeats: e.maxSeats,
        bookedSeats: bookedCount,
        availableSeats: Math.max(0, e.maxSeats - bookedCount),
        featured: e.featured,
      };
    });

    if (args.query) {
      const q = args.query.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    if (args.categoryId !== undefined) {
      results = results.filter(e => e.categoryId === args.categoryId);
    }
    if (args.festivalId !== undefined) {
      results = results.filter(e => e.festivalId === args.festivalId);
    }
    const maxP = args.maxPrice;
    if (maxP !== undefined) {
      results = results.filter(e => e.price <= maxP);
    }
    if (args.onlyAvailable) {
      results = results.filter(e => e.availableSeats > 0);
    }

    return results.slice(0, 10);
  }

  // Fallback to static catalog / demo state
  const demoEvents = demoRepo.getState().events || defaultCatalogEvents;
  const demoRegs = demoRepo.getState().registrations || [];

  let results = demoEvents.map(e => {
    const booked = demoRegs.filter(r => r.event_id === e.id && r.kind === "booked").length;
    const cat = defaultCategories.find(c => c.id === e.categoryId)?.name || "General";
    const fest = defaultFestivals.find(f => f.id === e.festivalId)?.name || "Campus Series";
    return {
      id: e.id,
      name: e.name,
      subtitle: e.subtitle,
      category: cat,
      categoryId: e.categoryId,
      festivalId: e.festivalId,
      festivalName: fest,
      venue: e.venue,
      startAt: e.startAt,
      endAt: e.endAt,
      price: e.price,
      maxSeats: e.maxSeats,
      bookedSeats: booked,
      availableSeats: Math.max(0, e.maxSeats - booked),
      featured: e.featured,
    };
  });

  if (args.query) {
    const q = args.query.toLowerCase();
    results = results.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.subtitle.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  }
  if (args.categoryId !== undefined) {
    results = results.filter(e => e.categoryId === args.categoryId);
  }
  if (args.festivalId !== undefined) {
    results = results.filter(e => e.festivalId === args.festivalId);
  }
  const maxP = args.maxPrice;
  if (maxP !== undefined) {
    results = results.filter(e => e.price <= maxP);
  }
  if (args.onlyAvailable) {
    results = results.filter(e => e.availableSeats > 0);
  }

  return results.slice(0, 10);
}

export async function getEventDetails(
  args: z.infer<typeof getEventDetailsSchema>,
  ctx: ToolContext = {}
) {
  const db = getDb();
  if (db && !ctx.isDemo) {
    const [event] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, args.eventId))
      .limit(1);

    if (!event) return null;

    const [cat] = await db.select().from(schema.categories).where(eq(schema.categories.id, event.categoryId)).limit(1);
    const [fest] = event.festivalId
      ? await db.select().from(schema.festivals).where(eq(schema.festivals.id, event.festivalId)).limit(1)
      : [null];
    const regRows = await db
      .select()
      .from(schema.registrations)
      .where(and(eq(schema.registrations.eventId, event.id), eq(schema.registrations.kind, "booked")));

    const booked = regRows.length;

    return {
      id: event.id,
      name: event.name,
      subtitle: event.subtitle,
      description: event.description,
      category: cat?.name || "General",
      festivalName: fest?.name || "Campus Series",
      venue: event.venue,
      startAt: new Date(event.startAt).toISOString(),
      endAt: new Date(event.endAt).toISOString(),
      price: event.price,
      maxSeats: event.maxSeats,
      bookedSeats: booked,
      availableSeats: Math.max(0, event.maxSeats - booked),
      artists: event.artists,
      terms: event.terms,
    };
  }

  const demoEvents = demoRepo.getState().events || defaultCatalogEvents;
  const event = demoEvents.find(e => e.id === args.eventId);
  if (!event) return null;

  const demoRegs = demoRepo.getState().registrations || [];
  const booked = demoRegs.filter(r => r.event_id === event.id && r.kind === "booked").length;
  const cat = defaultCategories.find(c => c.id === event.categoryId)?.name || "General";
  const fest = defaultFestivals.find(f => f.id === event.festivalId)?.name || "Campus Series";

  return {
    id: event.id,
    name: event.name,
    subtitle: event.subtitle,
    description: event.description,
    category: cat,
    festivalName: fest,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt,
    price: event.price,
    maxSeats: event.maxSeats,
    bookedSeats: booked,
    availableSeats: Math.max(0, event.maxSeats - booked),
    artists: event.artists || [],
    terms: event.terms || "Standard campus rules apply.",
  };
}

export async function getLiveSeatAvailability(
  args: z.infer<typeof getLiveSeatAvailabilitySchema>,
  ctx: ToolContext = {}
) {
  const details = await getEventDetails({ eventId: args.eventId }, ctx);
  if (!details) {
    return { error: `Event #${args.eventId} not found.` };
  }

  const ratio = details.maxSeats > 0 ? details.bookedSeats / details.maxSeats : 1;
  const percentageBooked = Math.round(ratio * 100);

  let status: "available" | "warm" | "critical" | "sold_out" = "available";
  if (details.availableSeats <= 0) {
    status = "sold_out";
  } else if (ratio >= 0.85) {
    status = "critical";
  } else if (ratio >= 0.6) {
    status = "warm";
  }

  return {
    eventId: details.id,
    eventName: details.name,
    venue: details.venue,
    maxSeats: details.maxSeats,
    bookedSeats: details.bookedSeats,
    availableSeats: details.availableSeats,
    percentageBooked,
    status,
  };
}

export async function getMyRegistrationStatus(
  args: z.infer<typeof getMyRegistrationStatusSchema>,
  ctx: ToolContext
) {
  const effectiveUserId = ctx.userId || (ctx.isDemo ? DEMO_PARTICIPANT_ID : null);
  if (!effectiveUserId) {
    return {
      authenticated: false,
      message: "Please sign in to check your pass booking status.",
    };
  }

  const db = getDb();
  if (db && !ctx.isDemo && effectiveUserId !== DEMO_PARTICIPANT_ID) {
    const [reg] = await db
      .select()
      .from(schema.registrations)
      .where(and(eq(schema.registrations.userId, effectiveUserId), eq(schema.registrations.eventId, args.eventId)))
      .limit(1);

    if (!reg) {
      return {
        eventId: args.eventId,
        registered: false,
        kind: null,
      };
    }

    const [att] = await db
      .select()
      .from(schema.attendance)
      .where(and(eq(schema.attendance.userId, effectiveUserId), eq(schema.attendance.eventId, args.eventId)))
      .limit(1);

    return {
      eventId: args.eventId,
      registered: true,
      kind: reg.kind,
      passCode: reg.passCode,
      attendanceVerified: Boolean(att),
    };
  }

  // Demo fallback
  const demoRegs = demoRepo.getState().registrations || [];
  const reg = demoRegs.find(r => r.user_id === effectiveUserId && r.event_id === args.eventId);
  if (!reg) {
    return {
      eventId: args.eventId,
      registered: false,
      kind: null,
    };
  }

  return {
    eventId: args.eventId,
    registered: true,
    kind: reg.kind,
    passCode: reg.pass_code,
    attendanceVerified: Boolean(reg.verified),
  };
}

export async function getMyItinerary(
  _args: Record<string, never>,
  ctx: ToolContext
) {
  const effectiveUserId = ctx.userId || (ctx.isDemo ? DEMO_PARTICIPANT_ID : null);
  if (!effectiveUserId) {
    return {
      authenticated: false,
      message: "Please sign in to view your festival itinerary.",
      itinerary: [],
    };
  }

  const db = getDb();
  if (db && !ctx.isDemo && effectiveUserId !== DEMO_PARTICIPANT_ID) {
    const userRegs = await db
      .select()
      .from(schema.registrations)
      .where(eq(schema.registrations.userId, effectiveUserId));

    const eventIds = userRegs.map(r => r.eventId);
    if (eventIds.length === 0) {
      return {
        userId: effectiveUserId,
        count: 0,
        itinerary: [],
        message: "You have not registered for any events yet.",
      };
    }

    const allEvents = await db.select().from(schema.events);
    const eventMap = new Map(allEvents.map(e => [e.id, e]));

    const attRows = await db.select().from(schema.attendance).where(eq(schema.attendance.userId, effectiveUserId));
    const attSet = new Set(attRows.map(a => a.eventId));

    const itinerary = userRegs.map(r => {
      const e = eventMap.get(r.eventId);
      return {
        eventId: r.eventId,
        eventName: e?.name || `Event #${r.eventId}`,
        venue: e?.venue || "Campus Venue",
        startAt: e ? new Date(e.startAt).toISOString() : "",
        endAt: e ? new Date(e.endAt).toISOString() : "",
        kind: r.kind,
        passCode: r.passCode,
        attendanceVerified: attSet.has(r.eventId),
      };
    });

    return {
      userId: effectiveUserId,
      count: itinerary.length,
      itinerary,
    };
  }

  // Demo fallback
  const demoRegs = demoRepo.getState().registrations || [];
  const userRegs = demoRegs.filter(r => r.user_id === effectiveUserId);
  const demoEvents = demoRepo.getState().events || defaultCatalogEvents;
  const eventMap = new Map(demoEvents.map(e => [e.id, e]));

  const itinerary = userRegs.map(r => {
    const e = eventMap.get(r.event_id);
    return {
      eventId: r.event_id,
      eventName: e?.name || `Event #${r.event_id}`,
      venue: e?.venue || "Campus Venue",
      startAt: e?.startAt || "",
      endAt: e?.endAt || "",
      kind: r.kind,
      passCode: r.pass_code,
      attendanceVerified: Boolean(r.verified),
    };
  });

  return {
    userId: effectiveUserId,
    count: itinerary.length,
    itinerary,
  };
}

export async function checkMyScheduleConflicts(
  _args: Record<string, never>,
  ctx: ToolContext
) {
  const result = await getMyItinerary({}, ctx);
  if (!result.itinerary || result.itinerary.length < 2) {
    return {
      hasConflicts: false,
      conflictPairs: [],
      recommendation: result.authenticated === false
        ? "Please sign in to check your schedule for conflicts."
        : "No overlapping events found. Your registered schedule is clear!",
    };
  }

  const items = result.itinerary;
  const conflictPairs: Array<{
    eventA: { id: number; name: string; startAt: string; endAt: string };
    eventB: { id: number; name: string; startAt: string; endAt: string };
    overlapMinutes: number;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;

      const startA = new Date(a.startAt).getTime();
      const endA = new Date(a.endAt).getTime();
      const startB = new Date(b.startAt).getTime();
      const endB = new Date(b.endAt).getTime();

      if (startA < endB && endA > startB) {
        const overlapMs = Math.min(endA, endB) - Math.max(startA, startB);
        const overlapMinutes = Math.round(overlapMs / (1000 * 60));
        conflictPairs.push({
          eventA: { id: a.eventId, name: a.eventName, startAt: a.startAt, endAt: a.endAt },
          eventB: { id: b.eventId, name: b.eventName, startAt: b.startAt, endAt: b.endAt },
          overlapMinutes,
        });
      }
    }
  }

  return {
    hasConflicts: conflictPairs.length > 0,
    conflictPairs,
    recommendation: conflictPairs.length > 0
      ? `Plan Rescue Alert: You have ${conflictPairs.length} schedule conflict(s). Consider cancelling or rescheduling overlapping planned passes.`
      : "Your registered schedule is free of timing conflicts.",
  };
}

export async function searchRangoraFaq(
  args: z.infer<typeof searchRangoraFaqSchema>
) {
  const q = args.query.toLowerCase();
  const matches = RANGORA_FAQ.filter(
    item => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
  );
  return matches.length > 0 ? matches : RANGORA_FAQ.slice(0, 3);
}

export async function getMyVouchers(
  _args: Record<string, never>,
  ctx: ToolContext
) {
  const effectiveUserId = ctx.userId || (ctx.isDemo ? DEMO_PARTICIPANT_ID : null);
  if (!effectiveUserId) {
    return {
      authenticated: false,
      message: "Please sign in to view your vouchers.",
      vouchers: [],
    };
  }

  const db = getDb();
  if (db && !ctx.isDemo && effectiveUserId !== DEMO_PARTICIPANT_ID) {
    const userVoucherRows = await db
      .select()
      .from(schema.userVouchers)
      .where(eq(schema.userVouchers.userId, effectiveUserId));

    const campaigns = await db.select().from(schema.voucherCampaigns);
    const campMap = new Map(campaigns.map(c => [c.id, c]));

    const vouchers = userVoucherRows.map(v => {
      const camp = campMap.get(v.campaignId);
      return {
        voucherId: v.id,
        campaignTitle: camp?.title || "Festival Perk",
        code: v.code,
        discountPct: camp?.pct || 0,
        validUntil: camp?.validUntil || "2026-12-31",
        description: camp?.description || "",
      };
    });

    return {
      userId: effectiveUserId,
      count: vouchers.length,
      vouchers,
    };
  }

  // Demo fallback
  const demoVouchers = demoRepo.getState().userVouchers || [];
  const campaigns = demoRepo.getState().campaigns || [];
  const campMap = new Map(campaigns.map(c => [c.id, c]));

  const vouchers = demoVouchers.map(v => {
    const camp = campMap.get(v.campaign_id);
    return {
      voucherId: v.id,
      campaignTitle: camp?.title || "Festival Perk",
      code: v.code,
      discountPct: camp?.pct || 0,
      validUntil: "2026-12-31",
      description: camp?.description || "",
    };
  });

  return {
    userId: effectiveUserId,
    count: vouchers.length,
    vouchers,
  };
}

export function proposeConsequentialAction(
  args: z.infer<typeof proposeActionSchema>
): ProposedAction {
  return {
    action: args.action,
    eventId: args.eventId,
    voucherId: args.voucherId,
    summary: args.summary,
    buttonLabel: args.buttonLabel,
  };
}

// =========================================================================
// 5. Unified Tool Dispatcher
// =========================================================================

export async function executeGeminiTool(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolContext = {}
): Promise<{ result: any; proposal?: ProposedAction }> {
  switch (toolName) {
    case "search_events":
      return { result: await searchEvents(searchEventsSchema.parse(args), ctx) };
    case "get_event_details":
      return { result: await getEventDetails(getEventDetailsSchema.parse(args), ctx) };
    case "get_live_seat_availability":
      return { result: await getLiveSeatAvailability(getLiveSeatAvailabilitySchema.parse(args), ctx) };
    case "get_my_registration_status":
      return { result: await getMyRegistrationStatus(getMyRegistrationStatusSchema.parse(args), ctx) };
    case "get_my_itinerary":
      return { result: await getMyItinerary({}, ctx) };
    case "check_my_schedule_conflicts":
      return { result: await checkMyScheduleConflicts({}, ctx) };
    case "search_rangora_faq":
      return { result: await searchRangoraFaq(searchRangoraFaqSchema.parse(args)) };
    case "get_my_vouchers":
      return { result: await getMyVouchers({}, ctx) };
    case "propose_consequential_action": {
      const proposal = proposeConsequentialAction(proposeActionSchema.parse(args));
      return {
        result: {
          status: "proposal_created",
          message: `Created proposal: ${proposal.summary}. Awaiting explicit confirmation click from participant.`,
        },
        proposal,
      };
    }
    default:
      throw new Error(`Unknown Gemini tool function: "${toolName}"`);
  }
}
