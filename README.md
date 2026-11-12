<div align="center">
  <img src="public/assets/events/rangora-crest.svg" alt="Rangora crest" width="96" />
  <h1>R A N G O R A</h1>
  <h3>✨ Find your kind of celebration. ✨</h3>
  <p><em>Discover events. Make a plan. Collect the memories.</em></p>
  <img src="public/assets/events/festival-concert.jpg" alt="A glimpse of the festival experience Rangora is built around" width="100%" />
  <br /><br />
  <img src="https://img.shields.io/badge/STATUS-Full--Stack%20Live-10b981?style=for-the-badge" alt="Full-Stack Live" />
  <img src="https://img.shields.io/badge/FRAMEWORK-TanStack%20Start-ff4154?style=for-the-badge&logo=react&logoColor=white" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/UI-React%2019-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/LANGUAGE-TypeScript%20Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/NEON%20POSTGRESQL-CONNECTED%20%26%20LIVE-00e599?style=for-the-badge&logo=postgresql&logoColor=black" alt="Neon PostgreSQL Live" />
  <img src="https://img.shields.io/badge/SUPABASE%20AUTH-CONNECTED%20%26%20LIVE-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase Auth Live" />
  <img src="https://img.shields.io/badge/DESIGN-Neo--Brutalist%20v4-f59e0b?style=for-the-badge&logo=tailwindcss&logoColor=black" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/AI%20CONCIERGE-Ollama%20%7C%20NVIDIA%20%7C%20Gemini-8b5cf6?style=for-the-badge" alt="AI Concierge" />
  <img src="https://img.shields.io/badge/TESTS-80%2B%20Passing-22c55e?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest Tests" />
</div>

---

> **Welcome to Rangora!** 🎪
>
> College life is more than lectures, assignments, and deadlines. It is midnight music jams, esports battlegrounds, hackathon sprints, classical raga concerts, pottery workshops, meeting new faces, and finding those unforgettable memories you almost missed. **Rangora is an all-in-one campus festival and event-management platform built to bring that electric campus energy into one unified, real-time experience.**
>
> **The Evolution of Rangora:** Rangora began as an academic Python/Flask prototype. Today, it has evolved into a production-grade, full-stack reactive platform powered by **TanStack Start (React 19 SSR)**, **Neon Serverless PostgreSQL (Drizzle ORM)**, **Supabase Auth & Multi-Role RBAC**, and an **Offline-Resilient Multi-Provider AI Concierge** (supporting free local Ollama models, NVIDIA NIM, Groq, and Google Gemini).
>
> Designed with a high-contrast **Neo-Brutalist** aesthetic, interactive physics-driven dot-field ambient canvas, ACID-safe pass bookings, real-time Seat Pulse indicators, automated Event Clash Guardian, collectible vector SVG badges, and community-driven Event Echo / Event Pulse feeds, Rangora is crafted to celebrate campus life at its fullest.

> [!IMPORTANT]
> ### 🐘 The Big Upgrade: Neon PostgreSQL & Cloud Services are LIVE!
> In our initial academic prototype, Neon PostgreSQL and Supabase were marked on GitHub as *“Not connected”* while running locally on a standalone SQLite file.
> 
> **That milestone has officially arrived:**
> - 🟢 **Neon Serverless PostgreSQL is Fully Connected & Live:** High-concurrency relational data engine with automated connection pooling and ACID row-level locking for seat reservations.
> - 🟢 **Drizzle ORM Type-Safe Architecture:** 17 production tables, foreign-key relationships, and the unified `v_event_directory` view.
> - 🟢 **Supabase Authentication & Multi-Role RBAC:** True identity verification separating Student Participants, Club Organizers, and Campus Administrators.
> - 🟢 **ACID Seat Pulse Engine:** Prevents duplicate bookings, double reservations, and race conditions during high-demand festival ticket rushes.

---

## 🚀 Get Rangora running in 3 steps

<table>
  <tr>
    <td align="center" width="33%"><h2>1️⃣</h2><b>Clone & Setup</b><br />Clone the repository or extract the project folder.</td>
    <td align="center" width="33%"><h2>2️⃣</h2><b>Launch</b><br />Double-click <code>run_rangora.bat</code> (or <code>run_localhost.bat</code>).</td>
    <td align="center" width="33%"><h2>3️⃣</h2><b>Explore</b><br />Open <code>http://localhost:8080</code> in your browser.</td>
  </tr>
