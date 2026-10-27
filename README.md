<div align="center">
  <img src="static/icons/rangora-crest.svg" alt="Rangora crest" width="88" />
  <h1>R A N G O R A</h1>
  <h3>✨ Find your kind of celebration. ✨</h3>
  <p><em>Discover events. Make a plan. Collect the memories.</em></p>
  <img src="static/images/hero_festival.jpg" alt="A glimpse of the festival experience Rangora is built around" width="100%" />
  <br />
  <img src="https://img.shields.io/badge/STATUS-Active%20Development-f59e0b?style=for-the-badge" alt="Active development" />
  <img src="https://img.shields.io/badge/PYTHON-Flask-2563eb?style=for-the-badge&logo=python&logoColor=white" alt="Python and Flask" />
  <img src="https://img.shields.io/badge/CURRENT%20DATABASE-SQLite-0f766e?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/NEON-Not%20connected-6b7280?style=for-the-badge" alt="Neon not connected" />
  <img src="https://img.shields.io/badge/SUPABASE-Not%20connected-6b7280?style=for-the-badge" alt="Supabase not connected" />
</div>

---

> **Welcome to Rangora!** 🎪
>
> College life is more than lectures and deadlines. It is music nights, gaming battles, cultural shows, workshops, new friends, and those events you almost missed. **Rangora is a festival and event-management website prototype designed to bring that campus energy into one place.**
>
> **A quick reality check:** Rangora is still being built. This version runs locally with sample data and **SQLite**. Some screens and actions are demos or works in progress. **Neon PostgreSQL and Supabase are not connected in this download.** This README tells you what you can try today and what is still on the roadmap.

## 🚀 Get Rangora running in 3 steps

<table>
  <tr>
    <td align="center" width="33%"><h2>1️⃣</h2><b>Extract</b><br />Unzip the project into a normal folder.</td>
    <td align="center" width="33%"><h2>2️⃣</h2><b>Launch</b><br />Double-click <code>run_localhost.bat</code>.</td>
    <td align="center" width="33%"><h2>3️⃣</h2><b>Explore</b><br />Open <code>http://127.0.0.1:5000</code>.</td>
  </tr>
</table>

**First launch?** Rangora checks for Python, creates a local virtual environment, installs the packages it needs, and opens your browser. Package installation may need an internet connection. Keep the terminal window open while you use the site; press **Ctrl + C** in that window when you want to stop the server.

> 🧭 **Your local routes**
>
> | Page | URL | What it is for |
> |---|---|---|
> | 🏠 Home | `http://127.0.0.1:5000/` | Explore the Rangora experience and browse events. |
> | 🔐 Login / Sign up | `http://127.0.0.1:5000/auth` | Try local account access and demo sign-in options. |
> | 🎟️ Dashboard | `http://127.0.0.1:5000/dashboard` | Explore the dashboard for the current role. |

### Before you launch

- Use **Windows 10 or later** for the `.bat` instructions below.
- Install **Python 3.10 or newer**. During installation, select **Add Python to PATH** if that option appears.
- Extract the ZIP before running the BAT file. Do not launch it from inside the ZIP preview.
- If the browser opens before the server is ready, wait for the terminal message and refresh the page.

<details>
  <summary><b>🛠️ Prefer starting it manually?</b></summary>

  From the Rangora project folder, run:

  ```bat
  .venv\Scripts\python.exe backend.py
  ```

  Run `run_localhost.bat` first if the virtual environment or required packages have not been created yet. A `run_localhost.sh` script is also included for macOS/Linux users, but the one-click steps in this guide target Windows.
</details>

---

## 🎭 Pick a role. Explore a different side of Rangora.

