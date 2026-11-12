import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { events as defaultCatalogEvents, categories, achievements as defaultAchievements, voucherCampaigns as defaultVouchers } from "@/data/catalog";

export interface DemoEvent {
  id: number;
  festivalId: number;
  categoryId: number;
  venue: string;
  name: string;
  subtitle: string;
  description: string;
  startAt: string;
  endAt: string;
  price: number;
  maxSeats: number;
  featured: boolean;
  poster: string;
  artists: string[];
  terms: string;
  organiserId: string | null;
  published: boolean;
}

export interface DemoRegistration {
  id: string;
  user_id: string;
  event_id: number;
  kind: "booked" | "planned";
  pass_code: string;
  verified: boolean;
  created_at: string;
}

export interface DemoUserAchievement {
  user_id: string;
  code: string;
  earned_at: string;
}

export interface DemoUserVoucher {
  id: string;
  user_id: string;
  campaign_id: number;
  code: string;
  issued_at: string;
}

export interface DemoEcho {
  id: string;
  event_id: number;
  user_id: string;
  author_name: string;
  rating: number;
  comment: string;
  media: Array<{ path: string; name: string; type: string }>;
  tagged_friends: string[];
  liked_by_organiser: boolean;
  visibility: "private" | "campus" | "public";
  moderation_status?: "approved" | "flagged" | "hidden";
  created_at: string;
}

export interface DemoOrganiserProfile {
  user_id: string;
  org_name: string;
  position: string;
  org_type: string;
  institutional_id: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface DemoSponsor {
  id: string;
  user_id: string | null;
  name: string;
  tier: string;
  amount: number;
  contact?: string | null;
  message?: string | null;
  status: "requested" | "approved" | "rejected" | "active";
  created_at: string;
}

export interface DemoHelpRequest {
  id: string;
  user_id: string;
  author_name: string;
  event_id: number | null;
  category: string;
  subject: string;
  message: string;
  status: "open" | "routed" | "resolved";
  answer: string | null;
  routed_to: string | null;
  created_at: string;
}

export interface DemoLeaderboardRow {
  user_id: string;
  display_name: string;
  department: string;
  points: number;
}

export interface DemoCampaign {
  id: number;
  title: string;
  type: string;
  pct: number;
  description: string;
  stock: number;
}

export interface DemoState {
  events: DemoEvent[];
  registrations: DemoRegistration[];
  userAchievements: DemoUserAchievement[];
  userVouchers: DemoUserVoucher[];
  campaigns: DemoCampaign[];
  echoes: DemoEcho[];
  organisers: DemoOrganiserProfile[];
  sponsors: DemoSponsor[];
  helpRequests: DemoHelpRequest[];
  leaderboard: DemoLeaderboardRow[];
  participantProfile: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    address: string;
    department: string;
    course: string;
    preferences: string[];
  };
  organiserProfile: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    address: string;
    department: string;
    course: string;
    preferences: string[];
  };
}

// Deterministic RFC 4122 v4 UUIDs for Neon PostgreSQL schema compatibility
export const DEMO_PARTICIPANT_ID = "d3300001-0000-4000-8000-000000000001";
export const DEMO_ORGANISER_ID = "d3300002-0000-4000-8000-000000000002";
export const DEMO_ADMIN_ID = "d3300003-0000-4000-8000-000000000003";
export const DEMO_APPLICANT_AARAV = "d3300004-0000-4000-8000-000000000004";
export const DEMO_APPLICANT_SNEHA = "d3300005-0000-4000-8000-000000000005";

export function resolveDemoUserId(id: string): string {
  if (id === "demo-participant-maya") return DEMO_PARTICIPANT_ID;
  if (id === "demo-organiser-ritwik") return DEMO_ORGANISER_ID;
  if (id === "demo-admin-console") return DEMO_ADMIN_ID;
  if (id === "demo-applicant-aarav") return DEMO_APPLICANT_AARAV;
  if (id === "demo-applicant-sneha") return DEMO_APPLICANT_SNEHA;
  return id;
}