</table>

**First launch?** The Windows launcher automatically verifies your Node.js runtime, installs dependencies via `npm install` if needed, initializes your `.env` configuration, boots the TanStack Start development server on port **8080**, and opens your browser automatically. Keep the terminal open while you explore; press **Ctrl + C** when you want to stop the server.

> 🧭 **Your Application Routes**
>
> | Route | Local URL | What you can explore |
> |---|---|---|
> | 🏠 **Home / Discovery** | `http://localhost:8080/` | Campus festival hub, major highlights, category chips, animated DotField, and curated event listings. |
> | 🔍 **Dedicated Search** | `http://localhost:8080/search` | Fast keyword search, category-based filtering, and interactive recent search tags. |
> | 🎪 **Event Details** | `http://localhost:8080/events/1` | Real-time Seat Pulse occupancy, invited artist & professor avatars, ACID seat reservations, and Event Echo reviews. |
> | 🔐 **Sign In & Sign Up** | `http://localhost:8080/auth` | Responsive Neo-Brutalist split-screen auth, student/organizer role switcher, password reveal, and institutional verification. |
> | 🎟️ **Role Dashboard** | `http://localhost:8080/dashboard` | Role-aware workspace: Participant Itinerary, Organizer Event Studio, and Admin Oversight Console. |
> | ⚡ **Event Pulse Gallery** | `http://localhost:8080/pulse` | Live community photo feed, attendee-verified ratings, reactions, and threaded discussions. |
> | 🧪 **Direct Demo Workspace** | `http://localhost:8080/demo` | Switch between Participant, Organizer, and Admin spaces instantly with atomic sample state and reset. |

### Prerequisites & Requirements

- **Node.js**: `v20.x` or `v24.x` (LTS recommended)
- **Package Manager**: `npm` (included with Node.js) or `bun` (`v1.2+`)
- **Operating System**: Windows 10/11 (for `.bat` launchers), macOS, or Linux
- **Modern Browser**: Chrome, Edge, Firefox, or Safari with WebGL / HTML5 Canvas enabled

<details>
  <summary><b>🛠️ Prefer starting manually with the CLI?</b></summary>

  Open your terminal inside the project directory:

  ```bash
  # 1. Install dependencies
  npm install

  # 2. Copy environment template
  cp .env.example .env

  # 3. Launch the development server
  npm run dev
  ```

  Using Bun? Simply run:
  ```bash
  bun install
  bun run dev
  ```
  The application will be accessible at `http://localhost:8080` (or `http://localhost:3000`).
</details>

---

## 🎭 Pick a role. Explore a different side of Rangora.