Rangora is designed around three kinds of users. The interface and workflows are being developed together, so think of these as **prototype journeys**—not every action is complete or production-ready yet.

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>🎟️ Participant</h3>
      <p><b>Find something worth showing up for.</b></p>
      <ul>
        <li>Browse sample events and categories.</li>
        <li>Explore event descriptions, schedules, venues, prices, and seat indicators where shown.</li>
        <li>Try registration and ticket-related flows where available.</li>
        <li>Explore personal interests, itinerary planning, attendance stamps, achievements, vouchers, feedback, and the leaderboard.</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>🎤 Organizer</h3>
      <p><b>Bring the event to life.</b></p>
      <ul>
        <li>Explore event-management screens and forms.</li>
        <li>Review event, schedule, venue, and capacity information.</li>
        <li>Try the venue/time conflict-checking flow where available.</li>
        <li>Explore registrations, attendance, achievement passes, and event-related summaries.</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>🛡️ Administrator</h3>
      <p><b>Keep the festival world organised.</b></p>
      <ul>
        <li>Explore administrative screens for users, events, festivals, venues, categories, and sponsors.</li>
        <li>Review voucher campaign and distribution interfaces.</li>
        <li>Explore the leaderboard and reporting areas.</li>
      </ul>
    </td>
  </tr>
</table>

### 🔑 Local demo accounts

Use these seeded accounts to explore the three role dashboards. The sample password is the same for each account.

| Role | Email | Password |
|---|---|---|
| 🎟️ Participant | `participant@rangora.edu` | `Rangora@2026` |
| 🎤 Organizer | `organizer@rangora.edu` | `Rangora@2026` |
| 🛡️ Administrator | `admin@rangora.edu` | `Rangora@2026` |

These are **public sample credentials for local evaluation only**. Do not use them for a real service or put private information into the demo. A local demo role switcher may also be visible depending on the current configuration.

---

## 🌟 The Rangora signature features

Rangora aims to make event discovery feel more personal than a plain list of dates and posters. These are the product ideas being built into the prototype:

| ✨ Feature | The idea |
|---|---|
| **Seat Pulse** | Show how much space may be left at an event, based on capacity and recorded registrations. |
| **Beyond the Hype** | Help people discover events that match their interests—not only the most popular ones. |
| **No-Clash Guardian** | Help organisers spot venue, time, and capacity conflicts before an event is scheduled. |
| **Plan Rescue** | Help participants notice overlaps in their own event itinerary. |
| **Festival DNA** | Turn a person's event interests and choices into a lightweight festival-interest profile. |
| **Festival Passport** | Give the participant a place to see recorded attendance stamps and achievement milestones. |
| **Event Echo** | Help organisers learn from event feedback and recorded attendance. |

🏅 **Still growing:** achievement passes, collectible badges and stamps, rewards, vouchers, verified-attendance milestones, and a points-based leaderboard are also part of the evolving experience. Some pieces are further along than others; check the current UI and the status overview below rather than assuming every flow is finished.

---

## 🧭 What works in this download—and what does not?

| Area | Current status | What that means for you |
|---|---|---|
| Website and local server | 🟢 **Available** | Run the Flask app on your own computer. |
| Event catalogue and sample content | 🟢 **Demo-ready** | Explore seeded event, festival, and category data. |
| Local login and seeded accounts | 🟡 **Demo / local** | Use the included accounts; this is not a production identity system. |
| Participant, organizer, and admin screens | 🟡 **In progress** | Explore the role-specific interfaces; individual controls may still be unfinished. |
| SQL statements and relational schema | 🟢 **Included** | The application has SQL/database logic in `backend.py` and table definitions in `schema.sql`. |
| SQLite database | 🟢 **Connected locally** | The current download uses `rangora_local.db`. |
| DB Browser for SQLite | 🟢 **Optional companion tool** | Open the local database and run SQL yourself; it is not embedded in the website. |
| Neon PostgreSQL | ⚪ **Not connected** | No live Neon database is configured for this version. |
| Supabase services / cloud media storage | ⚪ **Not connected** | Cloud integration is not available in this local configuration. |
| Google OAuth and real email/SMS OTP | ⚪ **Not ready** | Do not rely on external-provider sign-in or OTP delivery. |
| Live payments and production ticketing | ⚪ **Not implemented** | Rangora is not a live payment or ticket-sales service. |