function createInitialDemoState(): DemoState {
  const initialEvents: DemoEvent[] = defaultCatalogEvents.map((e) => ({
    ...e,
    artists: [],
    terms: "Campus ID required at check-in. Carry water and valid booking pass.",
    organiserId: e.id === 4 || e.id === 27 || e.id === 43 ? DEMO_ORGANISER_ID : null,
    published: true,
  }));

  const initialRegistrations: DemoRegistration[] = [
    {
      id: "d3300101-0000-4000-8000-000000000101",
      user_id: DEMO_PARTICIPANT_ID,
      event_id: 4, // Mitti & Indigo: Wheel Pottery & Woodblock Studio
      kind: "booked",
      pass_code: "RNG-DEMO-1042",
      verified: true,
      created_at: "2026-11-10T10:00:00Z",
    },
    {
      id: "d3300102-0000-4000-8000-000000000102",
      user_id: DEMO_PARTICIPANT_ID,
      event_id: 1, // Dusk Raga & Indie Folk Session
      kind: "booked",
      pass_code: "RNG-DEMO-1043",
      verified: false,
      created_at: "2026-11-10T14:30:00Z",
    },
    {
      id: "d3300103-0000-4000-8000-000000000103",
      user_id: DEMO_PARTICIPANT_ID,
      event_id: 2, // Katha & Kinetic
      kind: "planned",
      pass_code: "RNG-PLAN-002",
      verified: false,
      created_at: "2026-11-11T09:00:00Z",
    },
  ];

  const initialEchoes: DemoEcho[] = [
    {
      id: "d3300201-0000-4000-8000-000000000201",
      event_id: 4,
      user_id: DEMO_PARTICIPANT_ID,
      author_name: "Maya Sen",
      rating: 5,
      comment: "Loved centering local river clay on the wheel. Taking home a handmade terracotta vessel was magical! Studio masters were patient and inspiring.",
      media: [{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }],
      tagged_friends: ["Arjun Sen", "Pooja Das"],
      liked_by_organiser: true,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-10T18:00:00Z",
    },
    {
      id: "d3300202-0000-4000-8000-000000000202",
      event_id: 1,
      user_id: "d3300010-0000-4000-8000-000000000010",
      author_name: "Aanya Sen",
      rating: 5,
      comment: "The acoustic sitar in the dusk courtyard gave everyone goosebumps! Unforgettable open-air evening with hot spiced chai under festive lights.",
      media: [{ path: "/assets/echoes/raga_concert.svg", name: "raga_concert.svg", type: "image/svg+xml" }],
      tagged_friends: ["Priya Roy", "Kabir Roy"],
      liked_by_organiser: true,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-10T21:15:00Z",
    },
    {
      id: "d3300203-0000-4000-8000-000000000203",
      event_id: 13,
      user_id: "d3300011-0000-4000-8000-000000000011",
      author_name: "Dev Patel",
      rating: 5,
      comment: "Testing our pathfinding algorithm on the mock lunar gravel arena was intense. The calibrated LiDAR and depth sensors worked flawlessly!",
      media: [{ path: "/assets/echoes/robotics_sprint.svg", name: "robotics_sprint.svg", type: "image/svg+xml" }],
      tagged_friends: ["Rohan Mukherjee"],
      liked_by_organiser: true,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-11T11:40:00Z",
    },
    {
      id: "d3300204-0000-4000-8000-000000000204",
      event_id: 2,
      user_id: "d3300012-0000-4000-8000-000000000012",
      author_name: "Priya Roy",
      rating: 4,
      comment: "Mesmerizing fusion of Kathak mudras with contemporary floor work and live tabla accompaniment. Pure visual poetry in the conservatory.",
      media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
      tagged_friends: ["Maya Sen", "Sunita Rao"],
      liked_by_organiser: false,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-11T13:20:00Z",
    },
    {
      id: "d3300205-0000-4000-8000-000000000205",
      event_id: 3,
      user_id: "d3300013-0000-4000-8000-000000000013",
      author_name: "Rohan Mukherjee",
      rating: 5,
      comment: "Sipping clay kulhad chai on the observatory lawn while watching student 16mm shorts under the open sky was peak autumn campus nostalgia.",
      media: [{ path: "/assets/echoes/cinema_circle.svg", name: "cinema_circle.svg", type: "image/svg+xml" }],
      tagged_friends: ["Aanya Sen", "Arjun Sen"],
      liked_by_organiser: true,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-11T15:10:00Z",
    },
    {
      id: "d3300206-0000-4000-8000-000000000206",
      event_id: 16,
      user_id: "d3300014-0000-4000-8000-000000000014",
      author_name: "Arjun Sen",
      rating: 5,
      comment: "The acrobatic Purulia Chhau leaps and live dhamsa drums reverberated right through the banyan tree roots! Spectacular energy.",
      media: [{ path: "/assets/echoes/dance_kathak.svg", name: "dance_kathak.svg", type: "image/svg+xml" }],
      tagged_friends: ["Maya Sen"],
      liked_by_organiser: false,
      visibility: "public",
      moderation_status: "approved",
      created_at: "2026-11-11T16:00:00Z",
    },
  ];

  const initialCampaigns: DemoCampaign[] = defaultVouchers.map((v) => ({
    id: v.id,
    title: v.title,
    type: v.type,
    pct: v.pct,
    description: v.description,
    stock: v.id === 1 ? 184 : v.id === 2 ? 42 : 100,
  }));

  const initialAchievements: DemoUserAchievement[] = [
    { user_id: DEMO_PARTICIPANT_ID, code: "first_experience", earned_at: "2026-11-10T10:05:00Z" },
    { user_id: DEMO_PARTICIPANT_ID, code: "guild_artisan", earned_at: "2026-11-10T13:10:00Z" },
    { user_id: DEMO_PARTICIPANT_ID, code: "verified_debut", earned_at: "2026-11-10T13:15:00Z" },
  ];

  const initialVouchers: DemoUserVoucher[] = [
    { id: "d3300301-0000-4000-8000-000000000301", user_id: DEMO_PARTICIPANT_ID, campaign_id: 1, code: "RNG-DEMO-50PCT", issued_at: "2026-11-10T10:05:00Z" },
    { id: "d3300302-0000-4000-8000-000000000302", user_id: DEMO_PARTICIPANT_ID, campaign_id: 2, code: "RNG-DEMO-MAKER", issued_at: "2026-11-10T13:15:00Z" },
  ];

  const initialOrganisers: DemoOrganiserProfile[] = [
    {
      user_id: DEMO_ORGANISER_ID,
      org_name: "Campus Arts Guild",
      position: "Convenor & Studio Lead",
      org_type: "Fine Arts Club",
      institutional_id: "INST-ART-2024-09",
      description: "Host wheel pottery, printmaking labs, and architectural courtyard sketches across festivals.",
      status: "approved",
      review_note: null,
      reviewed_at: "2026-11-08T12:00:00Z",
      created_at: "2026-11-08T10:00:00Z",
    },
    {
      user_id: DEMO_APPLICANT_AARAV,
      org_name: "Robotics & Hardware Society",
      position: "Technical Director",
      org_type: "Engineering Society",
      institutional_id: "ROBO-2026-88",
      description: "Run 24-hr hardware sprints, autonomous micro-rover arena exhibitions, and cyber defense CTF challenges.",
      status: "pending",
      review_note: null,
      reviewed_at: null,
      created_at: "2026-11-10T14:00:00Z",
    },
    {
      user_id: DEMO_APPLICANT_SNEHA,
      org_name: "Campus Cinema Collective",
      position: "Curator",
      org_type: "Media & Film Guild",
      institutional_id: "FILM-2025-04",
      description: "Outdoor 16mm student short films and director conversation circles under the stars.",
      status: "approved",
      review_note: null,
      reviewed_at: "2026-11-09T18:00:00Z",
      created_at: "2026-11-09T16:00:00Z",
    },
  ];

  const initialSponsors: DemoSponsor[] = [
    {
      id: "d3300401-0000-4000-8000-000000000401",
      user_id: DEMO_ORGANISER_ID,
      name: "Northstar Campus Café",
      tier: "Gold",
      amount: 45000,
      contact: "partnerships@northstarcafe.in",
      message: "Providing complimentary cold brew & spiced chai stations for courtyard workshops.",
      status: "requested",
      created_at: "2026-11-10T12:00:00Z",
    },
    {
      id: "d3300402-0000-4000-8000-000000000402",
      user_id: null,
      name: "Bengal Heritage Crafts Trust",
      tier: "Gold",
      amount: 75000,
      contact: "trust@bengalcrafts.org",
      message: "Endowing terracotta wheel masterclasses and natural dye supplies.",
      status: "active",
      created_at: "2026-11-07T10:00:00Z",
    },
  ];

  const initialHelp: DemoHelpRequest[] = [
    {
      id: "d3300501-0000-4000-8000-000000000501",
      user_id: DEMO_PARTICIPANT_ID,
      author_name: "Maya Sen",
      event_id: 4,
      category: "event",
      subject: "Pottery studio clay trimming tools",
      message: "Are trimming loops and aprons provided at the studio, or should participants bring their own?",
      status: "open",
      answer: null,
      routed_to: DEMO_ORGANISER_ID,
      created_at: "2026-11-10T11:20:00Z",
    },
    {
      id: "d3300502-0000-4000-8000-000000000502",
      user_id: "d3300012-0000-4000-8000-000000000012",
      author_name: "Priya Roy",
      event_id: null,
      category: "voucher",
      subject: "Voucher validity extension",
      message: "Can I use the Autumn 50% pass voucher for next week's Yantra & Verse Hackathon?",
      status: "open",
      answer: null,
      routed_to: null,
      created_at: "2026-11-11T08:30:00Z",
    },
  ];

  const initialLeaderboard: DemoLeaderboardRow[] = [
    { user_id: "demo-user-aanya", display_name: "Aanya Sen", department: "Computer Science", points: 190 },
    { user_id: "demo-user-dev", display_name: "Dev Patel", department: "Electronics Eng.", points: 150 },
    { user_id: "demo-user-priya", display_name: "Priya Roy", department: "Architecture", points: 130 },
    { user_id: DEMO_PARTICIPANT_ID, display_name: "Maya Sen", department: "Visual Arts · Year 2", points: 110 },
    { user_id: "demo-user-rohan", display_name: "Rohan Mukherjee", department: "Biotechnology", points: 80 },
  ];

  return {
    events: initialEvents,
    registrations: initialRegistrations,
    userAchievements: initialAchievements,
    userVouchers: initialVouchers,
    campaigns: initialCampaigns,
    echoes: initialEchoes,
    organisers: initialOrganisers,
    sponsors: initialSponsors,
    helpRequests: initialHelp,
    leaderboard: initialLeaderboard,
    participantProfile: {
      id: DEMO_PARTICIPANT_ID,
      full_name: "Maya Sen",
      email: "maya.sen@campus.rangora.in",
      phone: "+91 98301 23456",
      address: "Salt Lake Campus Hostel 3, Room 204",
      department: "Visual Arts · Year 2",
      course: "B.Des Interaction Design",
      preferences: ["workshops", "cultural", "music"],
    },
    organiserProfile: {
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
}

const DATA_DIR = path.resolve(process.cwd(), ".demo-data");
const DATA_FILE = path.join(DATA_DIR, "demo-state.json");

let memoryState: DemoState | null = null;

function loadState(): DemoState {
  if (memoryState) return memoryState;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      memoryState = JSON.parse(raw) as DemoState;
      return memoryState;
    }
  } catch {
    // Fall back to initial state
  }

  memoryState = createInitialDemoState();
  saveState(memoryState);
  return memoryState;
}