Rangora is architected around three campus personas, each with tailored tools, dedicated workspaces, and custom Neo-Brutalist design elements:

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>🎟️ Participant</h3>
      <p><b>Find your crowd. Make a plan. Collect memories.</b></p>
      <ul>
        <li><b>Festival Discovery & Search:</b> Dedicated <code>/search</code> page with category pills (Music, Tech, Gaming, Arts) and recent search history tags.</li>
        <li><b>Real-Time Seat Pulse:</b> Concurrency-safe capacity indicators (<code>Available</code>, <code>Filling Fast</code>, <code>Sold Out</code>) preventing overbooking.</li>
        <li><b>Automated Plan Rescue:</b> Active itinerary conflict guardian with styled caution banners that immediately detects overlapping events and offers one-click resolution.</li>
        <li><b>Digital Passport & SVG Badges:</b> 100% custom vector SVGs with 3D hover-tilt effects (strictly zero emojis) and verified attendance stamps.</li>
        <li><b>Vector Sponsor Vouchers:</b> Claim and redeem authentic Neo-Brutalist voucher tickets featuring live stock counters and SVG barcode cutouts.</li>
        <li><b>Event Echo & Event Pulse Feed:</b> Share photo memories, verified star ratings, and interact with reactions and comments on <code>/pulse</code>.</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>🎤 Organizer</h3>
      <p><b>Bring the campus festival to life.</b></p>
      <ul>
        <li><b>Event Studio:</b> Create and publish events with schedules, venues, ticket pricing, and registration ceilings.</li>
        <li><b>Artist, Guest & Faculty Lineup:</b> Feature invited keynote speakers, performers, and professors with dedicated avatar photos or dark-theme fallback vectors.</li>
        <li><b>Event Clash Guardian:</b> Automated scheduling guardian that checks for venue, date, and timing collisions before publishing.</li>
        <li><b>Fast Check-In Station:</b> Instant door-side ticket verification with real-time attendance stamping.</li>
        <li><b>Occupancy Analytics:</b> Monitor real-time seat bookings, attendance rates, and capacity limits.</li>
        <li><b>Event Echo Moderation:</b> Review attendee ratings, comments, and approved photo memories.</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>🛡️ Administrator</h3>
      <p><b>Maintain campus harmony and festival standards.</b></p>
      <ul>
        <li><b>Campus-Wide Oversight:</b> Unified view of cross-festival schedules, aggregated student registrations, and venue utilization.</li>
        <li><b>Clash Guardian Audit:</b> Inspect and resolve scheduling clashes occurring across all campus venues and events.</li>
        <li><b>Organizer Verification:</b> Review and approve campus club organizer applications with institutional domain checks.</li>
        <li><b>Voucher Stock & Campaign Management:</b> Allocate sponsor voucher pools, redemption quotas, and campaign limits.</li>
        <li><b>Public Event Pulse Moderation:</b> Maintain campus community standards and moderate shared photos/echoes.</li>
        <li><b>Database & Security Control:</b> Direct Neon PostgreSQL connection health checks, ACID audit trails, and RBAC policy enforcement.</li>
      </ul>
    </td>
  </tr>
</table>

### 🧪 1-Click Interactive Demo (Zero Credentials or Passwords Needed!)

In this modern release, **you do not need any emails or passwords to test all three roles!**

Simply open your browser and navigate to the dedicated **Interactive Demo Workspace**:
👉 **`http://localhost:8080/demo`**

The `/demo` workspace features an instant 1-click role switcher pill bar:
- `[🎟️ Participant Space]`
- `[🎤 Organizer Space]`
- `[🛡️ Administrator Space]`

Click any pill to instantly switch perspectives and test the full live functionality. The demo environment is backed by an in-memory transactional database with sample festivals, events, vouchers, and badges, complete with a 1-click **Reset Demo Data** button in the top toolbar.

> 💡 **Real Authenticated Accounts on `/auth`:**  
> If you wish to test real production authentication, visit `http://localhost:8080/auth`. Students can register as Participants, and club presidents can register as Campus Organizers with institutional email verification, all backed by Supabase Auth and Neon PostgreSQL.

---

## 🌟 The Rangora Signature Features

Rangora replaces static poster boards and chaotic group chats with intelligent, real-time campus tools:

| ✨ Feature | What makes it unique |
|---|---|
| **Seat Pulse** | High-concurrency seat reservation engine with real-time capacity states: `Available`, `Filling Fast`, `Selling Out`, and `Waitlist`. |
| **Event Clash Guardian** | Intelligent scheduling assistant that prevents organizers from booking overlapping venues and times across campus. |
| **Plan Rescue** | Automatic itinerary conflict detector that alerts participants when two selected events overlap, offering one-click resolution. |
| **Digital Passport & SVG Badges** | 100% bespoke SVG vector badges (no emojis!) awarded for milestones like *First Event*, *Tech Sprint*, and *Night Owl*. |
| **Event Echo & Event Pulse** | Community-powered memory board with attendee verification, photo galleries, star ratings, and threaded reactions. |
| **Multi-Provider AI Concierge** | Resilient campus assistant supporting free local **Ollama** LLMs, **NVIDIA NIM**, **Groq**, and **Google Gemini**, with a zero-token offline heuristic fallback. |
| **Interactive Canvas DotField** | Physics-driven dynamic canvas particle field that flows across the background and reacts fluidly to pointer movements. |
| **Neo-Brutalist Vector Vouchers** | Authentic campus discount tickets styled with crisp brutalist borders, SVG barcode artwork, and stock counters. |

---

## ⚡ Modern Full-Stack vs. Legacy Prototype

Rangora has made a generational leap from an early academic prototype to a modern full-stack web platform:

| Dimension | Legacy Prototype | Rangora 2.0 Modern Full-Stack |
|---|---|---|
| **Frontend Framework** | Plain HTML, CSS & Vanilla JS | **React 19 SSR** with **TanStack Start** & TanStack Router |
| **Type Safety** | None (Untyped Python / JS) | **100% Strict TypeScript** across client and server |
| **Database Architecture** | Local SQLite (`rangora_local.db`) | **Neon Serverless PostgreSQL** via **Drizzle ORM** |
| **Concurrency & ACID** | Single-file locks | **ACID-Compliant Row Locking** for ticket reservations |
| **Identity & Security** | Insecure session cookies | **Supabase Auth** with strict Role-Based Access Control (RBAC) |
| **AI Assistant** | Placeholder / mock responses | **Multi-Provider AI Engine** (Ollama / NVIDIA / Groq / Gemini) + Offline Heuristics |
| **Design System** | Basic styling with raw emojis | **Neo-Brutalist Design System**, Tailwind CSS v4, Lucide Vector SVGs |
| **Ambient Visuals** | Static images | **Physics-driven Canvas DotField** with dark/light theme adaptability |
| **Automated Testing** | 1 basic integration script | **80+ Unit & Integration Tests** running via Vitest |

---

## 🧭 What works in this download — and what to expect

| Area | Current Status | What that means for you |
|---|---|---|
| **Full-Stack Web Application** | 🟢 **Live & Operational** | TanStack Start (React 19 SSR) boots instantly via <code>run_rangora.bat</code> or <code>npm run dev</code> on port 8080. |
| **Neon Serverless PostgreSQL** | 🟢 **Live & Connected** | High-performance PostgreSQL database with 17 relational tables, ACID transactions, and the <code>v_event_directory</code> view. |
| **Supabase Auth & Multi-Role RBAC** | 🟢 **Live & Connected** | Real identity enforcement separating Student Participants, Club Organizers, and Campus Administrators. |
| **1-Click Interactive Demo** | 🟢 **Available on <code>/demo</code>** | Direct access to all three role spaces with zero passwords or emails required, plus 1-click state reset. |
| **Real User Authentication** | 🟢 **Available on <code>/auth</code>** | Neo-Brutalist split-screen auth with role selection (Student Participant vs Campus Club Organizer) and institutional email verification. |
| **Dedicated Search Experience** | 🟢 **Available on <code>/search</code>** | Live category chips (Music, Tech, Arts, Gaming) with instant search queries and clickable recent search history pills. |
| **Real-Time Seat Pulse** | 🟢 **Available & ACID-Protected** | High-concurrency seat indicators (<code>Available</code>, <code>Filling Fast</code>, <code>Sold Out</code>) preventing overbooking. |
| **Automated Event Clash Guardian** | 🟢 **Available Across All Roles** | Real-time scheduling conflict checks for organizers and automatic <b>Plan Rescue</b> for participants with caution banners. |
| **Digital Passport & SVG Badges** | 🟢 **Available & Collectible** | 100% bespoke SVG vector badges with 3D hover-tilt effects (strictly zero emojis) and verified attendance stamps. |
| **Community Event Echo & Pulse** | 🟢 **Available on <code>/pulse</code>** | Public community photo board, verified star ratings, reactions, and threaded conversations. |
| **Multi-Provider AI Concierge** | 🟢 **Available & Resilient** | Resilient campus assistant supporting free local Ollama LLMs, NVIDIA NIM, Groq, Gemini, or the built-in offline Heuristic Engine. |
| **Production Payment Gateways** | 🟡 **Simulated / Demo-Grade** | Real ACID ticket codes, QR tokens, and voucher discounts are generated without charging real financial credit cards. |

---

## 🧑‍💻 Database Architecture & Relational Schema

Rangora's database architecture runs on **PostgreSQL (Neon)** with **17 relational tables** and the unified `v_event_directory` view:

