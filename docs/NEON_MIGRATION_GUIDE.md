# Neon PostgreSQL Migration Guide — Rangora 2.0

This guide documents the architecture, schema mapping, migration execution steps, and server-mediated storage design for the **Rangora 2.0** application database migration from Lovable Cloud / Supabase PostgreSQL to **Neon PostgreSQL**.

---

## 1. Architectural Roles & Responsibilities

| Service | Primary Responsibility | Direct Browser Usage Permitted? |
| :--- | :--- | :--- |
| **Supabase Auth** | User authentication, identity registration, sign-in/sign-out, password reset, and session JWT issuance. | **Yes**: `supabase.auth.*` |
| **Supabase Storage** | Private Event Echo media, event posters, and festival banners. | **Yes**: `supabase.storage.*` (via server-signed URLs) |
| **Neon PostgreSQL** | Primary and exclusive source of truth for all application data: user profiles, roles, organiser applications, events, registrations, attendance check-ins, badges, leaderboard, vouchers, sponsors, and help requests. | **No**: Accessed strictly server-side via Drizzle ORM in TanStack Start server functions. |

---

## 2. Table & Entity Mapping (18 Tables)

| # | Supabase Table | Neon Table (Drizzle Schema) | Primary Key | Key Relationships / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `profiles` | `schema.profiles` | `id` (uuid) | Matches Supabase Auth user UUID. |
| 2 | `user_roles` | `schema.userRoles` | `id` (uuid) | `user_id` → `profiles.id` |
| 3 | `organiser_profiles` | `schema.organiserProfiles` | `user_id` (uuid) | `user_id` → `profiles.id` |
| 4 | `admin_profiles` | `schema.adminProfiles` | `user_id` (uuid) | `user_id` → `profiles.id` |
| 5 | `categories` | `schema.categories` | `id` (integer) | Seed catalogue of 8 festival categories. |
| 6 | `festivals` | `schema.festivals` | `id` (integer identity) | `created_by` → `profiles.id` |
| 7 | `events` | `schema.events` | `id` (integer identity) | `category_id` → `categories.id`, `festival_id` → `festivals.id`, `organiser_id` → `profiles.id` |
| 8 | `registrations` | `schema.registrations` | `id` (uuid) | `user_id` → `profiles.id`, `event_id` → `events.id` |
| 9 | `attendance` | `schema.attendance` | `id` (uuid) | `registration_id` → `registrations.id`, `event_id` → `events.id` |
| 10 | `achievements` | `schema.achievements` | `code` (text) | 13 system badge definitions. |
| 11 | `user_achievements` | `schema.userAchievements` | `(user_id, code)` | `user_id` → `profiles.id`, `code` → `achievements.code` |
| 12 | `event_badges` | `schema.eventBadges` | `id` (uuid) | `event_id` → `events.id` |
| 13 | `user_event_badges` | `schema.userEventBadges` | `(user_id, badge_id)`| `user_id` → `profiles.id`, `badge_id` → `event_badges.id` |
| 14 | `voucher_campaigns` | `schema.voucherCampaigns` | `id` (integer) | 5 default voucher campaigns. |
| 15 | `user_vouchers` | `schema.userVouchers` | `id` (uuid) | `user_id` → `profiles.id`, `campaign_id` → `voucher_campaigns.id` |
| 16 | `reviews` | `schema.reviews` | `id` (uuid) | `event_id` → `events.id`, `user_id` → `profiles.id` |
| 17 | `review_likes` | `schema.reviewLikes` | `(review_id, user_id)`| `review_id` → `reviews.id`, `user_id` → `profiles.id` |
| 18 | `sponsors` | `schema.sponsors` | `id` (uuid) | `user_id` → `profiles.id`, `requested_by` → `profiles.id` |
| 19 | `help_requests` | `schema.helpRequests` | `id` (uuid) | `user_id` → `profiles.id`, `event_id` → `events.id`, `routed_to` → `profiles.id` |
| 20 | `reward_awards` | `schema.rewardAwards` | `id` (uuid) | `user_id` → `profiles.id`, `awarded_by` → `profiles.id` |
| 21 | `leaderboard` | `schema.leaderboard` | `user_id` (uuid) | `user_id` → `profiles.id` |