function saveState(state: DemoState) {
  memoryState = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // If running in a read-only environment, keep in memory
  }
}

/** Recalculates points and badges for a participant based on genuine records */
function recomputeParticipantRewards(state: DemoState, userId: string) {
  const bookedRegs = state.registrations.filter((r) => r.user_id === userId && r.kind === "booked");
  const bookedCount = bookedRegs.length;
  const verifiedCount = bookedRegs.filter((r) => r.verified).length;

  const earnedCodes = new Set(
    state.userAchievements.filter((a) => a.user_id === userId).map((a) => a.code)
  );

  const award = (code: string) => {
    if (!earnedCodes.has(code)) {
      earnedCodes.add(code);
      state.userAchievements.push({
        user_id: userId,
        code,
        earned_at: new Date().toISOString(),
      });
    }
  };

  if (bookedCount >= 1) award("first_experience");
  if (verifiedCount >= 1) award("verified_debut");
  if (verifiedCount >= 3) award("festival_finisher");

  // Category specific awards
  for (const reg of bookedRegs) {
    const event = state.events.find((e) => e.id === reg.event_id);
    if (!event) continue;
    if (event.categoryId === 4) award("guild_artisan");
    if (event.categoryId === 1) award("music_connoisseur");
    if (event.categoryId === 2) award("cultural_explorer");
    if (event.categoryId === 3) award("tech_trailblazer");
    if (event.categoryId === 5) award("gaming_champion");
  }

  // Calculate points
  let points = bookedCount * 10 + verifiedCount * 25;
  for (const ach of state.userAchievements.filter((a) => a.user_id === userId)) {
    const def = defaultAchievements.find((item) => item.code === ach.code);
    if (def) points += def.points;
  }

  // Update leaderboard
  const leaderIdx = state.leaderboard.findIndex((row) => row.user_id === userId);
  if (leaderIdx >= 0) {
    state.leaderboard[leaderIdx]!.points = points;
  } else {
    state.leaderboard.push({
      user_id: userId,
      display_name: state.participantProfile.full_name,
      department: state.participantProfile.department,
      points,
    });
  }

  state.leaderboard.sort((a, b) => b.points - a.points);
}

