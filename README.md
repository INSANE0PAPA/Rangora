# Rangora — Find your kind of celebration.

**Rangora** is a contemporary campus festival and event discovery, registration, and management platform built for college cultural celebrations, music performances, craft workshops, technical hackathons, sports tournaments, startup pitch arenas, and community gatherings.

Designed with an editorial lifestyle aesthetic (warm ivory, deep aubergine, terracotta, saffron, and muted sage) and BookMyShow / District-style navigation, Rangora pairs an inviting event-browsing experience with a **17-table relational database architecture** and a transaction-safe **Flask backend** in [`backend.py`](file:///d:/rangora/backend.py).

---

## 1. Quick Start

### Prerequisites
- Python 3.10+
- (Optional) Neon PostgreSQL connection URL
- (Optional) Supabase Storage credentials for event poster uploads

### Option A: 1-Click Launch (Recommended)
- **Windows**: Double-click [`run_localhost.bat`](file:///d:/rangora/run_localhost.bat) (or run `run_localhost.bat` in CMD/PowerShell). It automatically creates `.venv`, installs requirements, starts the server, and opens your browser to `http://127.0.0.1:5000`.
- **macOS / Linux**: Run `./run_localhost.sh`.

### Option B: Manual Setup
```bash
# 1. Clone / enter workspace
cd rangora

# 2. Configure environment
copy .env.example .env   # On macOS/Linux: cp .env.example .env

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
python backend.py
```
Then open **`http://127.0.0.1:5000`** in your browser.

---

## 2. Database Configuration: Neon PostgreSQL & SQLite Fallback

Rangora natively connects to **Neon PostgreSQL** whenever `DATABASE_URL` is configured in your `.env` file or environment variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-your-project.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

- **When `DATABASE_URL` is set**: Rangora executes against your live Neon PostgreSQL cluster using `psycopg` (v3).
- **When `DATABASE_URL` is blank**: Rangora automatically activates its prominent **Local SQLite Fallback (`rangora_local.db`)** so you can develop, demo, and test completely offline without needing external cloud credentials.
- **Authoritative Reference Schema**: The 17-table schema and `v_event_directory` view are defined in [`schema.sql`](file:///d:/rangora/schema.sql) and dynamically loaded by [`backend.py`](file:///d:/rangora/backend.py) to guarantee zero schema divergence.

### Startup Output
At startup, `backend.py` prints an unmistakable banner showing the active engine:
```text
==============================================================================
  RANGORA — Campus Festival Platform & Relational Discovery Engine
==============================================================================
  * ACTIVE DATABASE:  NEON POSTGRESQL (LIVE CLOUD CLUSTER)
    Target Storage:   ep-your-project.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
  * DEMO ROLE SWITCH: ENABLED (1-click viva role switching active)
  * MEDIA STORAGE:    OPTIONAL / NOT CONFIGURED (Bundled images active)
  * REFERENCE SCHEMA: schema.sql
==============================================================================
```

---

## 3. The Three Core Interfaces

Rangora is organized strictly around three genuine interface types:

1. **Landing Page (`/`)**:
   - **Interactive Bubbly Hero**: Translucent, iridescent bubbles emerge near the cursor in the hero section, drift upward, gently pop or fade away naturally, and never block clicks or search (`pointer-events: none`). Features pointer throttling, mobile touch support, and graceful `prefers-reduced-motion` handling.
   - **No Decorative Emojis**: Replaced generic emoji substitutions with bespoke vector SVGs and authentic festival photography across all category chips, cards, stamps, and badges.
   - **Substantially Expanded Catalogue**: 6 distinct demo festivals and 40 events across 8 categories (Music, Cultural, Technical, Workshops, Gaming, Community, Sports, Entrepreneurship) with balanced availability (free/paid, open, nearing capacity, sold out).
   - Dynamic user avatar in header reflects authentication state; clicking routes to `/auth` (when logged out) or `/dashboard` (when logged in).

2. **Combined Authentication Page (`/auth`)**:
   - Verified **Email & Password** login and registration secured by `PBKDF2-HMAC-SHA256` password hashing.
   - Includes password visibility toggle and direct links back to `/`.
   - When `ENABLE_LOCAL_DEMO_MODE=true` is set, provides 1-click evaluation buttons for testing **Participant**, **Organizer**, and **Administrator** accounts.
   - Outside local demonstration mode, `/api/auth/switch-role` is restricted (returns `403 Forbidden`).

3. **Role-Aware Dashboard (`/dashboard`)**:
   - **Participant View**:
     - *Overview*: Quick stats and upcoming bookings.
     - *Discover Events*: Live directory with category filters and search.
     - *My Registrations*: Interactive tickets with unique alphanumeric pass codes.
     - *My Plan*: Visual itinerary builder with conflict detection.
     - *Festival DNA*: Cultural persona derived from attendance patterns.
     - *My Rewards & Passport*: Earned badges with dedicated artwork, door check-in stamps, progress towards achievements, issued vouchers with 1-click redemption, and personal leaderboard standing.
     - *Leaderboard*: Competitive campus standings with category filters and transparent scoring.
     - *Profile*: Preference chips and avatar customization.
   - **Organizer View**:
     - *Overview*: Real-time ticket sales and capacity gauges.
     - *My Events*: Status management and attendance verification roster.
     - *Create Event*: Pre-flight collision checker with optional poster upload.
     - *Achievement Pass Builder*: Optional custom festival or event passes with configurable conditions (`attend_single_event`, `attend_n_festival_events`, `attend_category_events`, `milestone_checkins`), artwork picker, and draft/active toggle.
     - *Reward Performance*: Participant earner counts and voucher attachment stats scoped to authorized events.
     - *No-Clash Guardian*: Venue overlap and capacity validation.
     - *Event Echo*: Verified participant sentiment and ratings recap.
   - **Administrator View**:
     - *Overview*: Campus-wide registration volume and system telemetry.
     - *Users & Roles*: Role assignments and user directory.
     - *Festivals & Events*: Global event moderation.
     - *Venues & Categories*: Campus venue capacities and category styling.
     - *Sponsors*: Corporate partners and sponsorship allocations.
     - *Rewards & Vouchers*: Central voucher campaign management (50%, 30%, 20%, free workshop, free merch, VIP access), inventory tracking, direct issuance, and live distribution/redemption rates computed from real DB records.
     - *Leaderboard*: Global rankings across all academic disciplines.
     - *Reports*: Auditable check-in logs and attendance metrics.

---

## 4. Rewards, Vouchers & Leaderboard Mechanics

### Festival DNA & Rewards Passport
- **True Record Derivation**: Badges and stamps are awarded exclusively from verified database records (e.g. `attendance_records`, confirmed `registrations`, and `event_feedback`). Reloading the page evaluates idempotently and never duplicates awards.
- **Dedicated Vector Artwork**: 17 original SVG artwork files in `/static/images/badges/` for badges (`badge_first_experience.svg`, `badge_tech_trailblazer.svg`, etc.), door check-in stamps (`stamp_verified_attendance.svg`), and voucher perks.

### Organizer Achievement Pass Builder
- **Optional Pass Model**: Organizers can choose to create custom passes for their events or leave them pass-free.
- **Strict Authorization**: Organizers can only manage passes associated with events or festivals they own; unauthorized cross-organizer modifications return `403 Forbidden`.
- **Condition Validation**: Safe, predefined conditions prevent code execution:
  - `attend_single_event`: Verified check-in at a specific event.
  - `attend_n_festival_events`: Verified attendance at N events within a festival.
  - `attend_category_events`: Cross-disciplinary participation in designated disciplines.
  - `milestone_checkins`: Platform-wide cumulative check-in milestones.

### Admin Voucher Campaigns & Distribution
- **Central Control**: Only administrators can create campaigns and define inventory (`total_quantity`), discount percentages, and validity dates.
- **Strict Inventory Enforcement**: Vouchers cannot be issued once `total_quantity` is exhausted; surplus issuance attempts return `400 Bad Request`.
- **Single Redemption Rule**: Each issued voucher can be redeemed at most once via `POST /api/vouchers/<id>/redeem`. Subsequent attempts are rejected with `400 Bad Request`.
- **Recipient Privacy**: Participants only see their own issued vouchers. Other users' vouchers are strictly filtered out in `GET /api/participant/rewards`.

### Participant Leaderboard Scoring
- **Transparent Formula**:
  - `+50 points` per organizer-verified door check-in
  - `+30 points` per earned achievement badge
  - `+20 points` per confirmed registration
  - `+10 points` per submitted event feedback
- **Privacy Guaranteed**: Participant emails and phone numbers are never exposed in public leaderboard endpoints.
- **Filtering**: Supports overall rankings as well as category-specific and festival-specific views.

---

## 5. Database Schema (17 Relational Tables)

The authoritative schema in [`schema.sql`](file:///d:/rangora/schema.sql) contains:

1. `users` — Participants, organizers, and admins with PBKDF2 password hashes and RBAC roles.
2. `festivals` — Multi-day celebrations with date checks and budget tracking.
3. `categories` — 8 distinct event disciplines with accent colors and slugs.
4. `venues` — Campus physical spaces with authoritative seating capacities (3NF).
5. `events` — Scheduled activities with timestamps, ticket prices, and seat limits.
6. `registrations` — Bridge table resolving M:N user-event bookings with unique ticket codes.
7. `sponsors` — Partner organizations and collegiate brands.
8. `sponsorships` — Festival sponsorship tiers and contributed amounts.
9. `user_preferences` — Saved participant interests and preferred disciplines.
10. `itinerary_items` — Personal schedule entries with notes.
11. `attendance_records` — Door check-ins verified by authorized organizers.
12. `event_feedback` — 1-to-5 star ratings and written reviews.
13. `voucher_campaigns` — Admin-defined reward campaigns with inventory bounds.
14. `achievement_passes` — Organizer-created optional passes for specific events/festivals.
15. `achievements` — Specific award definitions with badge artwork and criteria.
16. `participant_rewards` — Bridge table tracking user-earned badges and achievements.
17. `issued_vouchers` — Unique voucher instances with single-use redemption tracking.
- `v_event_directory` — Relational SQL view joining events, venues, confirmed bookings, and live available seats.

---

## 6. Automated Testing & Verification

Run the full end-to-end integration test suite:
```bash
python test_journey.py
```

The test suite contains **22 comprehensive tests**, verifying:
1. All 17 tables and `v_event_directory` view exist in the database.
2. Landing page and `/api/events` live data fetch (Seat Pulse, Beyond the Hype).
3. Participant signup, password hashing (PBKDF2), DB persistence, and login session.
4. Security hardening (mock OAuth and unverified OTP rejected with 400).
5. Role switching restrictions (`403 Forbidden` outside demo mode).
6. ACID event registration (ticket generation, seat decrement).
7. Duplicate registration prevention (`409 Conflict`).
8. Registration cancellation and seat replenishment.
9. Participant preferences, DNA persona derivation, and Passport stamps.
10. Organizer No-Clash Guardian schedule conflict prevention and event creation.
11. Media upload endpoint `/api/media/upload`.
12. Admin festival and venue creation in real DB tables.
13. Hero bubble layer confinement, non-blocking click behavior (`pointer-events: none`), and reduced motion fallback.
14. Expanded catalogue verification (6+ festivals, 8 categories, 40 events).
15. Participant rewards API and idempotent award evaluation (no duplicates).
16. Door check-in attendance verification creating real DB records.
17. Organizer Achievement Pass Builder scoping and 403 prevention for unauthorized edits.
18. Admin voucher campaign creation and numerical range validation.
19. Voucher inventory limit enforcement and recipient privacy protection.
20. Single-use voucher redemption and double-redemption prevention.
21. Transparent leaderboard score calculation and privacy protection (no leaked emails/phones).
22. Consistency of admin voucher distribution metrics with underlying database rows.

All 22 tests pass cleanly against the database.