---

## 3. Database Functions & Triggers

All required Postgres functions have been converted in [`drizzle/migrations/0007_neon_complete_schema_and_functions.sql`](file:///d:/Rangora%202.0/drizzle/migrations/0007_neon_complete_schema_and_functions.sql) so that they run natively in Neon without dependency on Supabase internal schemas (`auth.users`):

1. **`events_no_clash()` Trigger**:
   - Enforces `end_at > start_at`.
   - Prevents overlapping event schedules for the same organiser across venues using `tstzrange && tstzrange`.
2. **`registration_capacity_guard()` Trigger**:
   - Validates that an event is open and published.
   - Prevents overbooking by checking confirmed bookings against `max_seats` atomically.
3. **`sync_organiser_role_after_review()` Trigger**:
   - Automatically synchronizes `user_roles` whenever an administrator updates an organiser profile status to `'approved'` or removes it.
4. **`route_help_request_to_event_organiser()` Trigger**:
   - Dynamically inspects `events.organiser_id` to route event-specific help requests directly to the organizing team's inbox.
5. **`sync_leaderboard_profile()` Trigger**:
   - Syncs display names and department metadata to `leaderboard` whenever a participant updates their profile.

---

## 4. Required Environment Variables

Configure these variables in `.env` (never commit real credentials to version control):

```bash
# Neon Application Database (Pooled connection for server queries)
DATABASE_URL=postgres://[user]:[password]@[endpoint]-pooler.neon.tech/[dbname]?sslmode=require

# Neon Direct Connection (Unpooled for Drizzle Kit schema migrations)
DATABASE_URL_DIRECT=postgres://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require

# Neon Demo Branch Database (Isolated branch for the three-role demo workspace)
DATABASE_URL_DEMO=postgres://[user]:[password]@[demo-endpoint]-pooler.neon.tech/[dbname]?sslmode=require

# Supabase Auth & Storage
VITE_SUPABASE_URL=https://edqbwhbgmgnkkptkutma.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[publishable-key]
```

---

## 5. Migration Execution Steps for Shrijit / Payel

When you are ready to apply the schema and seed data to your Neon database:

1. **Apply Schema & Triggers**:
   Execute the migration script against Neon using your preferred SQL client (e.g. Neon Console SQL Editor, psql, or Drizzle Kit):
   ```bash
   npx drizzle-kit migrate
   # Or directly execute:
   # drizzle/migrations/0007_neon_complete_schema_and_functions.sql
   ```
2. **Apply Seed Catalogue Data**:
   Execute the seed migration containing all 8 categories, 6 festivals, 13 achievements, and 5 voucher campaigns:
   ```bash
   # Execute via Neon SQL Editor:
   # drizzle/migrations/0008_neon_seed_catalogue_data.sql
   ```
3. **Verify Row Counts**:
   Run the following verification queries in the Neon SQL Editor:
   ```sql
   SELECT count(*) FROM public.categories;          -- Expected: 8
   SELECT count(*) FROM public.festivals;           -- Expected: 6
   SELECT count(*) FROM public.achievements;        -- Expected: 13
   SELECT count(*) FROM public.voucher_campaigns;   -- Expected: 5
   ```
4. **Existing Source Backup**:
   The complete baseline snapshot of the Lovable Cloud / Supabase database is safely preserved in:
   [`backup/supabase_application_backup.json`](file:///d:/Rangora%202.0/backup/supabase_application_backup.json)

---

## 6. Server-Mediated Supabase Storage Architecture

Because application data resides in Neon while media binaries reside in Supabase Storage, Supabase Storage RLS policies cannot query application tables directly. 

The server-mediated flow ensures zero security compromises:
1. **Upload Initiation**:
   - Participant submits media metadata to the server function `submitEventReview`.
   - The server verifies user authentication and event attendance against Neon.
   - The server authorizes upload and generates a unique storage path: `${eventId}/${userId}/${uuid}-${filename}`.
2. **Download / Display**:
   - Public Event Pulse images/videos are served via signed URLs generated by the server.
   - Private media is accessible only after the server verifies that the requesting user is the author, the assigned event organiser, or an administrator.

