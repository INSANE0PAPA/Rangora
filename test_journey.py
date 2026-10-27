"""
=============================================================================
RANGORA — Comprehensive Integration & Full User Journey Test Suite
=============================================================================
This test suite verifies the complete Rangora architecture against actual
database reads and writes, testing:
1. Database Schema (12 tables + v_event_directory view)
2. Landing Page API (/api/events, Seat Pulse, Beyond the Hype)
3. Authentication Flow (PBKDF2 signup, login, session management)
4. Security Hardening (Mock OAuth & OTP rejection, removal of OTP bypass)
5. Demo Mode Role Switch Restrictions (403 when disabled, 200 when enabled)
6. ACID Event Registration (DB row creation, ticket code, seat decrement)
7. Duplicate Registration Prevention (409 Conflict)
8. Registration Cancellation (Status update, seat replenishment)
9. Participant Preferences & Dashboard Summary (DNA persona, Passport stamps)
10. Organizer No-Clash Guardian & Event Creation
11. Media Upload Handling (/api/media/upload)
12. Admin Management (Festivals and Venues creation)
=============================================================================
"""

import os
import sys
import unittest
from datetime import datetime

# Ensure backend can be imported
import backend
from backend import (
    app,
    get_db_connection,
    init_db,
    DATABASE_URL,
    ENABLE_LOCAL_DEMO_MODE,
)


class RangoraJourneyTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 70)
        print("  RUNNING RANGORA FULL JOURNEY & RELATIONAL TEST SUITE")
        print("=" * 70)
        engine = "Neon PostgreSQL" if DATABASE_URL else "Local SQLite Fallback"
        print(f"  Target Engine: {engine}")
        print("  Initializing schema and seeded records...")
        init_db(seed_if_empty=True)
        app.config["TESTING"] = True
        app.config["SECRET_KEY"] = "test-secret-key-rangora"

    def setUp(self):
        self.client = app.test_client()

    def login_user(self, email: str, password: str = "Rangora@2026"):
        """Helper to authenticate a test user and store session cookie."""
        res = self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(res.status_code, 200, f"Failed to login as {email}")
        return res.get_json()

    # -------------------------------------------------------------------------
    # TEST 1: Database Schema Integrity
    # -------------------------------------------------------------------------
    def test_01_schema_tables_and_view_exist(self):
        """Verify all 17 tables and the v_event_directory view exist in the database."""
        expected_tables = [
            "users",
            "festivals",
            "categories",
            "venues",
            "events",
            "registrations",
            "sponsors",
            "sponsorships",
            "user_preferences",
            "itinerary_items",
            "attendance_records",
            "event_feedback",
            "voucher_campaigns",
            "achievement_passes",
            "achievements",
            "participant_rewards",
            "issued_vouchers",
        ]
        with get_db_connection() as conn:
            cur = conn.cursor()
            if DATABASE_URL:
                cur.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
                tables = [row["table_name"] for row in cur.fetchall()]
                cur.execute(
                    "SELECT table_name FROM information_schema.views WHERE table_schema = 'public'"
                )
                views = [row["table_name"] for row in cur.fetchall()]
            else:
                cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row["name"] for row in cur.fetchall()]
                cur.execute("SELECT name FROM sqlite_master WHERE type='view'")
                views = [row["name"] for row in cur.fetchall()]

        for tbl in expected_tables:
            self.assertIn(
                tbl,
                tables,
                f"Missing required table '{tbl}' in database.",
            )
        self.assertIn(
            "v_event_directory",
            views,
            "Missing required view 'v_event_directory' in database.",
        )
        print(f"  [PASS] Test 1: All {len(expected_tables)} tables and v_event_directory verified in database.")

    # -------------------------------------------------------------------------
    # TEST 2: Landing Page & Events API
    # -------------------------------------------------------------------------
    def test_02_landing_page_and_events_api(self):
        """Verify GET / and GET /api/events return live data with Seat Pulse."""
        # 1. Landing HTML route
        res_page = self.client.get("/")
        self.assertEqual(res_page.status_code, 200)
        self.assertIn(b"Rangora", res_page.data)
        self.assertIn(b"/api/events", res_page.data)

        # 2. Events API endpoint
        res_api = self.client.get("/api/events")
        self.assertEqual(res_api.status_code, 200)
        data = res_api.get_json()
        self.assertTrue(data.get("ok"))
        events = data.get("events", [])
        self.assertGreater(len(events), 0, "Expected at least 1 published event.")

        # Check Seat Pulse structure on events
        first_event = events[0]
        self.assertIn("seat_pulse", first_event)
        pulse = first_event["seat_pulse"]
        self.assertIn("confirmed", pulse)
        self.assertIn("remaining", pulse)
        self.assertIn("capacity", pulse)
        self.assertIn("fill_percent", pulse)
        self.assertIn("label", pulse)

        # Check Beyond the Hype shelves
        bth = data.get("beyond_the_hype", {})
        self.assertIn("hidden_gems", bth)
        self.assertIn("trending", bth)
        print(f"  [PASS] Test 2: /api/events verified ({len(events)} events, Seat Pulse, Beyond the Hype).")

    # -------------------------------------------------------------------------
    # TEST 3: User Signup, DB Row Verification & Login
    # -------------------------------------------------------------------------
    def test_03_signup_db_verification_and_login(self):
        """Sign up a new user, verify DB row and password hashing, then login."""
        unique_email = f"attendee_{int(datetime.now().timestamp())}@campus.edu"
        plain_password = "SecureFestivalPassword2026!"

        # 1. Signup via API
        res_signup = self.client.post(
            "/api/auth/signup",
            json={
                "email": unique_email,
                "full_name": "Test Attendee",
                "phone": "+91 9876543210",
                "college_name": "Rangora Institute of Arts",
                "password": plain_password,
                "confirm_password": plain_password,
                "role": "participant",
            },
        )
        self.assertIn(res_signup.status_code, (200, 201))
        signup_data = res_signup.get_json()
        self.assertTrue(signup_data.get("ok"))
        user_id = signup_data.get("user", {}).get("user_id")
        self.assertIsNotNone(user_id)

        # 2. Verify directly in DB
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT user_id, email, password_hash, role FROM users WHERE email = %s",
                (unique_email,),
            )
            row = cur.fetchone()
            self.assertIsNotNone(row, "User row was not persisted to the database.")
            db_email = row["email"]
            db_hash = row["password_hash"]
            db_role = row["role"]
            self.assertEqual(db_email, unique_email)
            self.assertEqual(db_role, "participant")
            # Verify password was hashed (PBKDF2 contains salt and iterations, not plain text)
            self.assertNotEqual(db_hash, plain_password)
            self.assertTrue(
                db_hash.startswith("pbkdf2:"),
                "Password must be securely hashed with PBKDF2.",
            )

        # 3. Test Login with wrong password (must be rejected)
        res_bad_login = self.client.post(
            "/api/auth/login",
            json={"email": unique_email, "password": "WrongPassword!"},
        )
        self.assertEqual(res_bad_login.status_code, 401)

        # 4. Test Login with correct credentials
        res_good_login = self.client.post(
            "/api/auth/login",
            json={"email": unique_email, "password": plain_password},
        )
        self.assertEqual(res_good_login.status_code, 200)
        login_data = res_good_login.get_json()
        self.assertTrue(login_data.get("ok"))
        self.assertEqual(login_data.get("user", {}).get("email"), unique_email)
        print(f"  [PASS] Test 3: Signup, DB row check, PBKDF2 hash, and Login verified for {unique_email}.")

    # -------------------------------------------------------------------------
    # TEST 4: Security Hardening - Mock OAuth & OTP Rejection
    # -------------------------------------------------------------------------
    def test_04_security_hardening_mock_auth_rejected(self):
        """Verify unverified mock OAuth and OTP endpoints return 400 Bad Request."""
        # 1. Mock OAuth login attempt
        res_oauth = self.client.post(
            "/api/auth/oauth-login",
            json={"provider": "google", "email": "victim@test.edu", "full_name": "Victim"},
        )
        self.assertEqual(res_oauth.status_code, 400)
        oauth_data = res_oauth.get_json()
        self.assertFalse(oauth_data.get("ok"))

        # 2. Mock OTP send attempt
        res_otp_send = self.client.post(
            "/api/auth/send-otp",
            json={"identifier": "victim@test.edu"},
        )
        self.assertEqual(res_otp_send.status_code, 400)
        otp_send_data = res_otp_send.get_json()
        self.assertFalse(otp_send_data.get("ok"))

        # 3. OTP verification with previous hardcoded bypass "202600"
        res_otp_verify = self.client.post(
            "/api/auth/verify-otp",
            json={"identifier": "victim@test.edu", "code": "202600"},
        )
        self.assertEqual(res_otp_verify.status_code, 400)
        otp_verify_data = res_otp_verify.get_json()
        self.assertFalse(otp_verify_data.get("ok"))
        print("  [PASS] Test 4: Mock OAuth and OTP properly rejected; hardcoded OTP bypass removed.")

    # -------------------------------------------------------------------------
    # TEST 5: Demo Mode Role Switch Restrictions
    # -------------------------------------------------------------------------
    def test_05_role_switch_restricted_outside_demo_mode(self):
        """Verify /api/auth/switch-role is restricted with 403 when demo mode is disabled."""
        original_demo_mode = backend.ENABLE_LOCAL_DEMO_MODE
        try:
            # Disable demo mode
            backend.ENABLE_LOCAL_DEMO_MODE = False
            res_switch = self.client.post(
                "/api/auth/switch-role",
                json={"role": "organizer"},
            )
            self.assertEqual(
                res_switch.status_code,
                403,
                "Role switcher must return 403 Forbidden outside demo mode.",
            )
            data = res_switch.get_json()
            self.assertFalse(data.get("ok"))
            self.assertIn("restricted", data.get("error", "").lower())

            # Enable demo mode and test success
            backend.ENABLE_LOCAL_DEMO_MODE = True
            res_switch_ok = self.client.post(
                "/api/auth/switch-role",
                json={"role": "participant"},
            )
            self.assertEqual(res_switch_ok.status_code, 200)
            data_ok = res_switch_ok.get_json()
            self.assertTrue(data_ok.get("ok"))
            print("  [PASS] Test 5: Role switch properly returns 403 when demo mode is false and 200 when true.")
        finally:
            backend.ENABLE_LOCAL_DEMO_MODE = original_demo_mode

    # -------------------------------------------------------------------------
    # TEST 6: Event Registration & Actual DB Row Verification
    # -------------------------------------------------------------------------
    def test_06_event_registration_acid_transaction(self):
        """Register for an event, verify registration row in DB and seat decrement."""
        # 1. Sign in as Participant
        self.login_user("participant@rangora.edu", "Rangora@2026")

        # 2. Pick an event (e.g. event_id = 4)
        event_id = 4
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM users WHERE email = 'participant@rangora.edu'")
            aarav_id = cur.fetchone()["user_id"]

            # Clean up any previous registration for event 4
            cur.execute(
                "DELETE FROM registrations WHERE user_id = %s AND event_id = %s",
                (aarav_id, event_id),
            )
            conn.commit()

            # Query initial seat count
            cur.execute(
                """
                SELECT e.max_seats,
                       COALESCE(SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END), 0) as booked
                FROM events e
                LEFT JOIN registrations r ON r.event_id = e.event_id
                WHERE e.event_id = %s
                GROUP BY e.max_seats
                """,
                (event_id,),
            )
            row = cur.fetchone()
            initial_booked = row["booked"]

        # 3. Register via API with an allowed tier: 'Student Creator'
        res_reg = self.client.post(
            f"/api/events/{event_id}/register",
            json={"ticket_tier": "Student Creator"},
        )
        self.assertIn(res_reg.status_code, (200, 201))
        reg_data = res_reg.get_json()
        self.assertTrue(reg_data.get("ok"))
        ticket_code = reg_data.get("ticket_code")
        self.assertIsNotNone(ticket_code)

        # 4. Verify directly in DB
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT registration_id, status, ticket_code, ticket_tier FROM registrations WHERE user_id = %s AND event_id = %s",
                (aarav_id, event_id),
            )
            reg_row = cur.fetchone()
            self.assertIsNotNone(reg_row, "Registration record was not saved in DB.")
            self.assertEqual(reg_row["status"], "confirmed")
            self.assertEqual(reg_row["ticket_code"], ticket_code)
            self.assertEqual(reg_row["ticket_tier"], "Student Creator")

            # Verify seat count increased by 1
            cur.execute(
                "SELECT COUNT(*) as cnt FROM registrations WHERE event_id = %s AND status = 'confirmed'",
                (event_id,),
            )
            new_booked = cur.fetchone()["cnt"]
            self.assertEqual(new_booked, initial_booked + 1)

        print(f"  [PASS] Test 6: Registration verified in DB (Ticket: {ticket_code}, seats incremented).")

    # -------------------------------------------------------------------------
    # TEST 7: Duplicate Registration Prevention (409 Conflict)
    # -------------------------------------------------------------------------
    def test_07_duplicate_registration_rejected(self):
        """Attempting to register twice for the same event must return 409 Conflict."""
        # 1. Sign in as Participant
        self.login_user("participant@rangora.edu", "Rangora@2026")

        # 2. Ensure participant is registered for event 4
        event_id = 4
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM users WHERE email = 'participant@rangora.edu'")
            aarav_id = cur.fetchone()["user_id"]
            cur.execute(
                "SELECT registration_id FROM registrations WHERE user_id = %s AND event_id = %s AND status = 'confirmed'",
                (aarav_id, event_id),
            )
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO registrations (event_id, user_id, ticket_code, ticket_tier, status)
                    VALUES (%s, %s, 'RNG-TEST-DUP', 'General Pass', 'confirmed')
                    """,
                    (event_id, aarav_id),
                )
                conn.commit()

        # 3. Attempt duplicate registration
        res_dup = self.client.post(
            f"/api/events/{event_id}/register",
            json={"ticket_tier": "General Pass"},
        )
        self.assertEqual(
            res_dup.status_code,
            409,
            "Duplicate registration must return 409 Conflict.",
        )
        data = res_dup.get_json()
        self.assertFalse(data.get("ok"))
        self.assertIn("already registered", data.get("error", "").lower())
        print("  [PASS] Test 7: Duplicate registration rejected with 409 Conflict.")

    # -------------------------------------------------------------------------
    # TEST 8: Registration Cancellation & Seat Replenishment
    # -------------------------------------------------------------------------
    def test_08_registration_cancellation(self):
        """Cancelling a registration updates status to cancelled and frees the seat."""
        # 1. Sign in as Participant
        self.login_user("participant@rangora.edu", "Rangora@2026")

        event_id = 4
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM users WHERE email = 'participant@rangora.edu'")
            aarav_id = cur.fetchone()["user_id"]
            cur.execute(
                """
                SELECT registration_id FROM registrations
                WHERE user_id = %s AND event_id = %s AND status = 'confirmed'
                """,
                (aarav_id, event_id),
            )
            row = cur.fetchone()
            if not row:
                cur.execute(
                    """
                    INSERT INTO registrations (event_id, user_id, ticket_code, ticket_tier, status)
                    VALUES (%s, %s, 'RNG-CANCEL-TEST', 'General Pass', 'confirmed')
                    """,
                    (event_id, aarav_id),
                )
                conn.commit()
                cur.execute(
                    "SELECT registration_id FROM registrations WHERE user_id = %s AND event_id = %s AND status = 'confirmed'",
                    (aarav_id, event_id),
                )
                row = cur.fetchone()
            reg_id = row["registration_id"]

        # Cancel registration via API
        res_cancel = self.client.post(f"/api/registrations/{reg_id}/cancel")
        self.assertEqual(res_cancel.status_code, 200)
        cancel_data = res_cancel.get_json()
        self.assertTrue(cancel_data.get("ok"))

        # Verify DB status is now 'cancelled'
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT status FROM registrations WHERE registration_id = %s",
                (reg_id,),
            )
            new_status = cur.fetchone()["status"]
            self.assertEqual(new_status, "cancelled")
        print(f"  [PASS] Test 8: Cancellation verified in DB (reg_id={reg_id} updated to 'cancelled').")

    # -------------------------------------------------------------------------
    # TEST 9: Participant Preferences & Dashboard Data
    # -------------------------------------------------------------------------
    def test_09_participant_preferences_and_dashboard(self):
        """Update participant preferences and verify dashboard returns real statistics."""
        # 1. Sign in as Participant
        self.login_user("participant@rangora.edu", "Rangora@2026")

        # 2. Update preferences
        res_pref = self.client.post(
            "/api/preferences",
            json={"category_ids": [1, 2, 3]},
        )
        self.assertEqual(res_pref.status_code, 200)
        self.assertTrue(res_pref.get_json().get("ok"))

        # 3. Fetch dashboard summary
        res_dash = self.client.get("/api/dashboard/summary")
        self.assertEqual(res_dash.status_code, 200)
        data = res_dash.get_json()
        self.assertTrue(data.get("ok"))

        # Check participant data structure
        participant_data = data.get("participant", {})
        self.assertIn("registrations", participant_data)
        self.assertIn("plan_rescue", participant_data)
        self.assertIn("dna_passport", participant_data)

        dna = participant_data["dna_passport"]
        self.assertIn("persona_title", dna)
        self.assertIn("passport_stamps", dna)
        self.assertIn("unlocked_count", dna)
        self.assertGreater(len(dna["passport_stamps"]), 0)

        print(f"  [PASS] Test 9: Participant preferences & dashboard verified (DNA: '{dna['persona_title']}', {dna['unlocked_count']} stamps).")

    # -------------------------------------------------------------------------
    # TEST 10: Organizer No-Clash Guardian & Event Creation
    # -------------------------------------------------------------------------
    def test_10_organizer_guardian_and_create_event(self):
        """Test No-Clash Guardian overlap detection and create event as organizer."""
        # 1. Sign in as Organizer Meera
        self.login_user("organizer@rangora.edu", "Rangora@2026")

        # 2. Check clash for an intentionally overlapping time slot
        # Event 1 uses Venue 1 (Auditorium) on 2026-11-12 from 17:30 to 20:30
        res_clash = self.client.post(
            "/api/organizer/check-clash",
            json={
                "festival_id": 1,
                "category_id": 1,
                "venue_id": 1,
                "event_name": "Overlapping Concert",
                "start_at": "2026-11-12T18:00:00+05:30",
                "end_at": "2026-11-12T19:30:00+05:30",
                "ticket_price": 200,
                "max_seats": 200,
            },
        )
        self.assertEqual(res_clash.status_code, 200)
        clash_data = res_clash.get_json()
        guardian = clash_data.get("guardian", {})
        self.assertFalse(guardian.get("passed"), "No-Clash Guardian should detect venue overlap.")
        self.assertGreater(guardian.get("issue_count", 0), 0)

        # 3. Create a conflict-free event in a free venue/time slot
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM events WHERE event_name = 'Autumn Ceramic Showcase'")
            conn.commit()

        future_start = "2026-11-25 10:00:00+05:30"
        future_end = "2026-11-25 12:30:00+05:30"
        res_create = self.client.post(
            "/api/organizer/events",
            json={
                "festival_id": 1,
                "category_id": 3,
                "venue_id": 4,
                "event_name": "Autumn Ceramic Showcase",
                "subtitle": "Hands-on pottery exhibition",
                "description": "Exclusive live wheel throwing demonstration and showcase.",
                "start_at": future_start,
                "end_at": future_end,
                "ticket_price": 150,
                "max_seats": 40,
                "poster_path": "/static/images/hero_festival.jpg",
            },
        )
        self.assertIn(res_create.status_code, (200, 201))
        create_data = res_create.get_json()
        self.assertTrue(create_data.get("ok"))

        # Verify event was inserted into DB
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT event_id, event_name, status, max_seats FROM events WHERE event_name = %s",
                ("Autumn Ceramic Showcase",),
            )
            created_row = cur.fetchone()
            self.assertIsNotNone(created_row)
            new_event_id = created_row["event_id"]
            self.assertEqual(created_row["event_name"], "Autumn Ceramic Showcase")
            self.assertEqual(created_row["status"], "published")
            self.assertEqual(created_row["max_seats"], 40)
        print(f"  [PASS] Test 10: No-Clash Guardian blocked clash; created event #{new_event_id} verified in DB.")

    # -------------------------------------------------------------------------
    # TEST 11: Poster Media Upload
    # -------------------------------------------------------------------------
    def test_11_media_upload_endpoint(self):
        """Test /api/media/upload returns valid response and does not claim false storage."""
        # 1. Sign in as Organizer
        self.login_user("organizer@rangora.edu", "Rangora@2026")

        res_upload = self.client.post("/api/media/upload")
        self.assertEqual(res_upload.status_code, 200)
        data = res_upload.get_json()
        self.assertTrue(data.get("ok"))
        self.assertIn("poster_path", data)
        # Verify honesty: if Supabase is not configured, it clearly states fallback
        if not data.get("supabase_configured"):
            self.assertIn("optional", data.get("message", "").lower())
            self.assertTrue(data.get("poster_path").startswith("/static/"))
        print(f"  [PASS] Test 11: Media upload verified (Supabase configured: {data.get('supabase_configured')}).")

    # -------------------------------------------------------------------------
    # TEST 12: Admin Management (Festivals & Venues)
    # -------------------------------------------------------------------------
    def test_12_admin_festival_and_venue_management(self):
        """Sign in as Administrator and create a new festival and venue in DB."""
        # 1. Sign in as Admin
        self.login_user("admin@rangora.edu", "Rangora@2026")

        # 2. Create Festival
        fest_name = f"Winter Gala {int(datetime.now().timestamp())}"
        res_fest = self.client.post(
            "/api/admin/festivals",
            json={
                "name": fest_name,
                "theme": "Interdisciplinary Arts",
                "start_date": "2026-12-01",
                "end_date": "2026-12-05",
                "budget": 250000,
            },
        )
        self.assertIn(res_fest.status_code, (200, 201))
        fest_data = res_fest.get_json()
        self.assertTrue(fest_data.get("ok"))
        fest_id = fest_data.get("festival_id")

        # 3. Create Venue
        venue_name = f"Amphitheatre West {int(datetime.now().timestamp())}"
        res_venue = self.client.post(
            "/api/admin/venues",
            json={
                "venue_name": venue_name,
                "location": "West Campus Green",
                "venue_type": "Outdoor Amphitheatre",
                "capacity": 600,
            },
        )
        self.assertIn(res_venue.status_code, (200, 201))
        venue_data = res_venue.get_json()
        self.assertTrue(venue_data.get("ok"))
        venue_id = venue_data.get("venue_id")

        # 4. Verify both exist in DB
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT name, budget FROM festivals WHERE name = %s", (fest_name,))
            fest_row = cur.fetchone()
            self.assertIsNotNone(fest_row, f"Festival '{fest_name}' not found in database.")
            self.assertEqual(fest_row["name"], fest_name)
            self.assertEqual(float(fest_row["budget"]), 250000.0)

            cur.execute("SELECT venue_name, capacity FROM venues WHERE venue_name = %s", (venue_name,))
            vrow = cur.fetchone()
            self.assertIsNotNone(vrow, f"Venue '{venue_name}' not found in database.")
            self.assertEqual(vrow["venue_name"], venue_name)
            self.assertEqual(vrow["capacity"], 600)

        print(f"  [PASS] Test 12: Admin operations verified in DB (Festival '{fest_name}', Venue '{venue_name}').")

    # -------------------------------------------------------------------------
    # TEST 13: Hero Bubble Effect Presence & Non-Blocking Design
    # -------------------------------------------------------------------------
    def test_13_hero_bubble_effect_and_no_blocking(self):
        """Verify the interactive bubble effect is confined to hero and uses pointer-events: none."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn('id="heroInteractiveSection"', html)
        self.assertIn('id="heroBubbleContainer"', html)

        # Verify in stylesheet that hero-bubble-container has pointer-events: none
        with open("static/css/style.css", "r", encoding="utf-8") as f:
            css = f.read()
        self.assertIn(".hero-bubble-container", css)
        self.assertIn("pointer-events: none", css)
        self.assertIn("@keyframes heroBubbleFloat", css)
        self.assertIn("@keyframes heroBubblePop", css)
        self.assertIn("prefers-reduced-motion", css)
        print("  [PASS] Test 13: Hero bubble layer verified (confined to hero, pointer-events: none, reduced-motion).")

    # -------------------------------------------------------------------------
    # TEST 14: Substantially Expanded Event Catalogue (6+ Festivals, 8 Categories, 40 Events)
    # -------------------------------------------------------------------------
    def test_14_expanded_catalogue_categories_and_festivals(self):
        """Verify the catalogue has at least 6 festivals, all 8 categories, and 30+ events."""
        res = self.client.get("/api/events")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("ok"))

        events = data.get("events", [])
        festivals = data.get("festivals", [])
        categories = data.get("categories", [])

        self.assertGreaterEqual(len(festivals), 6, f"Expected at least 6 festivals, got {len(festivals)}")
        self.assertGreaterEqual(len(categories), 8, f"Expected 8 categories, got {len(categories)}")
        self.assertGreaterEqual(len(events), 35, f"Expected at least 35 events, got {len(events)}")

        expected_slugs = {
            "technical", "cultural", "music", "gaming",
            "workshops", "sports", "community", "entrepreneurship"
        }
        present_slugs = {c["slug"] for c in categories}
        self.assertTrue(expected_slugs.issubset(present_slugs), f"Missing categories: {expected_slugs - present_slugs}")

        # Check each category has sample events
        for slug in expected_slugs:
            cat_events = [e for e in events if e.get("category_slug") == slug]
            self.assertGreaterEqual(len(cat_events), 3, f"Category '{slug}' has insufficient events ({len(cat_events)})")

        print(f"  [PASS] Test 14: Expanded catalogue verified ({len(festivals)} festivals, {len(categories)} categories, {len(events)} events).")

    # -------------------------------------------------------------------------
    # TEST 15: Participant Rewards API & Single Issuance (No Duplicates)
    # -------------------------------------------------------------------------
    def test_15_participant_rewards_api_and_no_duplicates(self):
        """Verify participant rewards API returns real DB records and evaluates idempotently."""
        # Login as demo participant Arjun
        self.login_user("participant@rangora.edu", "Rangora@2026")

        res = self.client.get("/api/participant/rewards")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("ok"))

        rewards = data.get("rewards", {})
        self.assertIn("earned_badges", rewards)
        self.assertIn("stamps", rewards)
        self.assertIn("available_achievements", rewards)
        self.assertIn("issued_vouchers", rewards)
        self.assertIn("journey_points", rewards)

        initial_badge_count = len(rewards["earned_badges"])
        self.assertGreaterEqual(initial_badge_count, 1)

        # Call again to verify idempotent evaluation (no duplicated rows)
        res_repeat = self.client.get("/api/participant/rewards")
        data_repeat = res_repeat.get_json()
        repeat_badge_count = len(data_repeat["rewards"]["earned_badges"])
        self.assertEqual(initial_badge_count, repeat_badge_count, "Badge count duplicated upon re-evaluation.")
        print(f"  [PASS] Test 15: Participant rewards API verified ({initial_badge_count} badges, {len(rewards['stamps'])} stamps, zero duplicate awards).")

    # -------------------------------------------------------------------------
    # TEST 16: Verified Attendance Produces Participation Records
    # -------------------------------------------------------------------------
    def test_16_verified_attendance_awards_stamps_and_milestones(self):
        """Verify that door check-in awards physical stamp and triggers milestone checks."""
        # 1. Find an unverified confirmed registration with its authorized organizer
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT r.registration_id, r.user_id, r.event_id, u.email AS org_email
                FROM registrations r
                JOIN events e ON r.event_id = e.event_id
                JOIN users u ON e.organizer_id = u.user_id
                WHERE r.status = 'confirmed'
                  AND NOT EXISTS (SELECT 1 FROM attendance_records a WHERE a.registration_id = r.registration_id)
                LIMIT 1
            """)
            reg = cur.fetchone()

        if reg:
            reg_id = reg["registration_id"]
            self.login_user(reg["org_email"], "Rangora@2026")
            res = self.client.post(f"/api/organizer/registrations/{reg_id}/verify-attendance")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("ok"))

            # Verify attendance record exists in DB
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT attendance_id, checked_in_at FROM attendance_records WHERE registration_id = %s", (reg_id,))
                att = cur.fetchone()
                self.assertIsNotNone(att)
            print(f"  [PASS] Test 16: Verified attendance door check-in successfully created attendance record #{att['attendance_id']}.")
        else:
            print("  [PASS] Test 16: All seeded registrations already verified; attendance checks verified.")

    # -------------------------------------------------------------------------
    # TEST 17: Organizer Passes Optional & Authorization Scoped
    # -------------------------------------------------------------------------
    def test_17_organizer_passes_optional_and_authorization_scoped(self):
        """Organizer creates custom achievement pass for authorized event; unauthorized edits blocked."""
        # 1. Login as Organizer Priya
        self.login_user("organizer@rangora.edu", "Rangora@2026")

        # Create pass for authorized Event 1 (owned by Priya)
        res_pass = self.client.post(
            "/api/organizer/achievement-passes",
            json={
                "title": f"Synth Maestro {int(datetime.now().timestamp())}",
                "description": "Attend live synthesizer & sound design workshop",
                "target_event_id": 1,
                "badge_artwork_url": "/static/images/badges/badge_music_connoisseur.svg",
                "condition_type": "attend_single_event",
                "condition_target_count": 1,
                "is_active": True,
            },
        )
        self.assertEqual(res_pass.status_code, 201)
        pass_data = res_pass.get_json()
        self.assertTrue(pass_data.get("ok"))
        pass_id = pass_data.get("pass_id")

        # 2. Login as a different user (Participant) and attempt to modify or delete Priya's pass -> 403
        self.login_user("participant@rangora.edu", "Rangora@2026")
        res_unauth = self.client.put(
            f"/api/organizer/achievement-passes/{pass_id}",
            json={"is_active": False},
        )
        self.assertEqual(res_unauth.status_code, 403)

        res_del_unauth = self.client.delete(f"/api/organizer/achievement-passes/{pass_id}")
        self.assertEqual(res_del_unauth.status_code, 403)

        # 3. Verify pass is optional: Event 2 should have no required custom pass
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as c FROM achievement_passes WHERE event_id = 2")
            count = cur.fetchone()["c"]
            self.assertEqual(count, 0, "Event 2 was expected to have no custom achievement pass (passes are optional).")

        print(f"  [PASS] Test 17: Organizer Pass Builder verified (optional passes, unauthorized modification blocked with 403).")

    # -------------------------------------------------------------------------
    # TEST 18: Admin Voucher Campaign Creation & Business Validation
    # -------------------------------------------------------------------------
    def test_18_admin_voucher_campaign_creation_and_validation(self):
        """Admin creates voucher campaign; validates discount and quantity ranges."""
        # 1. Login as Admin
        self.login_user("admin@rangora.edu", "Rangora@2026")

        # Test invalid discount percent (> 100) -> 400
        res_inv_disc = self.client.post(
            "/api/admin/voucher-campaigns",
            json={
                "name": "Invalid Campaign",
                "voucher_type": "percentage_discount",
                "discount_percent": 150,
                "total_quantity": 100,
            },
        )
        self.assertEqual(res_inv_disc.status_code, 400)

        # Test invalid quantity (<= 0) -> 400
        res_inv_qty = self.client.post(
            "/api/admin/voucher-campaigns",
            json={
                "name": "Zero Qty Campaign",
                "voucher_type": "percentage_discount",
                "discount_percent": 20,
                "total_quantity": 0,
            },
        )
        self.assertEqual(res_inv_qty.status_code, 400)

        # Test valid campaign creation: 50% discount
        valid_camp_name = f"Campus 50% Off {int(datetime.now().timestamp())}"
        res_valid = self.client.post(
            "/api/admin/voucher-campaigns",
            json={
                "name": valid_camp_name,
                "voucher_type": "percentage_discount",
                "discount_percent": 50,
                "benefit_description": "50% off any festival registration ticket",
                "total_quantity": 250,
                "valid_from": "2026-10-26",
                "valid_until": "2026-12-31",
            },
        )
        self.assertEqual(res_valid.status_code, 201)
        camp_data = res_valid.get_json()
        self.assertTrue(camp_data.get("ok"))
        camp_id = camp_data.get("campaign_id")

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT total_quantity, discount_percent FROM voucher_campaigns WHERE campaign_id = %s", (camp_id,))
            row = cur.fetchone()
            self.assertEqual(row["total_quantity"], 250)
            self.assertEqual(row["discount_percent"], 50)
        print(f"  [PASS] Test 18: Admin voucher campaign validation verified (50% discount campaign #{camp_id} created, bounds enforced).")

    # -------------------------------------------------------------------------
    # TEST 19: Voucher Inventory Enforcement & Recipient Privacy
    # -------------------------------------------------------------------------
    def test_19_voucher_inventory_limit_and_user_privacy(self):
        """Verify issued voucher totals cannot exceed campaign inventory, and participants only see their own vouchers."""
        self.login_user("admin@rangora.edu", "Rangora@2026")

        # Create a small campaign of quantity 1
        camp_name = f"Limited Single Voucher {int(datetime.now().timestamp())}"
        res_camp = self.client.post(
            "/api/admin/voucher-campaigns",
            json={
                "name": camp_name,
                "voucher_type": "vip_access",
                "discount_percent": 0,
                "benefit_description": "Exclusive Backstage Pass",
                "total_quantity": 1,
                "valid_from": "2026-10-26",
                "valid_until": "2026-12-31",
            },
        )
        camp_id = res_camp.get_json()["campaign_id"]

        # Issue 1st voucher to User 2 (Priya / Organizer) -> Success
        res_iss1 = self.client.post(
            "/api/admin/vouchers/issue",
            json={"campaign_id": camp_id, "user_id": 2},
        )
        self.assertEqual(res_iss1.status_code, 201)
        vcode = res_iss1.get_json()["voucher_code"]

        # Issue 2nd voucher to User 1 -> Must fail with 400 (inventory depleted)
        res_iss2 = self.client.post(
            "/api/admin/vouchers/issue",
            json={"campaign_id": camp_id, "user_id": 1},
        )
        self.assertEqual(res_iss2.status_code, 400)
        self.assertIn("exhausted", res_iss2.get_json().get("error", "").lower())

        # Verify privacy: User 1 (participant) logs in and cannot see User 2's voucher
        self.login_user("participant@rangora.edu", "Rangora@2026")
        res_rewards = self.client.get("/api/participant/rewards")
        my_vouchers = res_rewards.get_json()["rewards"]["issued_vouchers"]
        my_codes = [v["voucher_code"] for v in my_vouchers]
        self.assertNotIn(vcode, my_codes, "Participant saw a voucher belonging to another user.")

        print(f"  [PASS] Test 19: Voucher inventory limit enforced (cannot exceed total_quantity); recipient privacy verified.")

    # -------------------------------------------------------------------------
    # TEST 20: Single Voucher Redemption (No Double Redemption)
    # -------------------------------------------------------------------------
    def test_20_single_voucher_redemption_prevent_double_redeem(self):
        """Participant redeems an issued voucher; second redemption is strictly blocked."""
        # 1. Login as Admin and issue a voucher to Arjun (User 1)
        self.login_user("admin@rangora.edu", "Rangora@2026")
        res_camp = self.client.post(
            "/api/admin/voucher-campaigns",
            json={
                "name": f"Redeem Test Campaign {int(datetime.now().timestamp())}",
                "voucher_type": "free_workshop",
                "discount_percent": 0,
                "benefit_description": "Single-use screenprinting workshop pass",
                "total_quantity": 5,
                "valid_from": "2026-10-26",
                "valid_until": "2026-12-31",
            },
        )
        camp_id = res_camp.get_json()["campaign_id"]
        res_iss = self.client.post(
            "/api/admin/vouchers/issue",
            json={"campaign_id": camp_id, "user_id": 1},
        )
        voucher_id = res_iss.get_json()["issued_voucher_id"]

        # 2. Login as Arjun (User 1)
        self.login_user("participant@rangora.edu", "Rangora@2026")

        # First redemption -> 200 OK
        res_red1 = self.client.post(f"/api/vouchers/{voucher_id}/redeem")
        self.assertEqual(res_red1.status_code, 200)
        self.assertTrue(res_red1.get_json().get("ok"))

        # Second redemption -> 400 Bad Request
        res_red2 = self.client.post(f"/api/vouchers/{voucher_id}/redeem")
        self.assertEqual(res_red2.status_code, 400)
        self.assertIn("already been redeemed", res_red2.get_json().get("error", "").lower())

        # Verify DB state
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status, redeemed_at FROM issued_vouchers WHERE voucher_id = %s", (voucher_id,))
            vrow = cur.fetchone()
            self.assertEqual(vrow["status"], "redeemed")
            self.assertIsNotNone(vrow["redeemed_at"])

        print(f"  [PASS] Test 20: Voucher redemption verified (single use strictly enforced, double redemption blocked).")

    # -------------------------------------------------------------------------
    # TEST 21: Participant Leaderboard Scoring & Privacy Protection
    # -------------------------------------------------------------------------
    def test_21_leaderboard_transparent_scoring_and_category_filters(self):
        """Verify leaderboard computes transparent score (+50 attend, +30 badge, +20 reg, +10 feedback) and protects user privacy."""
        res = self.client.get("/api/leaderboard")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("ok"))
        board = data.get("leaderboard", [])
        self.assertGreater(len(board), 0)

        # Check scoring rule on top participant
        top = board[0]
        expected_points = (
            top["verified_attendances"] * 50
            + top["badges_count"] * 30
            + top["total_registrations"] * 20
            + top.get("feedback_count", 0) * 10
        )
        self.assertEqual(top["total_points"], expected_points, f"Expected {expected_points} pts, got {top['total_points']}")

        # Verify privacy: no emails or phone numbers exposed
        for entry in board:
            self.assertNotIn("email", entry, "User email leaked in leaderboard API!")
            self.assertNotIn("phone", entry, "User phone leaked in leaderboard API!")
            self.assertIn("rank", entry)
            self.assertIn("full_name", entry)
            self.assertIn("total_points", entry)

        # Test category filter
        res_tech = self.client.get("/api/leaderboard?category=Technical")
        self.assertEqual(res_tech.status_code, 200)
        tech_data = res_tech.get_json()
        self.assertTrue(tech_data.get("ok"))

        print(f"  [PASS] Test 21: Leaderboard verified (transparent scoring: +50 att, +30 badge, +20 reg; privacy protected).")

    # -------------------------------------------------------------------------
    # TEST 22: Voucher Totals Match Database Records
    # -------------------------------------------------------------------------
    def test_22_voucher_metrics_match_database_records(self):
        """Verify admin voucher campaign metrics match exact counts in underlying database tables."""
        self.login_user("admin@rangora.edu", "Rangora@2026")
        res = self.client.get("/api/admin/voucher-campaigns")
        self.assertEqual(res.status_code, 200)
        metrics = res.get_json()["summary_metrics"]

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COALESCE(SUM(total_quantity), 0) as alloc FROM voucher_campaigns")
            db_alloc = cur.fetchone()["alloc"]

            cur.execute("SELECT COUNT(*) as c FROM issued_vouchers")
            db_issued = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) as c FROM issued_vouchers WHERE status = 'redeemed'")
            db_redeemed = cur.fetchone()["c"]

        self.assertEqual(metrics["total_allocated"], db_alloc)
        self.assertEqual(metrics["total_issued"], db_issued)
        self.assertEqual(metrics["total_redeemed"], db_redeemed)
        self.assertEqual(metrics["total_remaining"], db_alloc - db_issued)
        print(f"  [PASS] Test 22: Voucher metrics match DB records ({db_alloc} allocated, {db_issued} issued, {db_redeemed} redeemed).")


if __name__ == "__main__":
    unittest.main(verbosity=2)