<details open>
  <summary><b>Show the Relational Database Map</b></summary>

  | Table Name | Description |
  |---|---|
  | `users` | Accounts, profiles, campus roles (`participant`, `organizer`, `admin`), and avatars. |
  | `festivals` | Campus festival umbrellas (e.g., *Technika 2026*, *Spring Symphony*, *Aura Fest*). |
  | `categories` | Categorization taxonomy (*Music*, *Technology*, *Fine Arts*, *Gaming*, *Dance*, *Literature*). |
  | `venues` | Physical campus locations, capacities, coordinates, and AV equipment status. |
  | `events` | Event schedules, pricing, seat allocations, guest avatars, and publication status. |
  | `registrations` | Participant bookings, ACID-generated ticket codes, QR tokens, and payment states. |
  | `sponsors` | Corporate and campus partners (*TechHub*, *SoundWave*, *DevPro*, *CampusBrew*). |
  | `sponsorships` | Tiered event partnerships, contribution sums, and branding agreements. |
  | `user_preferences` | Participant interest tags powering personalized recommendation feeds. |
  | `itinerary_items` | Participant schedule calendars checked automatically by **Plan Rescue**. |
  | `attendance_records` | Physical check-in timestamps, verification methods, and gatekeeper IDs. |
  | `event_feedback` | Star ratings, textual reviews, and attendee verified status. |
  | `achievement_passes` | Collectible credential definitions and digital passport entries. |
  | `achievements` | Milestone requirements (*Fest Explorer*, *Hackathon Legend*, *Culture Maven*). |
  | `participant_rewards`| Claimed rewards, point balances, and earned badge associations. |
  | `voucher_campaigns` | Active discounts, coupon pools, start/end dates, and budget caps. |
  | `issued_vouchers` | Unique voucher codes issued to participants with redemption timestamps. |

  **View:** `v_event_directory` aggregates real-time event details, venue capacities, booked counts, available seats, and organizer profiles into an indexed query view.
</details>

### 🧑‍💻 Want to run SQL? Query the live Neon PostgreSQL database!

Since Rangora has graduated from SQLite to **Neon Serverless PostgreSQL**, you no longer need DB Browser for SQLite or local `.db` files. You can query your live database through any of these 4 simple methods:

