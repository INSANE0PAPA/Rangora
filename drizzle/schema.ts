import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  uuid,
  pgEnum,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. App Roles Enum
export const appRoleEnum = pgEnum("app_role", ["participant", "organizer", "admin"]);

// 2. Profiles (stores participant/user information keyed by Supabase Auth UUID)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // Matches auth.users.id
  fullName: text("full_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  department: text("department"),
  course: text("course"),
  preferences: text("preferences").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. User Roles
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    role: appRoleEnum("role").notNull(),
  },
  (table) => [
    unique("user_roles_user_id_role_unique").on(table.userId, table.role),
  ]
);

// 4. Organiser Profiles
export const organiserProfiles = pgTable("organiser_profiles", {
  userId: uuid("user_id").primaryKey(),
  orgName: text("org_name").notNull().default(""),
  position: text("position").notNull().default(""),
  orgType: text("org_type").notNull().default(""),
  institutionalId: text("institutional_id"),
  description: text("description"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5. Admin Profiles
export const adminProfiles = pgTable("admin_profiles", {
  userId: uuid("user_id").primaryKey(),
  office: text("office").notNull().default(""),
  designation: text("designation").notNull().default(""),
  staffId: text("staff_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 6. Categories
export const categories = pgTable("categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description").notNull().default(""),
  accent: text("accent").notNull().default(""),
});

// 7. Festivals
export const festivals = pgTable("festivals", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 100 }),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  theme: text("theme").notNull().default(""),
  description: text("description").notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  banner: text("banner").notNull().default("hero_festival.jpg"),
  createdBy: uuid("created_by"),
});

// 8. Events
export const events = pgTable("events", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 1000 }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  festivalId: integer("festival_id").references(() => festivals.id),
  organiserId: uuid("organiser_id"),
  name: text("name").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  venue: text("venue").notNull().default(""),
  startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull().defaultNow(),
  price: integer("price").notNull().default(0),
  maxSeats: integer("max_seats").notNull().default(50),
  poster: text("poster").notNull().default("hero_festival.jpg"),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(true),
  artists: jsonb("artists").notNull().default([]),
  terms: text("terms").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 9. Registrations (Booked & Planned passes)
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    kind: text("kind").notNull().default("booked"), // 'booked' | 'planned'
    passCode: text("pass_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("registrations_user_id_event_id_unique").on(table.userId, table.eventId),
  ]
);

// 10. Attendance (Check-in verification records)
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id").references(() => registrations.id),
    userId: uuid("user_id").notNull(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedBy: uuid("verified_by"),
  },
  (table) => [
    unique("attendance_user_id_event_id_unique").on(table.userId, table.eventId),
  ]
);

// 11. Achievements (Platform-wide badges)
export const achievements = pgTable("achievements", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  criteria: text("criteria").notNull().default(""),
  artwork: text("artwork").notNull().default(""),
  kind: text("kind").notNull().default("badge"),
  points: integer("points").notNull().default(0),
});

// 12. User Achievements
export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id").notNull(),
    code: text("code")
      .notNull()
      .references(() => achievements.code),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.code] }),
  ]
);

// 13. Event Badges (Organiser-created badges)
export const eventBadges = pgTable("event_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("✦"),
  points: integer("points").notNull().default(20),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 14. User Event Badges
export const userEventBadges = pgTable(
  "user_event_badges",
  {
    userId: uuid("user_id").notNull(),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => eventBadges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.badgeId] }),
  ]
);

// 15. Voucher Campaigns
export const voucherCampaigns = pgTable("voucher_campaigns", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default(""),
  pct: integer("pct").notNull().default(0),
  description: text("description").notNull().default(""),
  validUntil: date("valid_until"),
  stock: integer("stock").notNull().default(200),
});

// 16. User Vouchers
export const userVouchers = pgTable(
  "user_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => voucherCampaigns.id),
    code: text("code").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("user_vouchers_user_id_campaign_id_unique").on(table.userId, table.campaignId),
  ]
);

// 17. Reviews / Event Echoes
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    media: jsonb("media").notNull().default([]),
    taggedFriends: text("tagged_friends").array().notNull().default([]),
    likedByOrganiser: boolean("liked_by_organiser").notNull().default(false),
    visibility: text("visibility").notNull().default("private"), // 'private' | 'campus' | 'public' (requires explicit consent for public)
    moderationStatus: text("moderation_status").notNull().default("approved"), // 'approved' | 'flagged' | 'hidden'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("reviews_event_id_user_id_unique").on(table.eventId, table.userId),
  ]
);

// 18. Review Likes
export const reviewLikes = pgTable(
  "review_likes",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.userId] }),
  ]
);

// 19. Sponsors
export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("Silver"),
  contact: text("contact"),
  contactEmail: text("contact_email"),
  amount: numeric("amount").notNull().default("0"),
  message: text("message"),
  requestedBy: uuid("requested_by"),
  status: text("status").notNull().default("requested"), // 'requested' | 'approved' | 'rejected' | 'active'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 20. Help Requests
export const helpRequests = pgTable("help_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  eventId: integer("event_id").references(() => events.id),
  category: text("category").notNull().default("general"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  authorName: text("author_name").notNull().default(""),
  status: text("status").notNull().default("open"), // 'open' | 'routed' | 'resolved'
  answer: text("answer"),
  routedTo: uuid("routed_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 21. Reward Awards
export const rewardAwards = pgTable("reward_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  displayName: text("display_name").notNull().default(""),
  description: text("description").notNull().default(""),
  note: text("note").notNull().default(""),
  points: integer("points").notNull().default(0),
  awardedBy: uuid("awarded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 22. Leaderboard
export const leaderboard = pgTable("leaderboard", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  department: text("department"),
  points: integer("points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Table Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  category: one(categories, {
    fields: [events.categoryId],
    references: [categories.id],
  }),
  festival: one(festivals, {
    fields: [events.festivalId],
    references: [festivals.id],
  }),
  registrations: many(registrations),
  reviews: many(reviews),
  badges: many(eventBadges),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  event: one(events, {
    fields: [registrations.eventId],
    references: [events.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  event: one(events, {
    fields: [reviews.eventId],
    references: [events.id],
  }),
  likes: many(reviewLikes),
}));