**Why this matters:** you can demonstrate the website, browse the local sample data, and practise relational SQL now. A local SQLite demonstration is **not** the same thing as demonstrating a live PostgreSQL connection to Neon.

---

## 🧑‍💻 Want to run SQL? Open the local database.

Rangora does not currently have an SQL editor inside the website. To inspect or change the local records, use the free desktop app **[DB Browser for SQLite](https://sqlitebrowser.org/dl/)**.

### Open the database

1. Stop the Rangora server with **Ctrl + C** in the terminal.
2. Open DB Browser for SQLite.
3. Select **Open Database** and choose `rangora_local.db` inside the extracted `rangora` folder.
4. Open **Execute SQL**.
5. Enter a query and click **Execute**.
6. If you modify data, click **Write Changes**. Restart Rangora and refresh the relevant page to check the result.

> 💡 **Tip:** Make a copy of `rangora_local.db` before trying `UPDATE` or `DELETE`. Stop the app before manual database edits to avoid confusion between the browser and the running website.

### Try these SQL queries

<details open>
  <summary><b>1. 🗂️ List all application tables and views</b></summary>

  ```sql
  SELECT name, type
  FROM sqlite_master
  WHERE type IN ('table', 'view')
    AND name NOT LIKE 'sqlite_%'
  ORDER BY type, name;
  ```
</details>

<details>
  <summary><b>2. 🎪 Browse event records</b></summary>

  ```sql
  SELECT event_id, event_name, ticket_price, max_seats, status
  FROM events
  LIMIT 10;
  ```
</details>

<details>
  <summary><b>3. 🔗 Join registrations, people, and events</b></summary>

  ```sql
  SELECT
      u.full_name,
      e.event_name,
      r.status,
      r.ticket_code
  FROM registrations AS r
  JOIN users AS u ON u.user_id = r.user_id
  JOIN events AS e ON e.event_id = r.event_id
  ORDER BY e.event_name;
  ```
</details>

<details>
  <summary><b>4. ✏️ Update one event price (example)</b></summary>

  First run the event query and choose an `event_id` that actually exists. Replace `123` below with that real ID, and inspect the row again afterwards.

  ```sql
  UPDATE events
  SET ticket_price = 150
  WHERE event_id = 123;
  ```

  **Careful:** this changes the record in your local database. Click **Write Changes** in DB Browser to save it.
</details>

### 🧱 What's inside the database?

The current schema defines **17 tables** and a view named `v_event_directory`.

<details>
  <summary><b>Show the database map</b></summary>

  | Table | Purpose |
  |---|---|
  | `users` | Participant, organizer, and administrator accounts. |
  | `festivals` | Festival-level information. |
  | `categories` | Event categories. |
  | `venues` | Event locations and capacities. |
  | `events` | Event details, schedule, price, status, and capacity. |
  | `registrations` | Participant registration records and ticket codes. |
  | `sponsors` | Sponsor information. |
  | `sponsorships` | Sponsor relationships and contributions. |
  | `user_preferences` | Saved participant interests. |
  | `itinerary_items` | Events in a participant's plan. |
  | `attendance_records` | Recorded/verified attendance. |
  | `event_feedback` | Ratings and feedback. |
  | `achievement_passes` | Achievement-pass definitions. |
  | `achievements` | Achievement definitions. |
  | `participant_rewards` | Rewards linked to participants. |
  | `voucher_campaigns` | Voucher campaign details. |
  | `issued_vouchers` | Individual issued vouchers. |

  **View:** `v_event_directory` brings together event details and related festival, category, venue, organizer, registration, and availability information.
</details>

`backend.py` contains the application's backend routes and database operations. `schema.sql` contains the relational schema. DB Browser is an optional external tool for inspecting the SQLite file; it does not connect this download to Neon. SQLite and PostgreSQL have differences, so queries may need changes when a PostgreSQL integration is added.

---

## 🧰 Built with

<div align="center">

| Layer | Technology | Role in Rangora |
|---|---|---|
| Frontend | HTML · CSS · JavaScript | Pages, styling, interactions, and API calls. |
| Backend | Python · Flask | Routing, application logic, and database operations. |
| Current database | SQLite | Local relational data for this demo. |
| Schema | SQL | Tables, relationships, constraints, and the `v_event_directory` view. |
| Optional database GUI | DB Browser for SQLite | Manual SQL exploration of `rangora_local.db`. |
| Planned cloud database | Neon PostgreSQL | **Not connected in this version.** |
| Planned cloud services | Supabase | **Not connected in this version.** |

</div>

## 📁 Project map

```text
rangora/
├── backend.py                 # Flask routes, application logic, SQL operations
├── schema.sql                 # Relational schema, constraints, indexes, and view
├── rangora_local.db           # Local SQLite database for offline/demo mode
├── run_localhost.bat          # One-click Windows launcher
├── run_localhost.sh           # Shell launcher for macOS/Linux
├── requirements.txt           # Python dependencies
├── .env.example               # Shareable configuration template
├── README.md                  # You are here
├── test_journey.py            # Automated journey/integration checks
├── templates/
│   ├── index.html             # Landing page
│   ├── auth.html              # Login and sign-up page
│   └── dashboard.html         # Role-aware dashboard
└── static/
    ├── css/                   # Website styling
    ├── js/                    # Frontend interactions and API calls
    ├── icons/                 # Rangora vector crest
    └── images/                # Event art, badges, stamps, and voucher designs
```

## 🧪 Run the test journey

After the environment has been set up, open a terminal in the project folder and run:

```bat
.venv\Scripts\python.exe test_journey.py
```

The test script checks parts of the local application journey. Results may change as development continues. Passing local tests does **not** verify a live Neon connection, Supabase integration, Google OAuth, OTP delivery, or production deployment.

---

## 🩹 Quick fixes

<details>
  <summary><b>Python was not found</b></summary>

  Install Python 3.10 or newer from [python.org](https://www.python.org/downloads/), enable **Add Python to PATH**, then reopen the terminal and run `run_localhost.bat` again.
</details>

<details>
  <summary><b>The browser says it cannot connect</b></summary>

  Keep the terminal window open and wait for Flask to start. Then refresh `http://127.0.0.1:5000`. If the terminal reports an error, read that message first.
</details>

<details>
  <summary><b>A page loads, but a button or feature does not work</b></summary>

  Some workflows are still under development. The current site may include demo records, placeholder states, or controls whose backend behavior is not complete yet.
</details>

<details>
  <summary><b>DB Browser cannot find the database</b></summary>

  Open `rangora_local.db` from the **extracted project folder**. Avoid choosing a similarly named copy in a different directory. If necessary, stop Rangora and search within the project folder for the file.
</details>

<details>
  <summary><b>Port 5000 is already in use</b></summary>

  Another local app may already be using that port. Stop that app or free port 5000, then run Rangora again.
</details>

---

## 🔐 A small security note before sharing

- Treat the demo accounts as public and never reuse their password elsewhere.
- Keep real credentials and secret keys out of public repositories. Use `.env.example` as the template you share, and keep your private `.env` out of Git.
- The included BAT file runs a local development server. It does **not** publish your website to the internet.
- Do not use this unfinished prototype to store sensitive personal information or process real payments.

## 🗺️ What's next?

Rangora is evolving from a locally runnable academic prototype toward a more complete event-management experience. The current focus is refining role-based workflows and the local relational database. Neon PostgreSQL, Supabase services, external authentication, and unfinished feature flows remain future integration work—not completed functionality in this download.

<div align="center">
  <h3>🎉 Find your crowd. Make a plan. Collect a memory.</h3>
  <p><b>Rangora — Find your kind of celebration.</b></p>
  <sub>Built as an evolving academic project. Thanks for checking it out!</sub>
</div>