export const demoRepo = {
  getState(): DemoState {
    return loadState();
  },

  reloadFromDisk(): DemoState {
    memoryState = null;
    return loadState();
  },

  reset(): DemoState {
    const fresh = createInitialDemoState();
    saveState(fresh);
    return fresh;
  },

  getBookedCounts(): Record<number, number> {
    const state = loadState();
    const counts: Record<number, number> = {};
    for (const r of state.registrations) {
      if (r.kind === "booked") {
        counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
      }
    }
    return counts;
  },

  bookPass(userId: string, eventId: number, kind: "booked" | "planned"): DemoRegistration {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const event = state.events.find((e) => e.id === eventId);
    if (!event) throw new Error("Event not found in demo catalogue.");

    const existing = state.registrations.find((r) => r.user_id === resolvedUserId && r.event_id === eventId);
    if (existing) {
      if (existing.kind === kind) throw new Error("You already hold this pass.");
      existing.kind = kind;
      recomputeParticipantRewards(state, resolvedUserId);
      saveState(state);
      return existing;
    }

    if (kind === "booked") {
      const currentBooked = state.registrations.filter((r) => r.event_id === eventId && r.kind === "booked").length;
      if (currentBooked >= event.maxSeats) {
        throw new Error("This event has reached full capacity. No seats remaining.");
      }
    }

    const reg: DemoRegistration = {
      id: crypto.randomUUID(),
      user_id: resolvedUserId,
      event_id: eventId,
      kind,
      pass_code: `RNG-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
      verified: false,
      created_at: new Date().toISOString(),
    };

    state.registrations.unshift(reg);
    recomputeParticipantRewards(state, resolvedUserId);
    saveState(state);
    return reg;
  },

  cancelPass(userId: string, registrationId: string) {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const idx = state.registrations.findIndex((r) => r.id === registrationId && (r.user_id === resolvedUserId || r.user_id === userId));
    if (idx < 0) throw new Error("Registration not found or not owned by you.");
    state.registrations.splice(idx, 1);
    recomputeParticipantRewards(state, resolvedUserId);
    saveState(state);
  },

  verifyAttendance(passCode: string): DemoRegistration & { participantName: string } {
    const state = loadState();
    const cleanCode = passCode.trim().toUpperCase();
    const reg = state.registrations.find((r) => r.pass_code.toUpperCase() === cleanCode && r.kind === "booked");
    if (!reg) throw new Error("No confirmed booking found matching pass code " + cleanCode);

    reg.verified = true;
    recomputeParticipantRewards(state, reg.user_id);
    saveState(state);
    const participantName = reg.user_id === DEMO_PARTICIPANT_ID ? state.participantProfile.full_name : "Attendee";
    return {
      ...reg,
      participantName,
    };
  },

  saveInterests(userId: string, preferences: string[]) {
    const state = loadState();
    if (userId === DEMO_PARTICIPANT_ID) {
      state.participantProfile.preferences = preferences;
      saveState(state);
    }
  },

  createEvent(organiserId: string, data: Partial<DemoEvent>, published = false): DemoEvent {
    const state = loadState();
    const venue = data.venue?.trim() || "Courtyard Stage";
    const startAt = data.startAt || new Date().toISOString();
    const endAt = data.endAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const startTime = new Date(startAt).getTime();
    const endTime = new Date(endAt).getTime();

    // Venue schedule conflict check: same venue overlapping times
    const clash = state.events.find((e) => {
      if (e.venue.toLowerCase() !== venue.toLowerCase()) return false;
      const eStart = new Date(e.startAt).getTime();
      const eEnd = new Date(e.endAt).getTime();
      return startTime < eEnd && endTime > eStart;
    });

    if (clash) {
      throw new Error(`Schedule clash: ${venue} is already reserved for "${clash.name}" during this time window.`);
    }

    const id = Math.max(100, ...state.events.map((e) => e.id)) + 1;
    const newEvent: DemoEvent = {
      id,
      festivalId: Number(data.festivalId) || 1,
      categoryId: Number(data.categoryId) || 1,
      venue,
      name: data.name?.trim() || "Untitled Campus Event",
      subtitle: data.subtitle?.trim() || "",
      description: data.description?.trim() || "",
      startAt,
      endAt,
      price: Number(data.price) || 0,
      maxSeats: Number(data.maxSeats) || 30,
      featured: false,
      poster: data.poster || "hero_festival.jpg",
      artists: data.artists ?? [],
      terms: data.terms || "Standard festival entry terms apply.",
      organiserId,
      published,
    };

    state.events.unshift(newEvent);
    saveState(state);
    return newEvent;
  },

  updateEventPublish(id: number, published: boolean) {
    const state = loadState();
    const event = state.events.find((e) => e.id === id);
    if (!event) throw new Error("Event not found.");
    event.published = published;
    saveState(state);
    return event;
  },

  submitEcho(
    userId: string,
    authorName: string,
    eventId: number,
    rating: number,
    comment: string,
    taggedFriends: string[] = [],
    media: Array<{ path: string; name: string; type: string }> = [],
    visibility: "private" | "campus" | "public" = "private",
    publicConsent: boolean = false
  ): DemoEcho {
    if (visibility === "public" && !publicConsent) {
      throw new Error("Explicit participant consent is required for public Event Pulse visibility.");
    }
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();

    const event = state.events.find((e) => e.id === eventId);
    if (!event) throw new Error("Event not found.");
    const eventEnded = new Date(event.endAt).getTime() < Date.now() || eventId === 1 || eventId === 4;
    if (!eventEnded) {
      throw new Error("Event Echo feedback opens only after the event has concluded.");
    }

    const reg = state.registrations.find((r) => (r.user_id === resolvedUserId || r.user_id === userId) && r.event_id === eventId && r.kind === "booked");
    if (!reg) throw new Error("Only participants holding a confirmed pass for this event may submit an Event Echo.");
    if (!reg.verified) {
      throw new Error("Attendance check-in must be verified by the event organiser before submitting an Event Echo.");
    }

    const echo: DemoEcho = {
      id: crypto.randomUUID(),
      event_id: eventId,
      user_id: resolvedUserId,
      author_name: authorName,
      rating: Math.min(5, Math.max(1, rating)),
      comment: comment.trim(),
      media,
      tagged_friends: taggedFriends,
      liked_by_organiser: false,
      visibility,
      moderation_status: "approved",
      created_at: new Date().toISOString(),
    };

    state.echoes.unshift(echo);
    saveState(state);
    return echo;
  },

  reportEcho(echoId: string): DemoEcho {
    const state = loadState();
    const echo = state.echoes.find((e) => e.id === echoId);
    if (!echo) throw new Error("Event Echo not found.");
    echo.moderation_status = "flagged";
    saveState(state);
    return echo;
  },

  moderateEcho(echoId: string, status: "approved" | "flagged" | "hidden"): DemoEcho {
    const state = loadState();
    const echo = state.echoes.find((e) => e.id === echoId);
    if (!echo) throw new Error("Event Echo not found.");
    echo.moderation_status = status;
    saveState(state);
    return echo;
  },

  getPulseEchoes(filters?: {
    categoryId?: number | undefined;
    festivalId?: number | undefined;
    eventId?: number | undefined;
    minRating?: number | undefined;
    hasMedia?: boolean | undefined;
    search?: string | undefined;
  }) {
    const state = loadState();
    return state.echoes.filter((e) => {
      // Must be public and approved
      if (e.visibility !== "public") return false;
      if (e.moderation_status && e.moderation_status !== "approved") return false;

      const event = state.events.find((ev) => ev.id === e.event_id);
      if (!event) return false;

      if (filters?.categoryId && event.categoryId !== filters.categoryId) return false;
      if (filters?.festivalId && event.festivalId !== filters.festivalId) return false;
      if (filters?.eventId && e.event_id !== filters.eventId) return false;
      if (filters?.minRating && e.rating < filters.minRating) return false;
      if (filters?.hasMedia && (!e.media || e.media.length === 0)) return false;

      if (filters?.search) {
        const query = filters.search.toLowerCase().trim();
        const inComment = e.comment.toLowerCase().includes(query);
        const inAuthor = e.author_name.toLowerCase().includes(query);
        const inEvent = event.name.toLowerCase().includes(query);
        const inTags = e.tagged_friends?.some((t) => t.toLowerCase().includes(query));
        if (!inComment && !inAuthor && !inEvent && !inTags) return false;
      }

      return true;
    });
  },

  toggleEchoLike(echoId: string): boolean {
    const state = loadState();
    const echo = state.echoes.find((e) => e.id === echoId);
    if (!echo) throw new Error("Event Echo not found.");
    echo.liked_by_organiser = !echo.liked_by_organiser;
    saveState(state);
    return echo.liked_by_organiser;
  },

  approveOrganiser(userId: string, status: "approved" | "rejected") {
    const resolvedId = resolveDemoUserId(userId);
    const state = loadState();
    const org = state.organisers.find((o) => o.user_id === resolvedId || o.user_id === userId);
    if (!org) throw new Error("Organiser application not found.");
    org.status = status;
    saveState(state);
    return org;
  },

  updateVoucherStock(campaignId: number, stock: number) {
    const state = loadState();
    const camp = state.campaigns.find((c) => c.id === campaignId);
    if (!camp) throw new Error("Voucher campaign not found.");
    camp.stock = stock;
    saveState(state);
    return camp;
  },

  issueVoucher(userId: string, campaignId: number): DemoUserVoucher {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const camp = state.campaigns.find((c) => c.id === campaignId);
    if (!camp) throw new Error("Voucher campaign not found.");
    if (camp.stock <= 0) throw new Error("This voucher campaign has zero remaining stock.");

    const existing = state.userVouchers.find((v) => (v.user_id === resolvedUserId || v.user_id === userId) && v.campaign_id === campaignId);
    if (existing) throw new Error("You have already claimed a voucher from this campaign.");

    camp.stock -= 1;
    const voucher: DemoUserVoucher = {
      id: crypto.randomUUID(),
      user_id: resolvedUserId,
      campaign_id: campaignId,
      code: `RNG-${camp.pct}PCT-${Math.floor(1000 + Math.random() * 9000)}`,
      issued_at: new Date().toISOString(),
    };

    state.userVouchers.unshift(voucher);
    saveState(state);
    return voucher;
  },

  redeemVoucher(userId: string, voucherId: string) {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const idx = state.userVouchers.findIndex((v) => v.id === voucherId && (v.user_id === resolvedUserId || v.user_id === userId));
    if (idx < 0) throw new Error("Voucher not found in your wallet.");
    const [voucher] = state.userVouchers.splice(idx, 1);
    if (!voucher) throw new Error("Voucher not found in your wallet.");
    saveState(state);
    return voucher;
  },

  answerHelp(id: string, answer: string) {
    const state = loadState();
    const req = state.helpRequests.find((h) => h.id === id);
    if (!req) throw new Error("Help request not found.");
    req.answer = answer.trim();
    req.status = "resolved";
    saveState(state);
    return req;
  },

  createHelpRequest(userId: string, authorName: string, category: string, subject: string, message: string, eventId: number | null): DemoHelpRequest {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const req: DemoHelpRequest = {
      id: crypto.randomUUID(),
      user_id: resolvedUserId,
      author_name: authorName,
      category,
      event_id: eventId,
      subject: subject.trim(),
      message: message.trim(),
      status: "open",
      answer: null,
      routed_to: eventId === 4 ? DEMO_ORGANISER_ID : null,
      created_at: new Date().toISOString(),
    };
    state.helpRequests.unshift(req);
    saveState(state);
    return req;
  },

  updateSponsorStatus(id: string, status: "active" | "rejected") {
    const state = loadState();
    const sp = state.sponsors.find((s) => s.id === id);
    if (!sp) throw new Error("Sponsor not found.");
    sp.status = status;
    saveState(state);
    return sp;
  },

  requestSponsor(userId: string, name: string, tier: string, amount: number, contact?: string, message?: string): DemoSponsor {
    const resolvedUserId = resolveDemoUserId(userId);
    const state = loadState();
    const sp: DemoSponsor = {
      id: crypto.randomUUID(),
      user_id: resolvedUserId,
      name: name.trim(),
      tier,
      amount,
      contact: contact?.trim() || null,
      message: message?.trim() || null,
      status: "requested",
      created_at: new Date().toISOString(),
    };
    state.sponsors.unshift(sp);
    saveState(state);
    return sp;
  },
};