#### Method 1: The Neon Web SQL Editor (Zero Installation — Recommended)
1. Navigate to the Neon Console at **[console.neon.tech](https://console.neon.tech)** and open your project.
2. Click the **SQL Editor** tab in the left navigation sidebar.
3. Paste any of the SQL queries below into the editor and click **Run** (or press `Ctrl + Enter`).
4. Inspect live registrations, seat occupancies, and campus data in real time directly from your browser!

#### Method 2: Modern Database GUI Tools (DBeaver, TablePlus, pgAdmin, VS Code)
1. Open your database tool of choice (e.g., [DBeaver](https://dbeaver.io/), [TablePlus](https://tableplus.com/), or the VS Code PostgreSQL extension).
2. Create a new PostgreSQL connection.
3. Paste the `DATABASE_URL` connection string from your `.env` file (ensure SSL is enabled, `sslmode=require`).
4. Connect to browse tables, inspect constraints, and run visual schema diagrams.

#### Method 3: Command-Line `psql`
If you have the PostgreSQL command-line client installed:
```bash
psql "$DATABASE_URL"
```

#### Method 4: Automated Terminal SQL Inspection Suite
You can also run our automated Neon verification suite directly from your terminal with zero setup:
```bash
npm run test:integration:readonly
```
This executes live read-only assertions across all core tables in Neon PostgreSQL with zero risk of data mutation.

---

### Try these SQL Queries on Neon PostgreSQL

Inspect your live records, verify registrations, or audit conflicts with these standard queries:

```sql
-- 1. Check real-time seat availability across upcoming events (Seat Pulse)
SELECT 
    e.event_id,
    e.event_name,
    v.venue_name,
    e.max_seats,
    COUNT(r.registration_id) AS booked_seats,
    (e.max_seats - COUNT(r.registration_id)) AS available_seats,
    CASE 
        WHEN COUNT(r.registration_id) >= e.max_seats THEN 'SOLD OUT'
        WHEN COUNT(r.registration_id) >= e.max_seats * 0.85 THEN 'FILLING FAST'
        ELSE 'AVAILABLE'
    END AS seat_pulse_status
FROM events e
JOIN venues v ON v.venue_id = e.venue_id
LEFT JOIN registrations r ON r.event_id = e.event_id AND r.status = 'confirmed'
WHERE e.status = 'published'
GROUP BY e.event_id, e.event_name, v.venue_name, e.max_seats
ORDER BY booked_seats DESC;

-- 2. Detect overlapping venue schedules across campus (Event Clash Guardian)
SELECT 
    e1.event_name AS event_a,
    e2.event_name AS event_b,
    v.venue_name,
    e1.start_time,
    e1.end_time
FROM events e1
JOIN events e2 ON e1.venue_id = e2.venue_id AND e1.event_id < e2.event_id
JOIN venues v ON v.venue_id = e1.venue_id
WHERE (e1.start_time < e2.end_time AND e1.end_time > e2.start_time);

-- 3. Audit participant itinerary with verified attendance stamps (Digital Passport)
SELECT 
    u.full_name,
    e.event_name,
    r.ticket_code,
    ar.verified_at,
    CASE WHEN ar.attendance_id IS NOT NULL THEN 'STAMPED' ELSE 'PENDING' END AS passport_status
FROM registrations r
JOIN users u ON u.user_id = r.user_id
JOIN events e ON e.event_id = r.event_id
LEFT JOIN attendance_records ar ON ar.registration_id = r.registration_id
ORDER BY e.start_time;

-- 4. Check active sponsor voucher campaigns and claimed redemptions
SELECT 
    vc.title AS campaign_title,
    s.sponsor_name,
    vc.discount_amount,
    vc.total_vouchers,
    COUNT(iv.voucher_id) AS claimed_vouchers,
    (vc.total_vouchers - COUNT(iv.voucher_id)) AS remaining_stock
FROM voucher_campaigns vc
JOIN sponsors s ON s.sponsor_id = vc.sponsor_id
LEFT JOIN issued_vouchers iv ON iv.campaign_id = vc.campaign_id
GROUP BY vc.campaign_id, vc.title, s.sponsor_name, vc.discount_amount, vc.total_vouchers
ORDER BY remaining_stock ASC;
```

---

## 🧰 Built With

<div align="center">

| Layer | Technology | Role in Rangora |
|---|---|---|
| **Client UI** | React 19 · Vite | Ultra-fast client-side rendering with concurrent mode and seamless transitions. |
| **Server Engine** | TanStack Start · TanStack Router | Full-stack SSR, type-safe API routing, and private server function execution. |
| **Cloud Database** | Neon PostgreSQL · Drizzle ORM | Serverless PostgreSQL with connection pooling, transactional locking, and type-safe schemas. |
| **Auth & Security** | Supabase Auth · Postgres RBAC | Email verification, session persistence, and server-side authorization guards. |
| **Design System** | Tailwind CSS v4 · Lucide React | High-contrast Neo-Brutalist borders, warm festival palettes, and 100% vector SVG icons. |
| **AI Concierge** | Ollama · NVIDIA NIM · Gemini · Heuristic Engine | Multi-model intelligent assistant capable of running 100% free locally or in the cloud. |
| **Ambient Visuals** | HTML5 Canvas · WebGL Physics | Smooth, frame-budgeted particle DotField with theme-aware colors and pointer repulsion. |
| **Test Suite** | Vitest · Testing Library | Comprehensive unit tests, route integration checks, and chatbot resilience test runners. |

</div>

---

## 📁 Project Directory Map

```text
Rangora/
├── public/
│   ├── assets/
│   │   ├── events/                   # Festival imagery, stage banners & rangora-crest.svg
│   │   └── echoes/                   # Community event echo showcase graphics
│   ├── favicon.svg                   # Vector favicon
│   └── robots.txt
├── src/
│   ├── components/                   # Neo-Brutalist component library
│   │   ├── dashboard/
│   │   │   └── RoleSpaces.tsx        # Participant, Organizer & Admin role workspaces
│   │   ├── SiteHeader.tsx            # Navigation, search shortcut, theme toggle & auth buttons
│   │   ├── SiteFooter.tsx            # High-contrast accessible footer with quick links
│   │   ├── DotField.tsx              # Interactive canvas particle physics background
│   │   ├── EventCard.tsx             # Neo-Brutalist festival event showcase card
│   │   ├── BadgeSvg.tsx              # Bespoke vector SVG collectible badge artwork
│   │   ├── VoucherSvgTicket.tsx      # Neo-Brutalist vector coupon with SVG barcode
│   │   ├── EventPulseGallery.tsx     # Community photo gallery, star ratings & reviews
│   │   ├── Chatbot.tsx               # Floating AI concierge modal
│   │   └── Faqs.tsx                  # Collapsible FAQ accordion
│   ├── lib/
│   │   ├── chat.server.ts            # Multi-provider AI router (Ollama / NVIDIA / Gemini / Heuristic)
│   │   ├── demo-db.ts                # In-memory transactional ACID demo store
│   │   ├── demo-repository.ts        # Seed data and demo state management
│   │   ├── role-rules.ts             # Strict RBAC permission verification
│   │   ├── event-conflicts.ts        # Event Clash Guardian & Plan Rescue conflict engine
│   │   ├── badge-designer.ts         # SVG badge rendering algorithms
│   │   └── supabase.ts               # Supabase authentication integration
│   ├── routes/                       # File-based TanStack Start application routes
│   │   ├── index.tsx                 # Campus festival discovery landing page
│   │   ├── auth.tsx                  # Neo-Brutalist split-screen sign in / sign up
│   │   ├── search.tsx                # Dedicated search experience with category chips
│   │   ├── pulse.tsx                 # Community Event Pulse & live memory feed
│   │   ├── demo.tsx                  # 1-Click switchable 3-role demo workspace
│   │   ├── events.$eventId.tsx       # Dynamic event details, Seat Pulse & guest avatars
│   │   └── _authenticated/
│   │       └── dashboard.tsx         # Real authenticated user role dashboard
│   └── test/                         # 80+ Vitest unit and integration suites
├── drizzle/                          # Neon PostgreSQL database migrations & schema
│   ├── schema.ts                     # Relational table definitions & foreign key constraints
│   └── migrations/                   # Applied migration history
├── run_rangora.bat                   # 1-Click Windows development launcher
├── run_localhost.bat                 # Backward-compatible batch launcher
├── package.json                      # Project dependencies and script runner commands
├── tsconfig.json                     # Strict TypeScript compiler options
├── vite.config.ts                    # TanStack Start and Vite bundler configuration
└── README.md                         # You are here
```

---

## 🧪 Testing & Verification

Rangora includes comprehensive test suites covering server functions, database queries, ACID seat allocations, and the multi-provider AI concierge:

```bash
# Run the core unit and component test suite
npm run test:unit

# Run full test suite (80+ assertions)
npm test

# Verify chatbot resilience (Ollama, NVIDIA, Gemini, and Offline Heuristic)
npx vitest run src/test/gemini-chatbot.test.ts

# Run live read-only verification queries against Neon PostgreSQL
npm run test:integration:readonly

# Run strict TypeScript type-checking
npx tsc --noEmit

# Test production SSR build
npm run build
```

---

## 🩹 Quick Fixes & Troubleshooting

<details>
  <summary><b>Node.js was not detected</b></summary>

  Install **Node.js v20+ or v24+** from [nodejs.org](https://nodejs.org/). During installation on Windows, ensure **"Add to PATH"** is selected. After installing, close your terminal and run `run_rangora.bat` again.
</details>

<details>
  <summary><b>The browser says it cannot connect</b></summary>

  Keep your terminal window open and allow Vite / TanStack Start a few seconds to compile on port 8080. Once you see `ready in ... ms`, refresh `http://localhost:8080`.
</details>

<details>
  <summary><b>Port 8080 or 3000 is already in use</b></summary>

  If another local service is using port 8080, stop that service or launch Vite on an alternative port:
  ```bash
  npm run dev -- --port 3001
  ```
</details>

<details>
  <summary><b>How do I access the 3 roles without passwords or emails?</b></summary>

  You do **not** need to type any email or password! Simply go to **`http://localhost:8080/demo`**. Click any role button in the switcher pill bar (`[🎟️ Participant Space]`, `[🎤 Organizer Space]`, `[🛡️ Administrator Space]`) to instantly jump between roles with pre-seeded sample data.
</details>

<details>
  <summary><b>Connecting to Neon PostgreSQL</b></summary>

  Rangora reads your database credentials from the `DATABASE_URL` environment variable in `.env`. Ensure your connection string includes SSL:
  ```env
  DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```
  If you are offline or testing locally, the **`/demo`** workspace automatically runs with an in-memory transactional database so you can test all features without internet access!
</details>

<details>
  <summary><b>How do I use the free local Ollama AI Chatbot?</b></summary>

  1. Download and install Ollama from [ollama.com](https://ollama.com/).
  2. Pull any model (for example: `ollama run llama3.2` or `ollama run mistral`).
  3. In your `.env` file, set:
     ```env
     OLLAMA_ENABLED=true
     OLLAMA_MODEL=llama3.2
     OLLAMA_HOST=http://127.0.0.1:11434
     ```
  4. Launch Rangora! The campus concierge will communicate directly with your local GPU/CPU with zero external API fees.
  5. *No Ollama installed?* Rangora automatically falls back to its built-in **Campus Concierge Heuristic Engine**, answering event, venue, and ticketing questions completely offline with zero tokens.
</details>

<details>
  <summary><b>How do I reset demo test data?</b></summary>

  Navigate to `http://localhost:8080/demo` and click the **"Reset Demo Data"** button in the header toolbar. This restores all sample events, registrations, and itinerary items to their pristine initial state instantly.
</details>

<details>
  <summary><b>How do I use the free local Ollama AI Chatbot?</b></summary>

  1. Download and install Ollama from [ollama.com](https://ollama.com/).
  2. Pull any model (for example: `ollama run llama3.2` or `ollama run mistral`).
  3. In your `.env` file, set:
     ```env
     OLLAMA_ENABLED=true
     OLLAMA_MODEL=llama3.2
     OLLAMA_HOST=http://127.0.0.1:11434
     ```
  4. Launch Rangora! The campus concierge will communicate directly with your local GPU/CPU with zero external API fees.
  5. *No Ollama installed?* Rangora automatically falls back to its built-in **Campus Concierge Heuristic Engine**, answering event, venue, and ticketing questions completely offline.
</details>

<details>
  <summary><b>How do I reset demo test data?</b></summary>

  Navigate to `http://localhost:8080/demo` and click the **"Reset Demo Data"** button in the header toolbar. This restores all sample events, registrations, and itinerary items to their pristine initial state instantly.
</details>

---

## 🔐 Security & Production Integrity

- **Credentials Safety:** Public demo credentials are intended solely for local testing and evaluation. Never commit real private keys or passwords to version control.
- **Environment Isolation:** Use `.env.example` as your template. Your private `.env` file containing sensitive connection strings is strictly excluded by `.gitignore`.
- **Server-Side Enforcement:** Account permissions and roles are enforced server-side via TanStack Start server functions and database policies. Client-side browser state is never trusted for authorization decisions.

---

## 🎭 The People Behind Rangora

> Great celebrations are created by great teams. Rangora is built through shared ideas, late-night hackathons, endless creativity, collaboration, and plenty of debugging! 💜

### ✨ Project Creator & Developer

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/INSANE0PAPA">
        <img src="https://github.com/INSANE0PAPA.png" width="100px;" alt="Shrijit Mukherjee's GitHub avatar"/>
        <br />
        <sub><b>Shrijit Mukherjee</b></sub>
      </a>
      <br />
      <sub>Project Creator & Full-Stack Developer</sub>
      <br />
      <a href="https://github.com/INSANE0PAPA">@INSANE0PAPA</a>
    </td>
  </tr>
</table>

### 🤝 Team Members

A big shout-out to the teammates who contributed their passion, ideas, and dedication to the Rangora journey!

<table>
  <tr>
    <td align="center" width="25%">
      <strong>Arin Aditya</strong>
    </td>
    <td align="center" width="25%">
      <strong>Sovan Sar</strong>
    </td>
    <td align="center" width="25%">
      <strong>Soumyadeep Pal</strong>
    </td>
    <td align="center" width="25%">
      <strong>Payel Das</strong>
    </td>
  </tr>
</table>

### 💜 Built Together, Improved Together

Rangora continues to evolve as an open, high-energy campus celebration platform. Every commit, architectural refinement, and user journey optimization brings us closer to making festival organization effortless.

**Our Goal:** Make discovering events, connecting with friends, and planning campus celebrations feel thrilling, seamless, and deeply personal.

*To every person who shared an idea, tested a workflow, reported a bug, or cheered us on — thank you!* 🎉

---

<div align="center">
  <h3>🎉 Find your crowd. Make a plan. Collect a memory.</h3>
  <p><b>Rangora — Find your kind of celebration.</b></p>
  <sub>Crafted with passion for campus communities worldwide.</sub>
</div>
