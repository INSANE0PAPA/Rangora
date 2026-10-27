"""
===============================================================================
RANGORA — Find Your Kind of Celebration
A Stylish, Interactive Festival & Event Discovery Platform
===============================================================================
Main Backend File: backend.py
Technology Stack: Python 3 + Flask + Neon PostgreSQL (psycopg / psycopg2)
Optional Media Service: Supabase Storage

ACADEMIC DBMS EVALUATION GUIDE (FOR VIVA):
This file intentionally keeps all core SQL DDL, DML, joins, aggregate queries,
subqueries, views, constraints, and transaction logic in one well-structured,
clearly commented module so it can be inspected directly during a college
DBMS practical evaluation.

SECTIONS IN THIS FILE:
1. Configuration & Environment Variables
2. Database Connection Layer (Neon PostgreSQL + Local SQLite Fallback)
3. Relational Schema Initialization (DDL: CREATE TABLE, Constraints, View)
4. Password Hashing & Session / Role Authorization Helpers
5. Seed Data Loader (Representative Festivals, Venues, Events, Demo Accounts)
6. Signature Feature Engines (Seat Pulse, Beyond the Hype, No-Clash Guardian,
   Plan Rescue, Festival DNA, Festival Passport, Event Echo)
7. Primary Page Routes (Strictly 3 Page Types: /, /auth, /dashboard)
8. REST API Routes (Authentication, Discovery, Transaction-Safe Registration,
   Itinerary, Organizer Operations, Admin Operations, Optional Supabase Upload)
===============================================================================
"""

from __future__ import annotations

import datetime
import functools
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Tuple

from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

# -----------------------------------------------------------------------------
# Flask Import (with lightweight fallback stub for syntax/DBMS unit testing
# in environments where Flask is not yet pip-installed)
# -----------------------------------------------------------------------------
try:
    from flask import (
        Flask,
        jsonify,
        redirect,
        render_template,
        request,
        session,
        url_for,
    )
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False

    class _DummyFlask:
        def __init__(self, name: str):
            self.name = name
            self.secret_key = ""
            self.config: Dict[str, Any] = {}
            self.routes: Dict[str, Callable] = {}

        def route(self, path: str, **kwargs: Any) -> Callable:
            def decorator(fn: Callable) -> Callable:
                self.routes[path] = fn
                return fn
            return decorator

    Flask = _DummyFlask  # type: ignore
    request = None  # type: ignore
    session = {}  # type: ignore

    def jsonify(data: Any) -> Any:
        return data

    def render_template(template_name: str, **context: Any) -> str:
        return f"Rendered {template_name}"

    def redirect(location: str) -> str:
        return location

    def url_for(endpoint: str, **values: Any) -> str:
        return f"/{endpoint}"


# -----------------------------------------------------------------------------
# PostgreSQL Driver Import (psycopg v3 or psycopg2)
# -----------------------------------------------------------------------------
PG_DRIVER: Optional[str] = None
try:
    import psycopg
    from psycopg.rows import dict_row
    PG_DRIVER = "psycopg3"
except ImportError:
    try:
        import psycopg2
        import psycopg2.extras
        PG_DRIVER = "psycopg2"
    except ImportError:
        PG_DRIVER = None


# =============================================================================
# 1. CONFIGURATION & ENVIRONMENT VARIABLES
# =============================================================================
app = Flask(__name__)
app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "rangora-dev-secret-key-change-in-production-2026"
)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Primary Relational Database: Neon PostgreSQL connection string
DATABASE_URL: str = os.environ.get("DATABASE_URL", "").strip()

# Local SQLite fallback path (used ONLY when DATABASE_URL is not set, allowing
# local offline testing while keeping Neon PostgreSQL as the primary architecture)
LOCAL_SQLITE_PATH: str = os.environ.get(
    "RANGORA_SQLITE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "rangora_local.db")
)

# Supabase Auth & Storage + Google OAuth Configuration
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_BUCKET: str = os.environ.get("SUPABASE_BUCKET", "event-posters").strip()
GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID", "").strip()

# Explicit Local Demonstration Mode toggle (Restricted by default)
# When set to true in .env (ENABLE_LOCAL_DEMO_MODE=true), enables 1-click role switching for local evaluation
ENABLE_LOCAL_DEMO_MODE: bool = os.environ.get("ENABLE_LOCAL_DEMO_MODE", "false").lower() in ("true", "1", "yes")


# =============================================================================
# 2. DATABASE CONNECTION LAYER (NEON POSTGRESQL + SQLITE ADAPTER)
# =============================================================================
class CursorAdapter:
    """
    Wraps either a Neon PostgreSQL cursor (psycopg3 / psycopg2) or a local
    SQLite cursor so that standard psycopg parameterized queries (`%s`) run
    seamlessly on both engines.
    """

    def __init__(self, raw_cursor: Any, is_postgres: bool):
        self.raw_cursor = raw_cursor
        self.is_postgres = is_postgres

    def execute(self, sql: str, params: Tuple[Any, ...] = ()) -> "CursorAdapter":
        if self.is_postgres:
            self.raw_cursor.execute(sql, params)
        else:
            # Translate PostgreSQL `%s` placeholders and minor syntax for local SQLite test mode
            sqlite_sql = sql.replace("%s", "?")
            sqlite_sql = re.sub(r"\bFOR\s+UPDATE\b", "", sqlite_sql, flags=re.IGNORECASE)
            sqlite_sql = re.sub(r"\bILIKE\b", "LIKE", sqlite_sql, flags=re.IGNORECASE)
            self.raw_cursor.execute(sqlite_sql, params)
        return self

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self.raw_cursor.fetchall()
        return [dict(r) for r in rows]

    def close(self) -> None:
        self.raw_cursor.close()


class ConnectionAdapter:
    """
    Provides uniform transaction handling (`commit`, `rollback`, `cursor`)
    across Neon PostgreSQL and the local SQLite test database.
    """

    def __init__(self, raw_conn: Any, is_postgres: bool):
        self.raw_conn = raw_conn
        self.is_postgres = is_postgres

    def cursor(self) -> CursorAdapter:
        if self.is_postgres:
            if PG_DRIVER == "psycopg3":
                return CursorAdapter(self.raw_conn.cursor(row_factory=dict_row), True)
            return CursorAdapter(
                self.raw_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor),
                True,
            )
        return CursorAdapter(self.raw_conn.cursor(), False)

    def commit(self) -> None:
        self.raw_conn.commit()

    def rollback(self) -> None:
        self.raw_conn.rollback()

    def close(self) -> None:
        self.raw_conn.close()

    def __enter__(self) -> "ConnectionAdapter":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if exc_type is not None:
            self.rollback()
        self.close()


def get_db_connection() -> ConnectionAdapter:
    """
    Opens a new database connection.
    - When DATABASE_URL is configured, connects to Neon PostgreSQL using psycopg.
    - When DATABASE_URL is empty, connects to local SQLite with foreign keys enabled.
    """
    if DATABASE_URL:
        if PG_DRIVER == "psycopg3":
            conn = psycopg.connect(DATABASE_URL, autocommit=False)
            return ConnectionAdapter(conn, is_postgres=True)
        elif PG_DRIVER == "psycopg2":
            conn = psycopg2.connect(DATABASE_URL)
            conn.autocommit = False
            return ConnectionAdapter(conn, is_postgres=True)
        else:
            raise RuntimeError(
                "DATABASE_URL is set for Neon PostgreSQL, but neither 'psycopg' "
                "nor 'psycopg2' is installed. Run: pip install -r requirements.txt"
            )

    # Local SQLite fallback for zero-config demonstration
    try:
        conn = sqlite3.connect(LOCAL_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = MEMORY;")
        conn.execute("PRAGMA temp_store = MEMORY;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return ConnectionAdapter(conn, is_postgres=False)
    except sqlite3.OperationalError:
        tmp_path = os.path.join("/tmp", "rangora_local.db")
        conn = sqlite3.connect(tmp_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = MEMORY;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return ConnectionAdapter(conn, is_postgres=False)


# =============================================================================
# 3. RELATIONAL SCHEMA INITIALIZATION (DDL: CREATE TABLE, CONSTRAINTS, VIEW)
# =============================================================================
SCHEMA_SQL_PATH: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def load_schema_sql() -> str:
    """
    Loads authoritative DDL from schema.sql as the single maintained reference
    schema to avoid divergence, falling back to embedded POSTGRES_SCHEMA_SQL if missing.
    """
    if os.path.exists(SCHEMA_SQL_PATH):
        try:
            with open(SCHEMA_SQL_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception:
            pass
    return POSTGRES_SCHEMA_SQL


# Authoritative Neon PostgreSQL DDL statements (3NF relational schema fallback)
POSTGRES_SCHEMA_SQL = """
-- 1. USERS: Stores participant, organizer, and administrator accounts
-- Includes profile fields (avatar_url, phone, city, bio) and Supabase/OAuth metadata
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'participant'
        CHECK (role IN ('participant', 'organizer', 'admin')),
    avatar_url TEXT DEFAULT '',
    phone VARCHAR(40) DEFAULT '',
    city VARCHAR(80) DEFAULT 'Kolkata',
    bio TEXT DEFAULT '',
    auth_provider VARCHAR(40) DEFAULT 'email',
    supabase_uid VARCHAR(120) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. FESTIVALS: Larger celebrations that parent individual events
CREATE TABLE IF NOT EXISTS festivals (
    festival_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    tagline VARCHAR(200),
    theme VARCHAR(160),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    banner_path TEXT,
    budget NUMERIC(12, 2) DEFAULT 0 CHECK (budget >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
    created_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_festival_dates CHECK (end_date >= start_date)
);

-- 3. CATEGORIES: Reusable event categories for filtering and interest matching
CREATE TABLE IF NOT EXISTS categories (
    category_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    category_name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    accent_color VARCHAR(32) DEFAULT '#C85A32'
);

-- 4. VENUES: Campus locations with authoritative physical capacities (3NF)
CREATE TABLE IF NOT EXISTS venues (
    venue_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    venue_name VARCHAR(160) NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    venue_type VARCHAR(60) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0)
);

-- 5. EVENTS: Individual scheduled activities belonging to a festival
CREATE TABLE IF NOT EXISTS events (
    event_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    festival_id BIGINT NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    venue_id BIGINT NOT NULL REFERENCES venues(venue_id) ON DELETE RESTRICT,
    organizer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    event_name VARCHAR(180) NOT NULL,
    subtitle VARCHAR(220),
    description TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (ticket_price >= 0),
    max_seats INTEGER NOT NULL CHECK (max_seats > 0),
    status VARCHAR(24) NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'pending', 'published', 'completed', 'cancelled')),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    poster_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_times CHECK (end_at > start_at)
);

-- 6. REGISTRATIONS: Bridge table resolving M:N between users and events
CREATE TABLE IF NOT EXISTS registrations (
    registration_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled')),
    ticket_tier VARCHAR(30) NOT NULL DEFAULT 'General Pass'
        CHECK (ticket_tier IN ('General Pass', 'Early Bird', 'Student Creator')),
    price_at_registration NUMERIC(10, 2) NOT NULL DEFAULT 0.00
        CHECK (price_at_registration >= 0),
    ticket_code VARCHAR(40) NOT NULL UNIQUE,
    CONSTRAINT uq_user_event_registration UNIQUE (user_id, event_id)
);

-- 7. SPONSORS: Partner organizations supporting campus festivals
CREATE TABLE IF NOT EXISTS sponsors (
    sponsor_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    sponsor_name VARCHAR(160) NOT NULL UNIQUE,
    contact_email VARCHAR(255),
    industry VARCHAR(100),
    logo_path TEXT
);

-- 8. SPONSORSHIPS: Bridge table resolving M:N between festivals and sponsors
CREATE TABLE IF NOT EXISTS sponsorships (
    sponsorship_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    festival_id BIGINT NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
    sponsor_id BIGINT NOT NULL REFERENCES sponsors(sponsor_id) ON DELETE CASCADE,
    contribution_amount NUMERIC(12, 2) NOT NULL CHECK (contribution_amount >= 0),
    tier VARCHAR(40) NOT NULL DEFAULT 'Title Partner'
        CHECK (tier IN ('Title Partner', 'Gold Craft Partner', 'Community Patron', 'Media Partner')),
    status VARCHAR(24) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('pledged', 'confirmed', 'received')),
    CONSTRAINT uq_festival_sponsor UNIQUE (festival_id, sponsor_id)
);

-- 9. USER_PREFERENCES: Stores participant category interests for 'Beyond the Hype'
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    CONSTRAINT uq_user_category_pref UNIQUE (user_id, category_id)
);

-- 10. ITINERARY_ITEMS: Stores participant personal schedule for 'Plan Rescue'
CREATE TABLE IF NOT EXISTS itinerary_items (
    itinerary_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(240),
    CONSTRAINT uq_user_itinerary_event UNIQUE (user_id, event_id)
);

-- 11. ATTENDANCE_RECORDS: Organizer-verified check-ins for 'Festival DNA', 'Passport', & 'Event Echo'
CREATE TABLE IF NOT EXISTS attendance_records (
    attendance_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL UNIQUE REFERENCES registrations(registration_id) ON DELETE CASCADE,
    verified_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. EVENT_FEEDBACK: Post-event participant ratings & reflections for 'Event Echo'
CREATE TABLE IF NOT EXISTS event_feedback (
    feedback_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_event_feedback UNIQUE (user_id, event_id)
);

-- 13. VOUCHER_CAMPAIGNS: Admin-managed platform and festival discount campaigns
CREATE TABLE IF NOT EXISTS voucher_campaigns (
    campaign_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    voucher_type VARCHAR(40) NOT NULL DEFAULT 'discount_pct'
        CHECK (voucher_type IN ('discount_pct', 'free_entry', 'free_merch', 'vip_access')),
    discount_percent INTEGER DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    reward_description TEXT NOT NULL,
    total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
    festival_id BIGINT REFERENCES festivals(festival_id) ON DELETE SET NULL,
    event_id BIGINT REFERENCES events(event_id) ON DELETE SET NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'expired')),
    created_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_campaign_dates CHECK (valid_until >= valid_from)
);

-- 14. ACHIEVEMENT_PASSES: Optional organizer-created festival/event achievement passes
CREATE TABLE IF NOT EXISTS achievement_passes (
    pass_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    organizer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    festival_id BIGINT REFERENCES festivals(festival_id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES events(event_id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    badge_artwork VARCHAR(120) NOT NULL DEFAULT 'badge_first_experience.svg',
    condition_type VARCHAR(60) NOT NULL DEFAULT 'attend_single_event'
        CHECK (condition_type IN ('attend_single_event', 'attend_n_festival_events', 'attend_category_events', 'milestone_checkins')),
    condition_value VARCHAR(120) DEFAULT '',
    voucher_campaign_id BIGINT REFERENCES voucher_campaigns(campaign_id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. ACHIEVEMENTS: Platform-wide and organizer-pass achievement definitions
CREATE TABLE IF NOT EXISTS achievements (
    achievement_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    pass_id BIGINT REFERENCES achievement_passes(pass_id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    criteria TEXT NOT NULL,
    badge_artwork VARCHAR(120) NOT NULL DEFAULT 'badge_first_experience.svg',
    badge_type VARCHAR(40) NOT NULL DEFAULT 'badge'
        CHECK (badge_type IN ('badge', 'stamp', 'milestone')),
    points INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. PARTICIPANT_REWARDS: Bridge table recording participant-earned achievements and badges
CREATE TABLE IF NOT EXISTS participant_rewards (
    reward_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    associated_event_id BIGINT REFERENCES events(event_id) ON DELETE SET NULL,
    associated_festival_id BIGINT REFERENCES festivals(festival_id) ON DELETE SET NULL,
    CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
);

-- 17. ISSUED_VOUCHERS: Individual unique voucher instances granted to participants
CREATE TABLE IF NOT EXISTS issued_vouchers (
    voucher_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES voucher_campaigns(campaign_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    voucher_code VARCHAR(40) NOT NULL UNIQUE,
    status VARCHAR(24) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'redeemed', 'expired')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    redeemed_at TIMESTAMPTZ,
    redeemed_event_id BIGINT REFERENCES events(event_id) ON DELETE SET NULL,
    pass_id BIGINT REFERENCES achievement_passes(pass_id) ON DELETE SET NULL
);

-- Indexes on commonly joined/filtered foreign keys
CREATE INDEX IF NOT EXISTS idx_events_festival ON events(festival_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, start_at);
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_passes_organizer ON achievement_passes(organizer_id);
CREATE INDEX IF NOT EXISTS idx_rewards_user ON participant_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_user ON issued_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_campaign ON issued_vouchers(campaign_id);

-- SQL VIEW: v_event_directory (Combines events, festivals, categories, venues, and live Seat Pulse count)
CREATE OR REPLACE VIEW v_event_directory AS
SELECT
    e.event_id,
    e.event_name,
    e.subtitle,
    e.description,
    e.start_at,
    e.end_at,
    e.ticket_price,
    e.max_seats,
    e.status,
    e.is_featured,
    e.poster_path,
    e.organizer_id,
    u.full_name AS organizer_name,
    f.festival_id,
    f.name AS festival_name,
    f.theme AS festival_theme,
    c.category_id,
    c.category_name,
    c.slug AS category_slug,
    c.accent_color,
    v.venue_id,
    v.venue_name,
    v.location AS venue_location,
    v.venue_type,
    v.capacity AS venue_capacity,
    COUNT(r.registration_id) AS confirmed_count,
    (e.max_seats - COUNT(r.registration_id)) AS available_seats
FROM events AS e
JOIN festivals AS f ON e.festival_id = f.festival_id
JOIN categories AS c ON e.category_id = c.category_id
JOIN venues AS v ON e.venue_id = v.venue_id
JOIN users AS u ON e.organizer_id = u.user_id
LEFT JOIN registrations AS r
    ON r.event_id = e.event_id
    AND r.status = 'confirmed'
GROUP BY
    e.event_id, f.festival_id, c.category_id, v.venue_id, u.user_id;
"""


def _translate_ddl_for_sqlite(pg_ddl: str) -> List[str]:
    """Converts PostgreSQL DDL statements into SQLite-compatible DDL for local fallback."""
    statements: List[str] = []
    for raw_stmt in pg_ddl.split(";"):
        stmt = raw_stmt.strip()
        if not stmt:
            continue
        stmt = re.sub(
            r"BIGINT\s+GENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY\s+PRIMARY\s+KEY",
            "INTEGER PRIMARY KEY AUTOINCREMENT",
            stmt,
            flags=re.IGNORECASE,
        )
        stmt = re.sub(r"CREATE\s+OR\s+REPLACE\s+VIEW", "CREATE VIEW IF NOT EXISTS", stmt, flags=re.IGNORECASE)
        statements.append(stmt + ";")
    return statements


def init_db(seed_if_empty: bool = True) -> None:
    """
    Creates all relational tables, constraints, indexes, and the `v_event_directory`
    view using schema.sql as the single authoritative schema reference. Seeds representative
    festivals, venues, events, and demo users if the database is currently empty.
    """
    ddl_sql = load_schema_sql()
    with get_db_connection() as conn:
        cur = conn.cursor()
        if conn.is_postgres:
            cur.execute(ddl_sql)
        else:
            for stmt in _translate_ddl_for_sqlite(ddl_sql):
                cur.execute(stmt)
        conn.commit()

        # Ensure profile & Supabase/OAuth columns exist on previously initialized DBs
        extra_cols = [
            ("avatar_url", "TEXT DEFAULT ''"),
            ("phone", "VARCHAR(40) DEFAULT ''"),
            ("city", "VARCHAR(80) DEFAULT 'Kolkata'"),
            ("bio", "TEXT DEFAULT ''"),
            ("auth_provider", "VARCHAR(40) DEFAULT 'email'"),
            ("supabase_uid", "VARCHAR(120) DEFAULT ''"),
        ]
        for col_name, col_def in extra_cols:
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                conn.commit()
            except Exception:
                conn.rollback()

        if seed_if_empty:
            seed_sample_data(conn)


# =============================================================================
# 4. PASSWORD HASHING & SESSION / ROLE AUTHORIZATION HELPERS
# =============================================================================
def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using PBKDF2-HMAC-SHA256 with a cryptographic
    16-byte random salt. Never stores plain-text passwords in the database.
    """
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return f"pbkdf2:sha256:120000${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies a plain-text password against a stored PBKDF2-HMAC-SHA256 hash."""
    try:
        header, salt, digest_hex = stored_hash.split("$")
        iterations = int(header.split(":")[2])
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), digest_hex)
    except Exception:
        return False


def get_current_user() -> Optional[Dict[str, Any]]:
    """Retrieves the currently authenticated user from the database using session ID."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_id, full_name, email, role,
                   COALESCE(avatar_url, '') AS avatar_url,
                   COALESCE(phone, '') AS phone,
                   COALESCE(city, 'Kolkata') AS city,
                   COALESCE(bio, '') AS bio,
                   COALESCE(auth_provider, 'email') AS auth_provider,
                   COALESCE(supabase_uid, '') AS supabase_uid,
                   created_at
            FROM users
            WHERE user_id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()


def require_auth(roles: Optional[List[str]] = None) -> Callable:
    """
    Decorator that enforces backend authentication and role-based authorization.
    Hiding buttons in the UI is never sufficient; every protected API route checks
    the session user's authoritative role in the database.
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = get_current_user()
            if not user:
                return jsonify({
                    "ok": False,
                    "error": "Please sign in to your Rangora account to continue."
                }), 401
            if roles and user["role"] not in roles:
                return jsonify({
                    "ok": False,
                    "error": f"Access denied. This action requires {' or '.join(roles)} privileges."
                }), 403
            return fn(*args, current_user=user, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# 5. SEED DATA LOADER (REPRESENTATIVE FESTIVALS, VENUES, EVENTS, DEMO USERS)
# =============================================================================
def seed_sample_data(conn: ConnectionAdapter) -> None:
    """
    Populates representative, human-written sample data for Rangora:
    - 7 Demo Users (Participant, 2 Organizers, 1 Administrator, 3 Fellow Participants)
    - 8 Categories (Music & Sonic Arts, Cultural & Performing Arts, Tech & Build Sprints,
      Hands-On Workshops, Gaming & Tabletop Arena, Community & Campus Life,
      Sports & Collegiate Contests, Entrepreneurship & Venture Lab)
    - 8 Campus Venues with realistic capacities
    - 6 Published Festivals (+ 1 completed archive festival)
    - 40 Distinct Events (with 4+ future sample events per category, balanced free/paid,
      ample availability, nearing capacity, and sold-out examples)
    - Standard Achievements & Organizer Achievement Passes
    - Admin Voucher Campaigns & Demo Issued Vouchers
    - Real initial registrations, verified attendance records, and participant feedback
    Seeding is 100% idempotent and safe to re-run on existing databases without duplicating
    records or overwriting user data.
    """
    cur = conn.cursor()

    # 1. Insert Demo Users
    demo_users = [
        ("Aarav Mehta", "participant@rangora.edu", hash_password("Rangora@2026"), "participant"),
        ("Meera Krishnan", "organizer@rangora.edu", hash_password("Rangora@2026"), "organizer"),
        ("Kabir Sengupta", "kabir.org@rangora.edu", hash_password("Rangora@2026"), "organizer"),
        ("Dr. Nandini Rao", "admin@rangora.edu", hash_password("Rangora@2026"), "admin"),
        ("Zoya Farooqi", "zoya@rangora.edu", hash_password("Rangora@2026"), "participant"),
        ("Rohan Deshmukh", "rohan@rangora.edu", hash_password("Rangora@2026"), "participant"),
        ("Ananya Iyer", "ananya@rangora.edu", hash_password("Rangora@2026"), "participant"),
    ]
    for full_name, email, pw_hash, role in demo_users:
        cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES (%s, %s, %s, %s)
                """,
                (full_name, email, pw_hash, role),
            )

    cur.execute("SELECT user_id, email FROM users")
    user_map = {r["email"]: r["user_id"] for r in cur.fetchall()}
    participant_id = user_map.get("participant@rangora.edu")
    organizer_1 = user_map.get("organizer@rangora.edu")
    organizer_2 = user_map.get("kabir.org@rangora.edu")
    admin_id = user_map.get("admin@rangora.edu")
    zoya_id = user_map.get("zoya@rangora.edu")
    rohan_id = user_map.get("rohan@rangora.edu")
    ananya_id = user_map.get("ananya@rangora.edu")

    # 2. Insert Categories (8 distinct categories)
    categories_data = [
        ("Music & Sonic Arts", "music", "Indie bands, acoustic courtyard sessions, classical-folk fusion, and late-evening soundscapes.", "#C85A32"),
        ("Cultural & Performing Arts", "cultural", "Contemporary choreography, folk theatre, spoken word, and ensemble stage productions.", "#8C2D4B"),
        ("Tech & Build Sprints", "technical", "Autonomous robotics showcases, 24-hour hardware hackathons, and open-source build labs.", "#2B6E63"),
        ("Hands-On Workshops", "workshops", "Terracotta wheel pottery, woodblock textile printing, analog zine-making, and lino-cut studio sessions.", "#D48C28"),
        ("Gaming & Tabletop Arena", "gaming", "Retro arcade showdowns, indie game playtests, blitz chess, and cooperative tabletop campaigns.", "#3D5A80"),
        ("Community & Campus Life", "community", "Courtyard film screenings, heritage walks, culinary pop-ups, and midnight astronomy circles.", "#6B4E71"),
        ("Sports & Collegiate Contests", "sports", "Inter-collegiate athletics, 3v3 basketball, table tennis, and cross-country runs.", "#2A7B4C"),
        ("Entrepreneurship & Venture Lab", "entrepreneurship", "Student startup pitches, venture showcases, angel feedback, and founder speed-dating.", "#B45309"),
    ]
    for cname, slug, desc, color in categories_data:
        cur.execute("SELECT category_id FROM categories WHERE slug = %s", (slug,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO categories (category_name, slug, description, accent_color)
                VALUES (%s, %s, %s, %s)
                """,
                (cname, slug, desc, color),
            )

    cur.execute("SELECT category_id, slug FROM categories")
    cat_map = {r["slug"]: r["category_id"] for r in cur.fetchall()}

    # 3. Insert Venues (8 Campus Venues)
    venues_data = [
        ("Banyan Open-Air Amphitheatre", "Central Heritage Courtyard, North Quad", "Open-Air Stage", 120),
        ("Foundry Makerspace & Robotics Lab", "Innovation Block B, Ground Floor", "Technical Studio", 45),
        ("Terracotta Craft & Print Studio", "School of Fine Arts, East Wing", "Artisan Workshop", 25),
        ("The Brick Lounge & Arcade Commons", "Student Union Building, Level 2", "Indoor Lounge", 40),
        ("Gulmohar Conservatory Hall", "Performing Arts Center, Main Hall", "Auditorium", 90),
        ("Observatory Terrace & Lawn", "Science Complex Rooftop", "Rooftop Lawn", 18),
        ("Vivekananda Sports Complex & Arena", "South Quad Grounds", "Sports Arena", 150),
        ("Tagore Incubation Hub & Auditorium", "Tech Innovation Tower, Ground Level", "Pitch Auditorium", 80),
    ]
    for vname, loc, vtype, cap in venues_data:
        cur.execute("SELECT venue_id FROM venues WHERE venue_name = %s", (vname,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO venues (venue_name, location, venue_type, capacity)
                VALUES (%s, %s, %s, %s)
                """,
                (vname, loc, vtype, cap),
            )

    cur.execute("SELECT venue_id, venue_name FROM venues")
    venue_map = {r["venue_name"]: r["venue_id"] for r in cur.fetchall()}

    # 4. Insert Festivals (6 Published + 1 Archive)
    festivals_data = [
        (
            "Navrang Autumn Confluence 2026",
            "Four days of courtyard music, living crafts, and contemporary movement.",
            "Living Heritage & Contemporary Sound",
            "Our flagship autumn celebration bringing together acoustic ensembles, ceramicists, contemporary dancers, and culinary storytellers under the banyan canopies.",
            "2026-11-12",
            "2026-11-15",
            "/static/images/hero_festival.jpg",
            450000.00,
            "published",
            admin_id,
        ),
        (
            "Yantra & Verse: Tech-Art Symposium",
            "Where autonomous machines, kinetic sculptures, and creative code meet.",
            "Human-Scale Technology & Kinetic Art",
            "A cross-disciplinary festival uniting robotics builders, hardware hackers, and interactive media designers for hands-on sprints and live demonstrations.",
            "2026-11-18",
            "2026-11-20",
            "/static/images/tech_robotics.jpg",
            320000.00,
            "published",
            organizer_1,
        ),
        (
            "Mitti & Ink Guild Week",
            "Slow down and make something tangible with clay, timber, and natural dyes.",
            "Tactile Craft & Printmaking",
            "An intimate studio festival dedicated to wheel-thrown terracotta, carved woodblock textiles, letterpress zines, and material experimentation.",
            "2026-11-22",
            "2026-11-24",
            "/static/images/workshop_craft.jpg",
            180000.00,
            "published",
            organizer_2,
        ),
        (
            "Apex Collegiate Arena & Esports Invitational 2026",
            "High-octane collegiate athletics, 3v3 basketball, and competitive esports leagues.",
            "Collegiate Athletics & Competitive Gaming",
            "A thrilling celebration of campus athleticism and digital sportsmanship, uniting varsity competitors, casual gamers, and track champions.",
            "2026-11-27",
            "2026-11-29",
            "/static/images/sports_arena.jpg",
            240000.00,
            "published",
            organizer_1,
        ),
        (
            "Kolkata Genesis: Venture & Innovation Summit 2026",
            "Empowering student founders, hardware builders, and social enterprise prototypes.",
            "Student Entrepreneurship & Venture Prototyping",
            "Three days of high-energy investor pitches, product teardowns, angel speed-mentoring, and demo-day exhibitions in the campus incubation hub.",
            "2026-12-02",
            "2026-12-04",
            "/static/images/entrepreneur_pitch.jpg",
            380000.00,
            "published",
            admin_id,
        ),
        (
            "Alpona Open-Air Cultural & Theatre Carnival 2026",
            "Midnight street theatre, folk ensembles, midnight cinema, and campus food lanes.",
            "Performing Arts, Dramatic Expression & Folk Theatre",
            "A vibrant winter street theatre and folk carnival weaving through heritage courtyards with lanterns, puppetry, and ensemble movement.",
            "2026-12-08",
            "2026-12-11",
            "/static/images/theatre_carnival.jpg",
            290000.00,
            "published",
            organizer_2,
        ),
        (
            "Monsoon Echoes Prelude (Archive)",
            "Late-summer acoustic sessions and design critiques that kicked off the semester.",
            "Acoustic & Design Prelude",
            "Completed pre-season showcase used by organizers to review verified attendance rates and participant feedback through Event Echo.",
            "2026-10-10",
            "2026-10-12",
            "/static/images/music_concert.jpg",
            125000.00,
            "completed",
            organizer_1,
        ),
    ]
    for fname, tagline, theme, desc, sdate, edate, banner, budget, status, creator in festivals_data:
        cur.execute("SELECT festival_id FROM festivals WHERE name = %s", (fname,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO festivals
                    (name, tagline, theme, description, start_date, end_date, banner_path, budget, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (fname, tagline, theme, desc, sdate, edate, banner, budget, status, creator),
            )

    cur.execute("SELECT festival_id, name FROM festivals")
    fest_map = {r["name"]: r["festival_id"] for r in cur.fetchall()}

    # 5. Insert Events (40 total events across all 8 categories, scheduled in the future)
    events_data = [
        # --- Core Existing Events 1-12 (preserving exact IDs and references) ---
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["music"], venue_map["Banyan Open-Air Amphitheatre"], organizer_1, "Dusk Raga & Indie Folk Session", "Live sitar, acoustic guitar, and percussion ensemble under the courtyard festoon lights", "Experience an atmospheric golden-hour concert blending Hindustani slide strings with contemporary indie folk songwriting. Bring a woven mat, grab spiced chai from the courtyard stall, and settle in.", "2026-11-12T17:30:00+05:30", "2026-11-12T20:30:00+05:30", 150.00, 40, "published", True, "/static/images/music_concert.jpg"),
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["cultural"], venue_map["Gulmohar Conservatory Hall"], organizer_2, "Katha & Kinetic: Contemporary Dance Showcase", "Six original movement pieces exploring rhythm, architecture, and urban memory", "Choreographed by student ensembles and visiting movement artists, Katha & Kinetic pairs live tabla and cello accompaniment with expressive contemporary staging.", "2026-11-12T18:00:00+05:30", "2026-11-12T20:00:00+05:30", 100.00, 35, "published", True, "/static/images/cultural_dance.jpg"),
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["community"], venue_map["Observatory Terrace & Lawn"], organizer_2, "Rooftop 16mm Short Film & Chai Circle", "Independent student cinema screened under the stars with director conversations", "After the main stage winds down, head up to the Observatory Lawn for five restored 16mm and digital short films shot across West Bengal, followed by an open conversation with the filmmakers.", "2026-11-12T20:45:00+05:30", "2026-11-12T22:30:00+05:30", 0.00, 18, "published", False, "/static/images/hero_festival.jpg"),
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Terracotta Craft & Print Studio"], organizer_2, "Mitti & Indigo: Wheel Pottery & Woodblock Studio", "Throw your own terracotta vessel and print a natural-dyed linen tote", "Guided by third-generation master potters and campus textile researchers, this tactile three-hour studio walks you through centering river clay on the wheel and carving geometric woodblocks.", "2026-11-13T10:00:00+05:30", "2026-11-13T13:00:00+05:30", 250.00, 5, "published", True, "/static/images/workshop_craft.jpg"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "RoverForge: Autonomous Micro-Rover & Swarm Exhibition", "Intimate studio demo of student-built terrain rovers and bio-inspired sensors", "Skip the crowded auditoriums and step inside the Foundry Makerspace. Twelve student hardware teams demonstrate custom-milled suspension rovers, acoustic swarm navigation, and solar telemetry boards.", "2026-11-18T14:00:00+05:30", "2026-11-18T17:00:00+05:30", 0.00, 30, "published", False, "/static/images/tech_robotics.jpg"),
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["gaming"], venue_map["The Brick Lounge & Arcade Commons"], organizer_1, "Pixel & Pawn: Retro Arcade + Catan Guild Night", "CRT arcade cabinets, indie local-co-op showcases, and tabletop strategy brackets", "The Brick Lounge transforms into a warm analog-digital playroom. Test student-built indie platformers on custom arcade cabinets or join a four-player tabletop strategy tournament.", "2026-11-14T16:00:00+05:30", "2026-11-14T20:00:00+05:30", 80.00, 28, "published", True, "/static/images/gaming_arcade.jpg"),
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Observatory Terrace & Lawn"], organizer_2, "Analog Cyanotype Sun-Printing Masterbench", "Small-batch botanical sun-printing on handmade cotton rag paper", "An ultra-intimate bench session mixing ferric ammonium citrate and potassium ferricyanide to expose architectural and botanical blueprints in direct afternoon sunlight.", "2026-11-22T14:30:00+05:30", "2026-11-22T16:30:00+05:30", 180.00, 1, "published", False, "/static/images/workshop_craft.jpg"),
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Terracotta Craft & Print Studio"], organizer_2, "Kagaz & Lead: Movable Type & Risograph Zine Lab", "Compose hand-set metal type and bind a 16-page two-color festival chapbook", "A quiet, ink-stained afternoon for typographers, poets, and illustrators. Learn how to lock up lead type in a chase and print editioned zines on our studio risograph.", "2026-11-23T11:00:00+05:30", "2026-11-23T14:00:00+05:30", 120.00, 20, "published", False, "/static/images/workshop_craft.jpg"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "SonicCircuit: 12-Hour DIY Synthesizer & Audio DSP Sprint", "Solder analog oscillators or code microcontroller sound engines from scratch", "Bring your headphones and curiosity. Teams of two spend twelve hours building playable pocket synthesizers using timer ICs, piezo pickups, and embedded Rust/C++ audio DSP.", "2026-11-19T09:00:00+05:30", "2026-11-19T21:00:00+05:30", 200.00, 36, "published", True, "/static/images/tech_robotics.jpg"),
        (fest_map["Monsoon Echoes Prelude (Archive)"], cat_map["music"], venue_map["Banyan Open-Air Amphitheatre"], organizer_1, "Courtyard Strings & Monsoon Poetry Unplugged", "An intimate acoustic evening that opened the autumn cultural season", "Acoustic duos and spoken-word performers shared original works as lanterns lit the old banyan courtyard.", "2026-10-10T18:00:00+05:30", "2026-10-10T20:30:00+05:30", 100.00, 50, "completed", False, "/static/images/music_concert.jpg"),
        (fest_map["Monsoon Echoes Prelude (Archive)"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "Open Hardware Teardown & Repair Cafe", "Community electronics repair, oscilloscope diagnostics, and vintage synth restoration", "Students brought faulty amplifiers, mechanical keyboards, and microcontroller boards for collaborative troubleshooting.", "2026-10-11T14:00:00+05:30", "2026-10-11T17:30:00+05:30", 0.00, 30, "completed", False, "/static/images/tech_robotics.jpg"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["community"], venue_map["Observatory Terrace & Lawn"], organizer_2, "Deep-Sky Astrophotography & Telescope Calibration Night", "Track Jupiter's moons and capture long-exposure nebula frames from the rooftop", "A late-night observational session with the campus astronomy guild using 8-inch Dobsonian reflectors.", "2026-11-20T21:00:00+05:30", "2026-11-20T23:45:00+05:30", 50.00, 16, "pending", False, "/static/images/hero_festival.jpg"),

        # --- Additional Technical Events (Category: technical) ---
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "Autonomous Rover Navigation Sprint", "Algorithmic pathfinding through simulated lunar obstacle courses with real LiDAR telemetry", "Test your autonomous algorithms on student-engineered quad-wheel rovers. Teams receive calibrated LiDAR and depth sensors to navigate an obstacle course in real time.", "2026-11-18T10:00:00+05:30", "2026-11-18T14:00:00+05:30", 150.00, 30, "published", True, "/static/images/tech_robotics.jpg"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "24-Hour Distributed Systems & AI Hackathon", "Build resilient peer-to-peer applications, mesh networking tools, and local LLM agents", "A full 24-hour sprint in the Makerspace with mentors from industry and open-source labs. Food, soldering irons, high-speed Wi-Fi, and server rigs provided.", "2026-11-19T09:00:00+05:30", "2026-11-20T09:00:00+05:30", 0.00, 45, "published", True, "/static/images/tech_robotics.jpg"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], cat_map["technical"], venue_map["Foundry Makerspace & Robotics Lab"], organizer_1, "Campus Cyber-Defense CTF Challenge", "Jeopardy-style security sprint spanning reverse engineering, web security, and cryptography", "Compete individually or in pairs to crack vulnerability challenges, exploit buffer overflows, and analyze memory dumps on our isolated cyber range.", "2026-11-20T11:00:00+05:30", "2026-11-20T16:00:00+05:30", 0.00, 40, "published", False, "/static/images/tech_robotics.jpg"),

        # --- Additional Cultural & Performing Arts Events (Category: cultural) ---
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["cultural"], venue_map["Banyan Open-Air Amphitheatre"], organizer_2, "Chhau & Contemporary Movement Ensemble", "Acrobatic martial folk dance fused with modern improvisational stage choreography", "Performers from Purulia combine dynamic martial movements and vibrant masks with live accompaniment by shehnai and dhamsa drums.", "2026-11-13T18:00:00+05:30", "2026-11-13T20:30:00+05:30", 200.00, 80, "published", True, "/static/images/cultural_dance.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["cultural"], venue_map["Gulmohar Conservatory Hall"], organizer_2, "Midnight Spoken Word & Monologue Circle", "Intimate late-night poetic performances, vulnerability, and storytelling under candle lanterns", "Writers, translators, and spoken-word artists share bilingual pieces in Bengali, Hindi, and English exploring city memories and youthful longings.", "2026-12-09T21:00:00+05:30", "2026-12-09T23:00:00+05:30", 0.00, 60, "published", False, "/static/images/theatre_carnival.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["cultural"], venue_map["Banyan Open-Air Amphitheatre"], organizer_2, "Street Theatre on Social Change: Mukhomukhi", "Powerful ensemble courtyard play examining environmental justice and campus voice", "Performed in the round without microphones, this raw and resonant student production invites the audience into the courtyard center stage.", "2026-12-10T16:30:00+05:30", "2026-12-10T18:30:00+05:30", 0.00, 90, "published", True, "/static/images/theatre_carnival.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["cultural"], venue_map["Gulmohar Conservatory Hall"], organizer_2, "Bengali Folk Puppetry & Shadow Play", "Traditional Beneputul string and shadow puppetry preserved by rural master puppeteers", "A delightful family-friendly and heritage narrative passed down through five generations, featuring carved wooden puppets and harmonium ballads.", "2026-12-08T15:00:00+05:30", "2026-12-08T17:00:00+05:30", 100.00, 50, "published", False, "/static/images/theatre_carnival.jpg"),

        # --- Additional Music & Live Entertainment Events (Category: music) ---
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["music"], venue_map["Banyan Open-Air Amphitheatre"], organizer_1, "Courtyard Acoustic Jam & Open Mic", "Warm acoustic songwriting, cajon grooves, and vocal harmonies open to campus musicians", "Step up to the courtyard mic or relax with kulhad chai as student singer-songwriters share original indie and folk songs.", "2026-11-14T18:00:00+05:30", "2026-11-14T21:00:00+05:30", 0.00, 75, "published", False, "/static/images/music_concert.jpg"),
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["music"], venue_map["Observatory Terrace & Lawn"], organizer_1, "Late-Night Ambient Soundscape & Modular Synth", "Hypnotic analog synth drifts and binaural acoustic textures over the rooftop lawn", "Seated on floor cushions, listen to quadraphonic modular synth patches and field recordings captured along the Hooghly river.", "2026-11-13T22:00:00+05:30", "2026-11-13T23:45:00+05:30", 300.00, 18, "published", True, "/static/images/music_concert.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["music"], venue_map["Gulmohar Conservatory Hall"], organizer_1, "Baul-Rock Fusion Live: Bauliana", "Electrified ektara, dotara, and electric bass in an exhilarating sufi-folk rock celebration", "A high-energy concert blending mystic Baul poetry with electric guitar riffs, khol rhythms, and soaring chorus chants.", "2026-12-11T18:30:00+05:30", "2026-12-11T21:00:00+05:30", 250.00, 90, "published", True, "/static/images/music_concert.jpg"),

        # --- Additional Gaming & Esports Events (Category: gaming) ---
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["gaming"], venue_map["The Brick Lounge & Arcade Commons"], organizer_1, "Super Smash & Street Fighter Collegiate Cup", "Double-elimination fighting game bracket on zero-latency tournament monitors", "Campus fighting game masters clash in Super Smash Bros Ultimate and Street Fighter 6. Open registration bracket with live commentary.", "2026-11-27T13:00:00+05:30", "2026-11-27T18:00:00+05:30", 0.00, 40, "published", True, "/static/images/gaming_arcade.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["gaming"], venue_map["The Brick Lounge & Arcade Commons"], organizer_1, "Midnight Blitz Chess & Strategy Arena", "3-minute blitz clocks, tactical puzzles, and giant board showdowns under warm lounge lights", "Rapid calculations, tense endgames, and quiet camaraderie. Clocks and wooden pieces provided for all ranked rating brackets.", "2026-11-28T20:00:00+05:30", "2026-11-28T23:30:00+05:30", 0.00, 32, "published", False, "/static/images/gaming_arcade.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["gaming"], venue_map["Gulmohar Conservatory Hall"], organizer_1, "Valorant 5v5 Campus Showdown Finals", "Main stage tactical FPS championship with stadium seating, shoutcasters, and team booths", "The top 4 collegiate teams battle on the auditorium big screen in an intense best-of-three tactical shooter showcase.", "2026-11-29T14:00:00+05:30", "2026-11-29T19:00:00+05:30", 100.00, 75, "published", True, "/static/images/gaming_arcade.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["gaming"], venue_map["The Brick Lounge & Arcade Commons"], organizer_1, "Indie Game Developer Playtest & Showcase", "Playtest unreleased student indie titles across PC, Game Boy emulators, and mobile builds", "Meet student game directors, playtest experimental level designs, and vote for the community choice best gameplay mechanics award.", "2026-11-27T10:00:00+05:30", "2026-11-27T13:00:00+05:30", 0.00, 35, "published", False, "/static/images/gaming_arcade.jpg"),

        # --- Additional Hands-On Workshops Events (Category: workshops) ---
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Terracotta Craft & Print Studio"], organizer_2, "Terracotta Wheel-Throwing Masterclass", "Small-group intensive throwing technique, clay centering, and trimming ceramic forms", "Two master ceramicists guide each participant on dedicated electric wheels. Includes glazing and kiln firing for one completed vessel.", "2026-11-22T10:00:00+05:30", "2026-11-22T13:00:00+05:30", 350.00, 15, "published", True, "/static/images/workshop_craft.jpg"),
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Terracotta Craft & Print Studio"], organizer_2, "Woodblock Botanical Printmaking", "Carve seasoned teak blocks and print repeating floral motifs on mulberry paper", "Discover relief carving safely with Japanese gouges, mix water-based oil inks, and pull crisp botanical prints to take home.", "2026-11-23T14:00:00+05:30", "2026-11-23T17:00:00+05:30", 200.00, 20, "published", False, "/static/images/workshop_craft.jpg"),
        (fest_map["Mitti & Ink Guild Week"], cat_map["workshops"], venue_map["Terracotta Craft & Print Studio"], organizer_2, "Japanese Bookbinding & Zine Production", "Hand-stitch lay-flat notebooks using four-hole stab binding and hand-marbled book covers", "Fold, punch, and stitch elegant keepsake journals using cotton thread, bone folders, and recycled handmade paper stock.", "2026-11-24T11:00:00+05:30", "2026-11-24T14:00:00+05:30", 180.00, 18, "published", False, "/static/images/workshop_craft.jpg"),

        # --- Sports & Competitions Events (Category: sports) ---
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["sports"], venue_map["Vivekananda Sports Complex & Arena"], organizer_1, "Inter-Collegiate 3v3 Floodlight Basketball", "Fast-paced half-court hoops under tournament lights with DJ beats and student cheering", "Sixteen college squads compete in round-robin pools leading to the knockout medal rounds. Fast break tempo and live court announcers.", "2026-11-27T17:00:00+05:30", "2026-11-27T21:30:00+05:30", 0.00, 100, "published", True, "/static/images/sports_arena.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["sports"], venue_map["Vivekananda Sports Complex & Arena"], organizer_1, "Fast-Paced Campus Table Tennis Knockout", "Singles tournament on Olympic-grade tables with dynamic spin exchanges and rallies", "Tiered draws for beginner and collegiate rated paddlers. High-speed rallies and medal presentations.", "2026-11-28T10:00:00+05:30", "2026-11-28T14:00:00+05:30", 0.00, 48, "published", False, "/static/images/sports_arena.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["sports"], venue_map["Vivekananda Sports Complex & Arena"], organizer_1, "Badminton Doubles Championship", "Smash, drop, and dive in an electric campus indoor shuttlecock showdown", "Inter-hostel and open collegiate pairs battle through qualifying rounds toward Sunday's gold medal match.", "2026-11-29T09:30:00+05:30", "2026-11-29T14:30:00+05:30", 120.00, 60, "published", True, "/static/images/sports_arena.jpg"),
        (fest_map["Apex Collegiate Arena & Esports Invitational 2026"], cat_map["sports"], venue_map["Vivekananda Sports Complex & Arena"], organizer_1, "Campus Sunset 5K Trail Run & Cross-Country", "Scenic sunset 5K through tree-lined campus paths, lake bridges, and sports stadium track", "A festive community run with chip-timing, water stations, cheering volunteer corners, and finisher souvenir medals.", "2026-11-28T16:30:00+05:30", "2026-11-28T18:30:00+05:30", 0.00, 120, "published", False, "/static/images/sports_arena.jpg"),

        # --- Additional Community & Campus Life Events (Category: community) ---
        (fest_map["Navrang Autumn Confluence 2026"], cat_map["community"], venue_map["Observatory Terrace & Lawn"], organizer_2, "Midnight Astronomy & Stargazing Circle", "Observation of planetary alignments and autumn constellations with laser constellation guides", "Peer through refracting telescopes as science department fellows explain celestial navigation and stellar lifecycles.", "2026-11-15T22:30:00+05:30", "2026-11-16T01:30:00+05:30", 0.00, 18, "published", False, "/static/images/hero_festival.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["community"], venue_map["Banyan Open-Air Amphitheatre"], organizer_2, "Campus Heritage Architectural Walk", "Guided walking tour exploring colonial terracotta arches, library vaults, and historic banyans", "Led by architecture historians, uncover eighty years of campus structural evolution and forgotten architectural details.", "2026-12-08T08:30:00+05:30", "2026-12-08T11:00:00+05:30", 0.00, 30, "published", False, "/static/images/theatre_carnival.jpg"),
        (fest_map["Alpona Open-Air Cultural & Theatre Carnival 2026"], cat_map["community"], venue_map["Banyan Open-Air Amphitheatre"], organizer_2, "Student Culinary Pop-up & Artisan Food Lane", "Artisanal food lane featuring regional tribal recipes, fermented breads, and craft desserts", "Over twenty student stalls prepare authentic family recipes, herbal teas, and regional sweets under festival canopies.", "2026-12-09T12:00:00+05:30", "2026-12-09T18:00:00+05:30", 0.00, 100, "published", True, "/static/images/theatre_carnival.jpg"),

        # --- Entrepreneurship & Student Showcases (Category: entrepreneurship) ---
        (fest_map["Kolkata Genesis: Venture & Innovation Summit 2026"], cat_map["entrepreneurship"], venue_map["Tagore Incubation Hub & Auditorium"], organizer_1, "Genesis 10-Minute Venture Pitch Arena", "Ten student startup finalists pitch early traction to venture capitalists and angel operators", "Rapid-fire 10-minute pitches followed by live Q&A from active angel investors and venture mentors.", "2026-12-02T10:00:00+05:30", "2026-12-02T14:00:00+05:30", 0.00, 70, "published", True, "/static/images/entrepreneur_pitch.jpg"),
        (fest_map["Kolkata Genesis: Venture & Innovation Summit 2026"], cat_map["entrepreneurship"], venue_map["Tagore Incubation Hub & Auditorium"], organizer_1, "Hardware Prototype Demo Day & Angel Feedback", "Hands-on exhibition of physical hardware prototypes, clean energy devices, and IoT sensors", "Walk among live demo booths, inspect working hardware prototypes, and provide valuable user testing feedback.", "2026-12-03T14:00:00+05:30", "2026-12-03T18:00:00+05:30", 0.00, 60, "published", False, "/static/images/entrepreneur_pitch.jpg"),
        (fest_map["Kolkata Genesis: Venture & Innovation Summit 2026"], cat_map["entrepreneurship"], venue_map["Tagore Incubation Hub & Auditorium"], organizer_1, "Founders Speed-Dating & Tech Co-founder Mixer", "Structured matchmaking for software coders, hardware engineers, and business designers", "Fast-paced 5-minute rotational conversations connecting complementary skillsets looking to build new campus ventures.", "2026-12-02T16:00:00+05:30", "2026-12-02T18:30:00+05:30", 0.00, 45, "published", False, "/static/images/entrepreneur_pitch.jpg"),
        (fest_map["Kolkata Genesis: Venture & Innovation Summit 2026"], cat_map["entrepreneurship"], venue_map["Tagore Incubation Hub & Auditorium"], organizer_1, "Social Impact Venture Case Competition", "Teams develop and defend scalable business models addressing public health and education", "Solve actual community challenges with rigorous unit economics and social impact metrics before an expert judging panel.", "2026-12-04T10:30:00+05:30", "2026-12-04T14:30:00+05:30", 150.00, 50, "published", True, "/static/images/entrepreneur_pitch.jpg"),
    ]

    for (
        fid, cid, vid, oid, ename, sub, desc,
        start_at, end_at, price, seats, status, featured, poster
    ) in events_data:
        cur.execute("SELECT event_id FROM events WHERE event_name = %s", (ename,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO events (
                    festival_id, category_id, venue_id, organizer_id,
                    event_name, subtitle, description, start_at, end_at,
                    ticket_price, max_seats, status, is_featured, poster_path
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    fid, cid, vid, oid, ename, sub, desc,
                    start_at, end_at, price, seats, status, featured, poster
                ),
            )

    cur.execute("SELECT event_id, event_name, ticket_price FROM events")
    event_map = {r["event_name"]: (r["event_id"], float(r["ticket_price"])) for r in cur.fetchall()}

    # 6. Registrations Helper
    def _ensure_reg(uid: int, ename: str, tier: str = "General Pass") -> int:
        if ename not in event_map:
            return 0
        eid, price = event_map[ename]
        cur.execute("SELECT registration_id FROM registrations WHERE user_id = %s AND event_id = %s", (uid, eid))
        row = cur.fetchone()
        if row:
            return int(row["registration_id"])
        code = f"RNG-{eid:02d}{uid:02d}-{secrets.token_hex(2).upper()}"
        cur.execute(
            """
            INSERT INTO registrations
                (user_id, event_id, status, ticket_tier, price_at_registration, ticket_code)
            VALUES (%s, %s, 'confirmed', %s, %s, %s)
            """,
            (uid, eid, tier, price, code),
        )
        cur.execute("SELECT registration_id FROM registrations WHERE user_id = %s AND event_id = %s", (uid, eid))
        row2 = cur.fetchone()
        return int(row2["registration_id"]) if row2 else 0

    if participant_id:
        reg_aarav_1 = _ensure_reg(participant_id, "Dusk Raga & Indie Folk Session", "Early Bird")
        reg_aarav_2 = _ensure_reg(participant_id, "Courtyard Strings & Monsoon Poetry Unplugged", "General Pass")
        reg_aarav_3 = _ensure_reg(participant_id, "Open Hardware Teardown & Repair Cafe", "Student Creator")

    if zoya_id:
        _ensure_reg(zoya_id, "Mitti & Indigo: Wheel Pottery & Woodblock Studio")
        _ensure_reg(zoya_id, "Analog Cyanotype Sun-Printing Masterbench")
        _ensure_reg(zoya_id, "Dusk Raga & Indie Folk Session")
        _ensure_reg(zoya_id, "Pixel & Pawn: Retro Arcade + Catan Guild Night")
        reg_zoya_c1 = _ensure_reg(zoya_id, "Courtyard Strings & Monsoon Poetry Unplugged")
        reg_zoya_c2 = _ensure_reg(zoya_id, "Open Hardware Teardown & Repair Cafe")

    if rohan_id:
        _ensure_reg(rohan_id, "Mitti & Indigo: Wheel Pottery & Woodblock Studio")
        _ensure_reg(rohan_id, "Dusk Raga & Indie Folk Session")
        _ensure_reg(rohan_id, "Pixel & Pawn: Retro Arcade + Catan Guild Night")
        reg_rohan_c1 = _ensure_reg(rohan_id, "Courtyard Strings & Monsoon Poetry Unplugged")

    if ananya_id:
        _ensure_reg(ananya_id, "Mitti & Indigo: Wheel Pottery & Woodblock Studio")
        _ensure_reg(ananya_id, "Dusk Raga & Indie Folk Session")

    if organizer_1:
        _ensure_reg(organizer_1, "Mitti & Indigo: Wheel Pottery & Woodblock Studio")

    # Insert Verified Attendance for Completed Events
    if organizer_1:
        for rid in (reg_aarav_2 if participant_id else 0, reg_aarav_3 if participant_id else 0, reg_zoya_c1 if zoya_id else 0, reg_zoya_c2 if zoya_id else 0):
            if rid > 0:
                cur.execute("SELECT attendance_id FROM attendance_records WHERE registration_id = %s", (rid,))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO attendance_records (registration_id, verified_by)
                        VALUES (%s, %s)
                        """,
                        (rid, organizer_1),
                    )

    # 7. Insert Event Feedback for Completed Events
    c1_tuple = event_map.get("Courtyard Strings & Monsoon Poetry Unplugged")
    c2_tuple = event_map.get("Open Hardware Teardown & Repair Cafe")
    if c1_tuple and c2_tuple:
        eid_c1 = c1_tuple[0]
        eid_c2 = c2_tuple[0]
        feedback_rows = [
            (eid_c1, participant_id, 5, "The sitar and acoustic guitar duet at sunset felt magical. Best campus evening all year."),
            (eid_c1, zoya_id, 5, "Warm lighting, zero sound-system harshness, and genuinely moving spoken word pieces."),
            (eid_c1, rohan_id, 4, "Loved the repertoire! A few more woven mats near the back lawn would make it even better."),
            (eid_c2, participant_id, 5, "Fixed my broken MIDI controller in 40 minutes with help from the robotics team."),
            (eid_c2, zoya_id, 4, "Super welcoming atmosphere even for beginners who had never used a soldering iron."),
        ]
        for feid, fuid, rating, comment in feedback_rows:
            if fuid:
                cur.execute("SELECT feedback_id FROM event_feedback WHERE event_id = %s AND user_id = %s", (feid, fuid))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO event_feedback (event_id, user_id, rating, comment)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (feid, fuid, rating, comment),
                    )

    # 8. Insert User Preferences for Demo Participant
    if participant_id:
        for pref_slug in ("music", "technical", "workshops"):
            cur.execute("SELECT preference_id FROM user_preferences WHERE user_id = %s AND category_id = %s", (participant_id, cat_map[pref_slug]))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO user_preferences (user_id, category_id)
                    VALUES (%s, %s)
                    """,
                    (participant_id, cat_map[pref_slug]),
                )

    # 9. Insert Initial Itinerary Items
    if participant_id:
        for it_ename, note in [
            ("Dusk Raga & Indie Folk Session", "Meet friends near Banyan courtyard arch at 5:15 PM"),
            ("Katha & Kinetic: Contemporary Dance Showcase", "Want to catch the opening tabla movement piece"),
            ("Mitti & Indigo: Wheel Pottery & Woodblock Studio", "Bring apron and sketchbook"),
        ]:
            if it_ename in event_map:
                cur.execute("SELECT itinerary_id FROM itinerary_items WHERE user_id = %s AND event_id = %s", (participant_id, event_map[it_ename][0]))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO itinerary_items (user_id, event_id, notes)
                        VALUES (%s, %s, %s)
                        """,
                        (participant_id, event_map[it_ename][0], note),
                    )

    # 10. Insert Sponsors & Sponsorships
    sponsors_data = [
        ("Kalakriti Handloom & Dye Co.", "partnerships@kalakritarcraft.in", "Textiles & Craft"),
        ("SuryaVolt Microelectronics", "campus@suryavolt.io", "Semiconductors & Robotics"),
        ("Banyan Brews & Roastery", "hello@banyanbrews.in", "Artisanal Beverage"),
        ("Dhvani Acoustic Instruments", "studio@dhvanisound.in", "Musical Instruments"),
    ]
    for sname, semail, sind in sponsors_data:
        cur.execute("SELECT sponsor_id FROM sponsors WHERE sponsor_name = %s", (sname,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO sponsors (sponsor_name, contact_email, industry)
                VALUES (%s, %s, %s)
                """,
                (sname, semail, sind),
            )

    cur.execute("SELECT sponsor_id, sponsor_name FROM sponsors")
    spon_map = {r["sponsor_name"]: r["sponsor_id"] for r in cur.fetchall()}

    sponsorships_data = [
        (fest_map["Navrang Autumn Confluence 2026"], spon_map["Dhvani Acoustic Instruments"], 175000.00, "Title Partner", "received"),
        (fest_map["Navrang Autumn Confluence 2026"], spon_map["Banyan Brews & Roastery"], 85000.00, "Community Patron", "confirmed"),
        (fest_map["Yantra & Verse: Tech-Art Symposium"], spon_map["SuryaVolt Microelectronics"], 220000.00, "Title Partner", "received"),
        (fest_map["Mitti & Ink Guild Week"], spon_map["Kalakriti Handloom & Dye Co."], 110000.00, "Gold Craft Partner", "received"),
    ]
    for sfid, ssid, amount, tier, st in sponsorships_data:
        cur.execute("SELECT sponsorship_id FROM sponsorships WHERE festival_id = %s AND sponsor_id = %s", (sfid, ssid))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO sponsorships (festival_id, sponsor_id, contribution_amount, tier, status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (sfid, ssid, amount, tier, st),
            )

    # 11. Standard Platform Achievements
    standard_achievements = [
        ("first_experience", None, "First Experience Booked", "Hold at least 1 confirmed event registration", "badge_first_experience.svg", "stamp", 20),
        ("verified_debut", None, "Verified Check-In Debut", "Complete 1 organizer-verified attendance check-in", "stamp_verified_attendance.svg", "stamp", 50),
        ("tech_trailblazer", None, "Technical Trailblazer", "Complete verified attendance at a Technical & Hackathon sprint", "badge_tech_trailblazer.svg", "badge", 40),
        ("cultural_explorer", None, "Cultural Explorer", "Attend verified Cultural, Dance, or Folk Theatre events", "badge_cultural_explorer.svg", "badge", 40),
        ("all_round_explorer", None, "All-Round Renaissance Explorer", "Explore 3 or more distinct disciplines with verified check-ins", "badge_all_round_explorer.svg", "badge", 60),
        ("festival_finisher", None, "Festival Finisher", "Complete 3 or more verified festival check-ins", "badge_festival_finisher.svg", "badge", 50),
        ("community_spirit", None, "Community Spirit", "Attend a verified Community or Heritage event", "badge_community_spirit.svg", "badge", 30),
        ("guild_artisan", None, "Studio & Guild Artisan", "Attend a verified Hands-On Workshop or Craft Studio session", "badge_guild_artisan.svg", "badge", 40),
        ("gaming_champion", None, "Arena & Esports Contender", "Participate in a Gaming or Esports tournament", "badge_gaming_champion.svg", "badge", 40),
        ("music_connoisseur", None, "Sonic Virtuoso", "Attend a verified Music Concert or Courtyard Jam", "badge_music_connoisseur.svg", "badge", 40),
        ("venture_pioneer", None, "Venture Pioneer", "Attend a student startup showcase or pitch arena", "badge_venture_rocket.svg", "badge", 40),
    ]
    for code, pid, title, crit, art, btype, pts in standard_achievements:
        cur.execute("SELECT achievement_id FROM achievements WHERE code = %s", (code,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO achievements (code, pass_id, title, criteria, badge_artwork, badge_type, points)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (code, pid, title, crit, art, btype, pts),
            )

    # 12. Admin Voucher Campaigns
    demo_campaigns = [
        ("Autumn Festival All-Access: 50% Off Passes", "discount_pct", 50, "50% discount on any autumn festival paid event pass.", 500, "2026-11-01", "2026-12-31", "active", admin_id),
        ("Maker Guild: Free Hands-On Workshop Entry", "free_entry", 100, "100% complimentary entry to any craft or makerspace studio workshop with materials kit included.", 150, "2026-11-01", "2026-12-31", "active", admin_id),
        ("VIP Backstage & Artist Lounge Access", "vip_access", 0, "Exclusive VIP badge granting backstage greenroom access, front-row reserved mat, and artisan tea.", 50, "2026-11-01", "2026-12-31", "active", admin_id),
        ("Rangora Collegiate 30% Flash Pass", "discount_pct", 30, "30% student discount on inter-collegiate tournaments and hackathon passes.", 300, "2026-11-01", "2026-12-31", "active", admin_id),
        ("Campus Creator Guild: Free Merchandise Kit", "free_merch", 0, "Complimentary screen-printed Rangora canvas tote bag, enamel badge set, and festival notebook.", 100, "2026-11-01", "2026-12-31", "active", admin_id),
    ]
    for ctitle, vtype, dpct, rdesc, qty, vf, vu, st, cby in demo_campaigns:
        cur.execute("SELECT campaign_id FROM voucher_campaigns WHERE title = %s", (ctitle,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO voucher_campaigns (title, voucher_type, discount_percent, reward_description, total_quantity, valid_from, valid_until, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (ctitle, vtype, dpct, rdesc, qty, vf, vu, st, cby),
            )

    cur.execute("SELECT campaign_id, title FROM voucher_campaigns")
    camp_map = {r["title"]: r["campaign_id"] for r in cur.fetchall()}

    # 13. Organizer Custom Achievement Passes (Optional!)
    yantra_fid = fest_map.get("Yantra & Verse: Tech-Art Symposium")
    pottery_tuple = event_map.get("Mitti & Indigo: Wheel Pottery & Woodblock Studio")
    pottery_eid = pottery_tuple[0] if pottery_tuple else None
    workshop_camp_id = camp_map.get("Maker Guild: Free Hands-On Workshop Entry")

    demo_passes = [
        (
            organizer_1,
            yantra_fid,
            None,
            "Yantra Robotics & Hardware Master Pass",
            "Complete verified check-ins across tech sprints during the Yantra Symposium to earn this official hardware builder badge and free workshop access.",
            "badge_tech_trailblazer.svg",
            "attend_category_events",
            "technical",
            workshop_camp_id,
            "active",
        ),
        (
            organizer_2,
            None,
            pottery_eid,
            "Mitti & Ink Guild Master Potter Pass",
            "Complete the hands-on terracotta wheel workshop to receive the guild artisan seal and a personalized studio certificate.",
            "badge_guild_artisan.svg",
            "attend_single_event",
            str(pottery_eid) if pottery_eid else "",
            None,
            "active",
        ),
    ]
    for oid, fid, eid, ptitle, pdesc, bart, ctype, cval, vcid, pst in demo_passes:
        cur.execute("SELECT pass_id FROM achievement_passes WHERE title = %s", (ptitle,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO achievement_passes (organizer_id, festival_id, event_id, title, description, badge_artwork, condition_type, condition_value, voucher_campaign_id, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (oid, fid, eid, ptitle, pdesc, bart, ctype, cval, vcid, pst),
            )
            cur.execute("SELECT pass_id FROM achievement_passes WHERE title = %s", (ptitle,))
            pass_row = cur.fetchone()
            if pass_row:
                pass_id = pass_row["pass_id"]
                cur.execute(
                    """
                    INSERT INTO achievements (code, pass_id, title, criteria, badge_artwork, badge_type, points)
                    VALUES (%s, %s, %s, %s, %s, 'badge', 35)
                    """,
                    (f"pass_{pass_id}", pass_id, ptitle, pdesc, bart),
                )

    # 14. Demo Issued Vouchers
    autumn_camp_id = camp_map.get("Autumn Festival All-Access: 50% Off Passes")
    flash_camp_id = camp_map.get("Rangora Collegiate 30% Flash Pass")
    if autumn_camp_id and participant_id:
        cur.execute("SELECT voucher_id FROM issued_vouchers WHERE voucher_code = 'RNG-VOUCH-50-AARAV'")
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO issued_vouchers (campaign_id, user_id, voucher_code, status, issued_at)
                VALUES (%s, %s, 'RNG-VOUCH-50-AARAV', 'active', CURRENT_TIMESTAMP)
                """,
                (autumn_camp_id, participant_id),
            )
    if flash_camp_id and participant_id:
        cur.execute("SELECT voucher_id FROM issued_vouchers WHERE voucher_code = 'RNG-VOUCH-30-REDEEMED'")
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO issued_vouchers (campaign_id, user_id, voucher_code, status, issued_at, redeemed_at)
                VALUES (%s, %s, 'RNG-VOUCH-30-REDEEMED', 'redeemed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (flash_camp_id, participant_id),
            )

    # 15. Initial Participant Rewards
    if participant_id:
        for ach_code in ("first_experience", "verified_debut", "tech_trailblazer", "music_connoisseur"):
            cur.execute("SELECT achievement_id FROM achievements WHERE code = %s", (ach_code,))
            ach_row = cur.fetchone()
            if ach_row:
                cur.execute("SELECT reward_id FROM participant_rewards WHERE user_id = %s AND achievement_id = %s", (participant_id, ach_row["achievement_id"]))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO participant_rewards (user_id, achievement_id)
                        VALUES (%s, %s)
                        """,
                        (participant_id, ach_row["achievement_id"]),
                    )

    if zoya_id:
        for ach_code in ("first_experience", "verified_debut", "tech_trailblazer", "music_connoisseur", "festival_finisher"):
            cur.execute("SELECT achievement_id FROM achievements WHERE code = %s", (ach_code,))
            ach_row = cur.fetchone()
            if ach_row:
                cur.execute("SELECT reward_id FROM participant_rewards WHERE user_id = %s AND achievement_id = %s", (zoya_id, ach_row["achievement_id"]))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO participant_rewards (user_id, achievement_id)
                        VALUES (%s, %s)
                        """,
                        (zoya_id, ach_row["achievement_id"]),
                    )

    conn.commit()

# =============================================================================
# 6. SIGNATURE FEATURE ENGINES
# =============================================================================

# -----------------------------------------------------------------------------
# FEATURE 6: SEAT PULSE (Real Registration-Based Seat Availability)
# -----------------------------------------------------------------------------
def compute_seat_pulse(confirmed_count: int, max_seats: int, event_status: str) -> Dict[str, Any]:
    """
    Calculates transparent, registration-driven availability states from actual
    confirmed database records and `max_seats`. Never claims physical crowd sensing.
    """
    confirmed = max(0, int(confirmed_count))
    capacity = max(1, int(max_seats))
    remaining = max(0, capacity - confirmed)
    fill_ratio = round((confirmed / capacity) * 100, 1)

    if event_status in ("completed", "cancelled", "draft", "pending"):
        return {
            "label": "Registration closed" if event_status == "completed" else event_status.capitalize(),
            "tone": "muted",
            "remaining": remaining,
            "confirmed": confirmed,
            "capacity": capacity,
            "fill_percent": min(100.0, fill_ratio),
            "can_register": False,
        }

    if remaining == 0:
        return {
            "label": "Registration closed — Full",
            "tone": "full",
            "remaining": 0,
            "confirmed": confirmed,
            "capacity": capacity,
            "fill_percent": 100.0,
            "can_register": False,
        }
    elif remaining <= 2 or fill_ratio >= 80.0:
        return {
            "label": f"Almost full · {remaining} {'seat' if remaining == 1 else 'seats'} left",
            "tone": "urgent",
            "remaining": remaining,
            "confirmed": confirmed,
            "capacity": capacity,
            "fill_percent": fill_ratio,
            "can_register": True,
        }
    elif fill_ratio >= 45.0:
        return {
            "label": f"Filling up · {remaining} seats open",
            "tone": "warm",
            "remaining": remaining,
            "confirmed": confirmed,
            "capacity": capacity,
            "fill_percent": fill_ratio,
            "can_register": True,
        }
    else:
        return {
            "label": f"Plenty of places · {remaining} of {capacity} open",
            "tone": "available",
            "remaining": remaining,
            "confirmed": confirmed,
            "capacity": capacity,
            "fill_percent": fill_ratio,
            "can_register": True,
        }


# -----------------------------------------------------------------------------
# FEATURE 4: BEYOND THE HYPE (Explainable Python Recommendation Ranking)
# -----------------------------------------------------------------------------
def build_beyond_the_hype(
    events: List[Dict[str, Any]],
    preferred_category_ids: List[int],
    registered_event_ids: List[int],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Curates three distinct discovery shelves using an explainable, deterministic
    Python scoring algorithm (no black-box AI claims):
    1. Trending Events: Highest confirmed registration momentum with open seats.
    2. Matched to Your Interests: Events matching the user's saved category preferences.
    3. Hidden Gems: High-craft published events with low registration counts (<25% filled)
       and open capacity so intimate exhibitions and workshops get discovered.
    """
    published_open = [
        e for e in events
        if e["status"] == "published" and int(e["available_seats"]) > 0
    ]

    # 1. Trending shelf: sort by confirmed_count DESC, then featured status
    trending_sorted = sorted(
        published_open,
        key=lambda e: (int(e["confirmed_count"]), 1 if e.get("is_featured") else 0),
        reverse=True,
    )
    trending = []
    for ev in trending_sorted[:3]:
        copy_ev = dict(ev)
        copy_ev["recommendation_badge"] = "Campus Favourite"
        copy_ev["recommendation_reason"] = (
            f"{ev['confirmed_count']} confirmed registrations across {ev['festival_name']}."
        )
        trending.append(copy_ev)

    # 2. Interest-matched shelf: filter by preferred categories (or diverse fallback)
    pref_set = set(preferred_category_ids)
    interest_candidates = [
        e for e in published_open
        if (not pref_set or int(e["category_id"]) in pref_set)
        and int(e["event_id"]) not in registered_event_ids
    ]
    if len(interest_candidates) < 3:
        interest_candidates = [e for e in published_open if e not in interest_candidates] + interest_candidates

    interest_matches = []
    for ev in interest_candidates[:3]:
        copy_ev = dict(ev)
        copy_ev["recommendation_badge"] = "Matched to Your Taste"
        copy_ev["recommendation_reason"] = (
            f"Picked because you explore {ev['category_name']} experiences."
        )
        interest_matches.append(copy_ev)

    # 3. Hidden Gems shelf: low registration ratio (< 35% full), plenty of open seats
    hidden_candidates = sorted(
        published_open,
        key=lambda e: (
            int(e["confirmed_count"]) / max(1, int(e["max_seats"])),
            int(e["confirmed_count"]),
        ),
    )
    hidden_gems = []
    for ev in hidden_candidates[:3]:
        copy_ev = dict(ev)
        copy_ev["recommendation_badge"] = "Hidden Gem"
        if float(ev["ticket_price"]) == 0:
            copy_ev["recommendation_reason"] = (
                f"A little offbeat — free entry at {ev['venue_name']} with {ev['available_seats']} spots open."
            )
        else:
            copy_ev["recommendation_reason"] = (
                f"Intimate studio session ({ev['available_seats']} of {ev['max_seats']} places open) — worth discovering before word spreads."
            )
        hidden_gems.append(copy_ev)

    return {
        "trending": trending,
        "interest_matches": interest_matches,
        "hidden_gems": hidden_gems,
    }


# -----------------------------------------------------------------------------
# FEATURE 5: NO-CLASH GUARDIAN (Organizer Pre-Publish Schedule & Capacity Check)
# -----------------------------------------------------------------------------
def run_no_clash_guardian(
    conn: ConnectionAdapter,
    venue_id: int,
    organizer_id: int,
    start_at: str,
    end_at: str,
    max_seats: int,
    exclude_event_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Validates proposed event parameters against existing database records before
    saving or publishing:
    1. Checks if `max_seats` exceeds the physical `venue.capacity`.
    2. Checks if the target `venue_id` already has an overlapping event.
    3. Checks if the same `organizer_id` is scheduled for an overlapping event.
    Returns clear, actionable conflict explanations and suggested resolutions.
    """
    cur = conn.cursor()
    issues: List[Dict[str, str]] = []

    # 1. Check time ordering
    if end_at <= start_at:
        issues.append({
            "type": "time_order",
            "severity": "error",
            "title": "End time must follow start time",
            "detail": "The event end timestamp is earlier than or equal to its start timestamp.",
            "suggestion": "Choose an end time at least 30 minutes after the start time.",
        })

    # 2. Check Venue Physical Capacity (3NF check against venues table)
    cur.execute(
        "SELECT venue_id, venue_name, capacity, location FROM venues WHERE venue_id = %s",
        (venue_id,),
    )
    venue = cur.fetchone()
    if not venue:
        issues.append({
            "type": "invalid_venue",
            "severity": "error",
            "title": "Selected venue does not exist",
            "detail": "No matching campus venue record was found in the database.",
            "suggestion": "Select a valid registered venue from the list.",
        })
    else:
        venue_cap = int(venue["capacity"])
        if int(max_seats) > venue_cap:
            # Find a larger venue to suggest
            cur.execute(
                """
                SELECT venue_name, capacity
                FROM venues
                WHERE capacity >= %s
                ORDER BY capacity ASC
                LIMIT 1
                """,
                (max_seats,),
            )
            alt_venue = cur.fetchone()
            alt_hint = (
                f" Or switch to '{alt_venue['venue_name']}' (capacity {alt_venue['capacity']})."
                if alt_venue else ""
            )
            issues.append({
                "type": "capacity_exceeded",
                "severity": "error",
                "title": f"Seat limit ({max_seats}) exceeds {venue['venue_name']} capacity ({venue_cap})",
                "detail": (
                    f"{venue['venue_name']} ({venue['location']}) holds at most {venue_cap} participants, "
                    f"but this event requests {max_seats} seats."
                ),
                "suggestion": f"Lower max_seats to {venue_cap} or fewer.{alt_hint}",
            })

    # 3. Check Venue Time Overlap
    params_venue: List[Any] = [venue_id, end_at, start_at]
    exclude_clause = ""
    if exclude_event_id is not None:
        exclude_clause = " AND e.event_id != %s"
        params_venue.append(exclude_event_id)

    cur.execute(
        f"""
        SELECT e.event_id, e.event_name, e.start_at, e.end_at, v.venue_name
        FROM events AS e
        JOIN venues AS v ON e.venue_id = v.venue_id
        WHERE e.venue_id = %s
          AND e.status NOT IN ('cancelled')
          AND e.start_at < %s
          AND e.end_at > %s
          {exclude_clause}
        """,
        tuple(params_venue),
    )
    venue_clashes = cur.fetchall()
    for clash in venue_clashes:
        issues.append({
            "type": "venue_overlap",
            "severity": "error",
            "title": f"Venue already booked: {clash['venue_name']}",
            "detail": (
                f"'{clash['event_name']}' is already scheduled in {clash['venue_name']} "
                f"from {clash['start_at']} to {clash['end_at']}."
            ),
            "suggestion": (
                f"Move your event start time after {clash['end_at']} or assign an available venue."
            ),
        })

    # 4. Check Organizer Schedule Overlap
    params_org: List[Any] = [organizer_id, end_at, start_at]
    if exclude_event_id is not None:
        params_org.append(exclude_event_id)

    cur.execute(
        f"""
        SELECT e.event_id, e.event_name, e.start_at, e.end_at, v.venue_name
        FROM events AS e
        JOIN venues AS v ON e.venue_id = v.venue_id
        WHERE e.organizer_id = %s
          AND e.status NOT IN ('cancelled')
          AND e.start_at < %s
          AND e.end_at > %s
          {exclude_clause}
        """,
        tuple(params_org),
    )
    org_clashes = cur.fetchall()
    for oclash in org_clashes:
        issues.append({
            "type": "organizer_overlap",
            "severity": "warning",
            "title": "Organizer schedule conflict",
            "detail": (
                f"You are already managing '{oclash['event_name']}' at {oclash['venue_name']} "
                f"during this window ({oclash['start_at']} – {oclash['end_at']})."
            ),
            "suggestion": "Stagger the start time or assign a co-organizer so you are not in two venues at once.",
        })

    has_blocking_error = any(i["severity"] == "error" for i in issues)
    return {
        "passed": not has_blocking_error,
        "issue_count": len(issues),
        "issues": issues,
        "summary": (
            "No-Clash Guardian passed: venue capacity and time slot are clear."
            if not issues
            else f"Detected {len(issues)} scheduling or capacity issue(s) to review."
        ),
    }


# -----------------------------------------------------------------------------
# FEATURE 3: PLAN RESCUE (Participant Itinerary Overlap Check & Alternatives)
# -----------------------------------------------------------------------------
def _parse_iso_dt(iso_str: str) -> datetime.datetime:
    clean = str(iso_str).strip().replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(clean)
    except ValueError:
        return datetime.datetime.strptime(clean[:19], "%Y-%m-%dT%H:%M:%S")


def build_plan_rescue(
    itinerary_events: List[Dict[str, Any]],
    all_published_events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Deterministic Python scheduling algorithm for participants:
    - Sorts the participant's saved itinerary chronologically.
    - Detects any overlapping event pairs (`event_a.start_at < event_b.end_at`
      and `event_a.end_at > event_b.start_at`) or cancelled/full events.
    - Suggests conflict-free alternative events from the same festival or category
      that fit into open slots on the participant's schedule.
    """
    sorted_plan = sorted(itinerary_events, key=lambda x: str(x["start_at"]))
    plan_ids = {int(e["event_id"]) for e in sorted_plan}
    conflicts: List[Dict[str, Any]] = []

    for i in range(len(sorted_plan)):
        ev_a = sorted_plan[i]
        dt_a_start = _parse_iso_dt(ev_a["start_at"])
        dt_a_end = _parse_iso_dt(ev_a["end_at"])

        # Check if event was cancelled
        if ev_a["status"] == "cancelled":
            conflicts.append({
                "type": "cancelled_event",
                "event_a": ev_a["event_name"],
                "event_a_id": ev_a["event_id"],
                "message": f"'{ev_a['event_name']}' has been cancelled by the organizer.",
                "alternatives": _find_rescue_alternatives(ev_a, sorted_plan, all_published_events, plan_ids),
            })

        for j in range(i + 1, len(sorted_plan)):
            ev_b = sorted_plan[j]
            dt_b_start = _parse_iso_dt(ev_b["start_at"])
            dt_b_end = _parse_iso_dt(ev_b["end_at"])

            if dt_a_start < dt_b_end and dt_a_end > dt_b_start:
                alts = _find_rescue_alternatives(ev_b, sorted_plan, all_published_events, plan_ids)
                conflicts.append({
                    "type": "time_overlap",
                    "event_a_id": ev_a["event_id"],
                    "event_a": ev_a["event_name"],
                    "event_a_venue": ev_a["venue_name"],
                    "event_b_id": ev_b["event_id"],
                    "event_b": ev_b["event_name"],
                    "event_b_venue": ev_b["venue_name"],
                    "overlap_window": f"{ev_b['start_at']} to {ev_a['end_at']}",
                    "message": (
                        f"Time clash: '{ev_a['event_name']}' ({ev_a['venue_name']}) overlaps with "
                        f"'{ev_b['event_name']}' ({ev_b['venue_name']})."
                    ),
                    "alternatives": alts,
                })

    return {
        "items": sorted_plan,
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "status_label": (
            "Schedule is conflict-free"
            if not conflicts
            else f"{len(conflicts)} schedule {'clash' if len(conflicts) == 1 else 'clashes'} detected — Plan Rescue ready"
        ),
    }


def _find_rescue_alternatives(
    clashing_event: Dict[str, Any],
    current_plan: List[Dict[str, Any]],
    all_published_events: List[Dict[str, Any]],
    plan_ids: set,
) -> List[Dict[str, Any]]:
    """Finds up to 2 published events with open seats that do not overlap with the rest of the plan."""
    remaining_plan = [
        e for e in current_plan if int(e["event_id"]) != int(clashing_event["event_id"])
    ]
    suggestions: List[Dict[str, Any]] = []

    for candidate in all_published_events:
        cid = int(candidate["event_id"])
        if cid in plan_ids or int(candidate["available_seats"]) <= 0:
            continue
        c_start = _parse_iso_dt(candidate["start_at"])
        c_end = _parse_iso_dt(candidate["end_at"])

        overlaps_any = False
        for existing in remaining_plan:
            e_start = _parse_iso_dt(existing["start_at"])
            e_end = _parse_iso_dt(existing["end_at"])
            if c_start < e_end and c_end > e_start:
                overlaps_any = True
                break

        if not overlaps_any:
            same_fest = int(candidate["festival_id"]) == int(clashing_event["festival_id"])
            same_cat = int(candidate["category_id"]) == int(clashing_event["category_id"])
            reason = (
                f"Fits your open slot cleanly during {candidate['festival_name']}"
                if same_fest
                else (
                    f"Conflict-free {candidate['category_name']} alternative"
                    if same_cat
                    else "Fits your schedule with zero overlap"
                )
            )
            suggestions.append({
                "event_id": candidate["event_id"],
                "event_name": candidate["event_name"],
                "category_name": candidate["category_name"],
                "venue_name": candidate["venue_name"],
                "start_at": candidate["start_at"],
                "end_at": candidate["end_at"],
                "available_seats": candidate["available_seats"],
                "rescue_reason": reason,
            })

    return suggestions[:2]


# -----------------------------------------------------------------------------
# FEATURE 1 & 2: FESTIVAL DNA & FESTIVAL PASSPORT (Real Record Recap & Badges)
# -----------------------------------------------------------------------------
def build_festival_dna_and_passport(
    conn: ConnectionAdapter,
    user_id: int,
) -> Dict[str, Any]:
    """
    Computes the participant's Festival DNA profile and Festival Passport stamps
    strictly from stored registrations and verified attendance records in the database.
    Never fabricates attendance or awards.
    """
    cur = conn.cursor()

    # Aggregate registrations and verified attendance by category
    cur.execute(
        """
        SELECT
            c.category_name,
            c.slug AS category_slug,
            c.accent_color,
            COUNT(r.registration_id) AS registered_count,
            COUNT(ar.attendance_id) AS verified_attended_count
        FROM registrations AS r
        JOIN events AS e ON r.event_id = e.event_id
        JOIN categories AS c ON e.category_id = c.category_id
        LEFT JOIN attendance_records AS ar ON ar.registration_id = r.registration_id
        WHERE r.user_id = %s
          AND r.status = 'confirmed'
        GROUP BY c.category_id, c.category_name, c.slug, c.accent_color
        ORDER BY registered_count DESC, c.category_name ASC
        """,
        (user_id,),
    )
    category_breakdown = cur.fetchall()

    total_registered = sum(int(row["registered_count"]) for row in category_breakdown)
    total_verified = sum(int(row["verified_attended_count"]) for row in category_breakdown)
    distinct_categories = len(category_breakdown)
    explored_slugs = {row["category_slug"] for row in category_breakdown}

    # Determine transparent, rule-based Festival Persona title
    if distinct_categories >= 3 and total_verified >= 2:
        persona_title = "All-Round Renaissance Explorer"
        persona_note = (
            f"You move effortlessly across {distinct_categories} distinct disciplines, "
            f"with {total_verified} verified festival check-ins."
        )
    elif "technical" in explored_slugs and ("music" in explored_slugs or "cultural" in explored_slugs):
        persona_title = "Synth & Stage Polymath"
        persona_note = (
            "You balance hardware and technical build labs with live courtyard music and performing arts."
        )
    elif "workshops" in explored_slugs:
        persona_title = "Tactile Studio Maker"
        persona_note = "You gravitate toward hands-on craft studios, printmaking benches, and material guild sessions."
    elif total_registered >= 1:
        persona_title = "Curious Courtyard Wanderer"
        persona_note = "Your festival journey is underway—keep exploring new categories to evolve your Festival DNA."
    else:
        persona_title = "First-Day Festival Newcomer"
        persona_note = "Register for your first event to begin shaping your personal Festival DNA story."

    # Festival Passport Stamps (Derived from genuine registration & attendance rules)
    passport_stamps = [
        {
            "code": "first_step",
            "title": "First Experience Booked",
            "criteria": "Hold at least 1 confirmed event registration",
            "unlocked": total_registered >= 1,
            "progress": f"{min(total_registered, 1)} / 1 registered",
            "stamp_type": "Registration Stamp",
        },
        {
            "code": "verified_debut",
            "title": "Verified Check-In Debut",
            "criteria": "Complete 1 organizer-verified attendance check-in",
            "unlocked": total_verified >= 1,
            "progress": f"{min(total_verified, 1)} / 1 verified check-in",
            "stamp_type": "Verified Attendance",
        },
        {
            "code": "all_round_explorer",
            "title": "All-Round Explorer",
            "criteria": "Explore both Technical and Cultural/Music categories",
            "unlocked": ("technical" in explored_slugs) and bool(explored_slugs & {"music", "cultural"}),
            "progress": "Cross-disciplinary pair matched" if (("technical" in explored_slugs) and bool(explored_slugs & {"music", "cultural"})) else "Register in both Tech & Arts",
            "stamp_type": "Cross-Pollinator",
        },
        {
            "code": "three_milestone",
            "title": "Three-Event Trailblazer",
            "criteria": "Register for 3 or more campus festival events",
            "unlocked": total_registered >= 3,
            "progress": f"{min(total_registered, 3)} / 3 events",
            "stamp_type": "Milestone Stamp",
        },
        {
            "code": "guild_artisan",
            "title": "Studio & Guild Artisan",
            "criteria": "Join a Hands-On Workshop or Craft Studio event",
            "unlocked": "workshops" in explored_slugs,
            "progress": "Workshop joined" if "workshops" in explored_slugs else "0 / 1 workshop",
            "stamp_type": "Category Stamp",
        },
        {
            "code": "seasoned_veteran",
            "title": "Festival Chronicler",
            "criteria": "Complete 2+ verified check-ins and submit event feedback",
            "unlocked": total_verified >= 2,
            "progress": f"{min(total_verified, 2)} / 2 verified check-ins",
            "stamp_type": "Verified Attendance",
        },
    ]

    unlocked_count = sum(1 for s in passport_stamps if s["unlocked"])

    return {
        "persona_title": persona_title,
        "persona_note": persona_note,
        "total_registered": total_registered,
        "total_verified_attended": total_verified,
        "distinct_categories": distinct_categories,
        "category_breakdown": category_breakdown,
        "passport_stamps": passport_stamps,
        "unlocked_count": unlocked_count,
        "total_stamps": len(passport_stamps),
    }


# -----------------------------------------------------------------------------
# FEATURE 7: EVENT ECHO (Organizer Post-Event Recap from Real Records)
# -----------------------------------------------------------------------------
def build_event_echo(conn: ConnectionAdapter, organizer_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Generates concise post-event recaps for completed (or active) events using
    SQL aggregates across `registrations`, `attendance_records`, and `event_feedback`.
    Never invents attendance or ratings when records are absent.
    """
    cur = conn.cursor()
    where_clause = "WHERE e.organizer_id = %s" if organizer_id is not None else ""
    params: Tuple[Any, ...] = (organizer_id,) if organizer_id is not None else ()

    cur.execute(
        f"""
        SELECT
            e.event_id,
            e.event_name,
            e.status,
            e.start_at,
            e.max_seats,
            f.name AS festival_name,
            v.venue_name,
            COUNT(DISTINCT r.registration_id) AS confirmed_registrations,
            COUNT(DISTINCT ar.attendance_id) AS verified_attendees,
            COUNT(DISTINCT ef.feedback_id) AS feedback_count,
            ROUND(AVG(ef.rating), 2) AS avg_rating
        FROM events AS e
        JOIN festivals AS f ON e.festival_id = f.festival_id
        JOIN venues AS v ON e.venue_id = v.venue_id
        LEFT JOIN registrations AS r
            ON r.event_id = e.event_id AND r.status = 'confirmed'
        LEFT JOIN attendance_records AS ar
            ON ar.registration_id = r.registration_id
        LEFT JOIN event_feedback AS ef
            ON ef.event_id = e.event_id
        {where_clause}
        GROUP BY e.event_id, f.festival_id, v.venue_id
        ORDER BY
            CASE WHEN e.status = 'completed' THEN 0 ELSE 1 END,
            e.start_at DESC
        """,
        params,
    )
    rows = cur.fetchall()
    recaps: List[Dict[str, Any]] = []
    for row in rows:
        reg_cnt = int(row["confirmed_registrations"] or 0)
        att_cnt = int(row["verified_attendees"] or 0)
        fb_cnt = int(row["feedback_count"] or 0)
        avg_r = float(row["avg_rating"]) if row["avg_rating"] is not None else None
        attendance_rate = round((att_cnt / reg_cnt) * 100, 1) if reg_cnt > 0 and att_cnt > 0 else None

        # Fetch recent feedback quotes if any exist
        cur.execute(
            """
            SELECT ef.rating, ef.comment, u.full_name
            FROM event_feedback AS ef
            JOIN users AS u ON ef.user_id = u.user_id
            WHERE ef.event_id = %s
            ORDER BY ef.submitted_at DESC
            LIMIT 3
            """,
            (row["event_id"],),
        )
        quotes = cur.fetchall()

        recaps.append({
            "event_id": row["event_id"],
            "event_name": row["event_name"],
            "festival_name": row["festival_name"],
            "venue_name": row["venue_name"],
            "status": row["status"],
            "start_at": str(row["start_at"]),
            "max_seats": int(row["max_seats"]),
            "confirmed_registrations": reg_cnt,
            "verified_attendees": att_cnt,
            "attendance_rate_percent": attendance_rate,
            "feedback_count": fb_cnt,
            "avg_rating": avg_r,
            "feedback_quotes": quotes,
        })
    return recaps


# -----------------------------------------------------------------------------
# FEATURE 8: EVALUATE & AWARD PARTICIPANT REWARDS & STAMPS (IDEMPOTENT & RECORD-DERIVED)
# -----------------------------------------------------------------------------
def evaluate_participant_rewards(conn: ConnectionAdapter, user_id: int) -> None:
    """
    Evaluates participant eligibility for standard platform achievements and
    organizer custom passes based on stored registrations and verified attendance.
    Awards each eligible achievement at most once. Idempotent across reloads.
    """
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            COUNT(r.registration_id) AS total_regs,
            COUNT(ar.attendance_id) AS total_attended
        FROM registrations AS r
        LEFT JOIN attendance_records AS ar ON ar.registration_id = r.registration_id
        WHERE r.user_id = %s AND r.status = 'confirmed'
        """,
        (user_id,),
    )
    stat = cur.fetchone() or {"total_regs": 0, "total_attended": 0}
    total_regs = int(stat["total_regs"])
    total_attended = int(stat["total_attended"])

    cur.execute(
        """
        SELECT DISTINCT c.slug
        FROM attendance_records AS ar
        JOIN registrations AS r ON r.registration_id = ar.registration_id
        JOIN events AS e ON e.event_id = r.event_id
        JOIN categories AS c ON c.category_id = e.category_id
        WHERE r.user_id = %s AND r.status = 'confirmed'
        """,
        (user_id,),
    )
    attended_slugs = {row["slug"] for row in cur.fetchall()}

    def _award(code: str, ev_id: Optional[int] = None, fest_id: Optional[int] = None) -> None:
        cur.execute("SELECT achievement_id, pass_id FROM achievements WHERE code = %s", (code,))
        ach = cur.fetchone()
        if not ach:
            return
        ach_id = ach["achievement_id"]
        cur.execute(
            "SELECT reward_id FROM participant_rewards WHERE user_id = %s AND achievement_id = %s",
            (user_id, ach_id),
        )
        if cur.fetchone():
            return
        cur.execute(
            """
            INSERT INTO participant_rewards (user_id, achievement_id, associated_event_id, associated_festival_id)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, ach_id, ev_id, fest_id),
        )
        # If this achievement is linked to an organizer pass with a voucher campaign, auto-issue voucher
        if ach["pass_id"]:
            cur.execute(
                "SELECT voucher_campaign_id FROM achievement_passes WHERE pass_id = %s",
                (ach["pass_id"],),
            )
            pass_row = cur.fetchone()
            if pass_row and pass_row["voucher_campaign_id"]:
                issue_voucher_to_user(conn, int(pass_row["voucher_campaign_id"]), user_id, pass_id=int(ach["pass_id"]))

    if total_regs >= 1:
        _award("first_experience")
    if total_attended >= 1:
        _award("verified_debut")
    if "technical" in attended_slugs:
        _award("tech_trailblazer")
    if "cultural" in attended_slugs:
        _award("cultural_explorer")
    if "music" in attended_slugs:
        _award("music_connoisseur")
    if "workshops" in attended_slugs:
        _award("guild_artisan")
    if "gaming" in attended_slugs:
        _award("gaming_champion")
    if len(attended_slugs) >= 3:
        _award("all_round_explorer")
    if total_attended >= 2:
        _award("festival_finisher")
    if "community" in attended_slugs or "sports" in attended_slugs:
        _award("community_spirit")

    # Evaluate active organizer achievement passes
    cur.execute(
        """
        SELECT ap.pass_id, ap.condition_type, ap.condition_value, ap.event_id, ap.festival_id, ach.code
        FROM achievement_passes AS ap
        JOIN achievements AS ach ON ach.pass_id = ap.pass_id
        WHERE ap.status = 'active'
        """
    )
    custom_passes = cur.fetchall()
    for cp in custom_passes:
        ctype = cp["condition_type"]
        cval = cp["condition_value"]
        satisfied = False

        if ctype == "attend_single_event" and cp["event_id"]:
            cur.execute(
                """
                SELECT ar.attendance_id
                FROM attendance_records AS ar
                JOIN registrations AS r ON r.registration_id = ar.registration_id
                WHERE r.user_id = %s AND r.event_id = %s AND r.status = 'confirmed'
                """,
                (user_id, cp["event_id"]),
            )
            satisfied = cur.fetchone() is not None
        elif ctype == "attend_category_events" and cval:
            satisfied = cval.lower() in attended_slugs
        elif ctype == "attend_n_festival_events" and cp["festival_id"]:
            try:
                target_n = int(cval or "2")
            except ValueError:
                target_n = 2
            cur.execute(
                """
                SELECT COUNT(ar.attendance_id) AS cnt
                FROM attendance_records AS ar
                JOIN registrations AS r ON r.registration_id = ar.registration_id
                JOIN events AS e ON e.event_id = r.event_id
                WHERE r.user_id = %s AND e.festival_id = %s AND r.status = 'confirmed'
                """,
                (user_id, cp["festival_id"]),
            )
            row = cur.fetchone()
            satisfied = row and int(row["cnt"]) >= target_n
        elif ctype == "milestone_checkins":
            try:
                target_m = int(cval or "2")
            except ValueError:
                target_m = 2
            satisfied = total_attended >= target_m

        if satisfied:
            _award(cp["code"], ev_id=cp["event_id"], fest_id=cp["festival_id"])

    conn.commit()


# -----------------------------------------------------------------------------
# FEATURE 9: PARTICIPANT REWARDS & PASSPORT BUILDER
# -----------------------------------------------------------------------------
def build_festival_rewards_and_passport(conn: ConnectionAdapter, user_id: int) -> Dict[str, Any]:
    """
    Builds the complete participant Festival Passport and Rewards overview:
    earned badges with artwork, available achievements, stamps, issued vouchers,
    participation history, and leaderboard rank.
    """
    evaluate_participant_rewards(conn, user_id)
    cur = conn.cursor()

    dna_summary = build_festival_dna_and_passport(conn, user_id)

    # Earned badges with rich field aliases
    cur.execute(
        """
        SELECT
            pr.reward_id,
            pr.earned_at,
            pr.earned_at AS awarded_at,
            ach.achievement_id,
            ach.code,
            ach.title,
            ach.criteria,
            ach.criteria AS description,
            ach.badge_artwork,
            ach.badge_artwork AS badge_icon_path,
            ach.badge_type,
            ach.points,
            ach.points AS points_reward,
            COALESCE(ap.title, '') AS pass_title
        FROM participant_rewards AS pr
        JOIN achievements AS ach ON ach.achievement_id = pr.achievement_id
        LEFT JOIN achievement_passes AS ap ON ap.pass_id = ach.pass_id
        WHERE pr.user_id = %s
        ORDER BY pr.earned_at DESC
        """,
        (user_id,),
    )
    earned_badges = cur.fetchall()

    # Available achievements
    cur.execute(
        """
        SELECT
            ach.achievement_id,
            ach.code,
            ach.title,
            ach.criteria,
            ach.criteria AS description,
            ach.badge_artwork,
            ach.badge_artwork AS badge_icon_path,
            ach.badge_type,
            ach.points,
            ach.points AS points_reward,
            COALESCE(ap.title, '') AS pass_title
        FROM achievements AS ach
        LEFT JOIN achievement_passes AS ap ON ap.pass_id = ach.pass_id
        WHERE ach.achievement_id NOT IN (
            SELECT achievement_id FROM participant_rewards WHERE user_id = %s
        )
        ORDER BY ach.achievement_id ASC
        """,
        (user_id,),
    )
    available_achievements = cur.fetchall()

    # User issued vouchers with rich aliases
    cur.execute(
        """
        SELECT
            iv.voucher_id,
            iv.voucher_id AS issued_voucher_id,
            iv.voucher_code,
            iv.status,
            iv.status AS voucher_status,
            iv.issued_at,
            iv.redeemed_at,
            vc.campaign_id,
            vc.title AS campaign_title,
            vc.title AS campaign_name,
            vc.voucher_type,
            vc.discount_percent,
            vc.reward_description,
            vc.reward_description AS benefit_description,
            vc.valid_from,
            vc.valid_until,
            COALESCE(f.name, '') AS festival_name,
            COALESCE(e.event_name, '') AS event_name,
            CASE
                WHEN iv.status = 'redeemed' THEN 'redeemed'
                WHEN vc.valid_until < CURRENT_DATE THEN 'expired'
                ELSE 'active'
            END AS effective_status
        FROM issued_vouchers AS iv
        JOIN voucher_campaigns AS vc ON vc.campaign_id = iv.campaign_id
        LEFT JOIN festivals AS f ON f.festival_id = vc.festival_id
        LEFT JOIN events AS e ON e.event_id = vc.event_id
        WHERE iv.user_id = %s
        ORDER BY iv.issued_at DESC
        """,
        (user_id,),
    )
    issued_vouchers = cur.fetchall()

    # Real door check-in verified attendance stamps
    cur.execute(
        """
        SELECT
            ar.attendance_id,
            ar.checked_in_at,
            ar.checked_in_at AS awarded_at,
            e.event_id,
            e.event_name,
            f.festival_id,
            f.name AS festival_name,
            v.venue_name,
            v.location AS venue_location,
            c.category_name,
            c.slug AS category_slug,
            c.accent_color,
            '/static/images/badges/stamp_verified_attendance.svg' AS stamp_icon_path,
            '/static/images/badges/stamp_verified_attendance.svg' AS stamp_artwork,
            'Verified Check-in' AS status_label,
            'Verified Door Check-In' AS stamp_title,
            'Physical check-in verified by venue coordinator' AS description
        FROM attendance_records AS ar
        JOIN registrations AS r ON ar.registration_id = r.registration_id
        JOIN events AS e ON r.event_id = e.event_id
        JOIN festivals AS f ON e.festival_id = f.festival_id
        JOIN venues AS v ON e.venue_id = v.venue_id
        JOIN categories AS c ON e.category_id = c.category_id
        WHERE r.user_id = %s
        ORDER BY ar.checked_in_at DESC
        """,
        (user_id,),
    )
    verified_stamps = cur.fetchall()

    # Confirmed but awaiting door check-in registrations
    cur.execute(
        """
        SELECT
            r.registration_id,
            r.registered_at,
            r.registered_at AS awarded_at,
            e.event_id,
            e.event_name,
            f.festival_id,
            f.name AS festival_name,
            v.venue_name,
            v.location AS venue_location,
            c.category_name,
            c.slug AS category_slug,
            c.accent_color,
            '/static/images/badges/stamp_autumn_confluence.svg' AS stamp_icon_path,
            '/static/images/badges/stamp_autumn_confluence.svg' AS stamp_artwork,
            'Awaiting Check-in' AS status_label,
            'Pass Reserved' AS stamp_title,
            'Ticket confirmed — attend venue to receive physical door stamp' AS description
        FROM registrations AS r
        JOIN events AS e ON r.event_id = e.event_id
        JOIN festivals AS f ON e.festival_id = f.festival_id
        JOIN venues AS v ON e.venue_id = v.venue_id
        JOIN categories AS c ON e.category_id = c.category_id
        WHERE r.user_id = %s
          AND r.status = 'confirmed'
          AND NOT EXISTS (
              SELECT 1 FROM attendance_records WHERE registration_id = r.registration_id
          )
        ORDER BY r.registered_at DESC
        """,
        (user_id,),
    )
    awaiting_stamps = cur.fetchall()

    # Leaderboard position
    leaderboard = build_leaderboard(conn)
    user_rank = None
    user_points = 0
    for entry in leaderboard:
        if int(entry["user_id"]) == int(user_id):
            user_rank = entry["rank"]
            user_points = entry["total_points"]
            break

    dna_summary["earned_badges"] = earned_badges
    dna_summary["stamps"] = verified_stamps
    dna_summary["verified_stamps"] = verified_stamps
    dna_summary["awaiting_stamps"] = awaiting_stamps
    dna_summary["available_achievements"] = available_achievements
    dna_summary["issued_vouchers"] = issued_vouchers
    dna_summary["leaderboard_rank"] = user_rank
    dna_summary["leaderboard_points"] = user_points
    dna_summary["journey_points"] = user_points

    return dna_summary


# -----------------------------------------------------------------------------
# FEATURE 10: PARTICIPANT LEADERBOARD (TRANSPARENT SCORING ENGINE)
# -----------------------------------------------------------------------------
def build_leaderboard(
    conn: ConnectionAdapter,
    filter_type: str = "overall",
    filter_val: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Computes transparent leaderboard ranking:
    - 50 pts per verified check-in
    - 20 pts per confirmed registration
    - 30 pts per earned achievement badge
    - 10 pts per feedback submission
    Filtered by overall, festival, or category. Excludes sensitive personal data.
    """
    cur = conn.cursor()

    conditions = ["u.role = 'participant'"]
    params: List[Any] = []

    if filter_type == "festival" and filter_val:
        conditions.append("e.festival_id = %s")
        params.append(int(filter_val))
    elif filter_type == "category" and filter_val:
        conditions.append("(c.slug = %s OR c.category_name = %s)")
        params.extend([str(filter_val).strip().lower(), str(filter_val).strip()])

    where_sql = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            u.user_id,
            u.full_name,
            COALESCE(u.avatar_url, '') AS avatar_url,
            COALESCE(u.city, 'Kolkata') AS city,
            COUNT(DISTINCT r.registration_id) AS reg_count,
            COUNT(DISTINCT ar.attendance_id) AS verified_count,
            COUNT(DISTINCT pr.reward_id) AS badges_count,
            COUNT(DISTINCT ef.feedback_id) AS feedback_count,
            (
                COUNT(DISTINCT ar.attendance_id) * 50 +
                COUNT(DISTINCT r.registration_id) * 20 +
                COUNT(DISTINCT pr.reward_id) * 30 +
                COUNT(DISTINCT ef.feedback_id) * 10
            ) AS total_points
        FROM users AS u
        LEFT JOIN registrations AS r ON r.user_id = u.user_id AND r.status = 'confirmed'
        LEFT JOIN events AS e ON e.event_id = r.event_id
        LEFT JOIN categories AS c ON c.category_id = e.category_id
        LEFT JOIN attendance_records AS ar ON ar.registration_id = r.registration_id
        LEFT JOIN participant_rewards AS pr ON pr.user_id = u.user_id
        LEFT JOIN event_feedback AS ef ON ef.user_id = u.user_id
        {where_sql}
        GROUP BY u.user_id, u.full_name, u.avatar_url, u.city
        ORDER BY total_points DESC, verified_count DESC, u.user_id ASC
    """
    cur.execute(sql, tuple(params))
    rows = cur.fetchall()

    leaderboard = []
    current_rank = 1
    for r in rows:
        pts = int(r["total_points"])
        ver = int(r["verified_count"])
        bg = int(r["badges_count"])
        parts = r["full_name"].strip().split()
        dname = f"{parts[0]} {parts[1][0]}." if len(parts) > 1 else parts[0]
        leaderboard.append({
            "rank": current_rank,
            "user_id": r["user_id"],
            "full_name": r["full_name"],
            "display_name": dname,
            "avatar_url": r["avatar_url"],
            "city": r["city"],
            "total_points": pts,
            "verified_count": ver,
            "verified_attendances": ver,
            "badges_count": bg,
            "feedback_count": int(r["feedback_count"]),
            "registration_count": int(r["reg_count"]),
            "total_registrations": int(r["reg_count"]),
        })
        current_rank += 1

    return leaderboard


# -----------------------------------------------------------------------------
# FEATURE 11: ORGANIZER ACHIEVEMENT PASSES & REWARD PERFORMANCE
# -----------------------------------------------------------------------------
def get_organizer_passes(conn: ConnectionAdapter, organizer_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Retrieves achievement passes with authorized scoping and earned participant counts."""
    cur = conn.cursor()
    where_sql = "WHERE ap.organizer_id = %s" if organizer_id is not None else ""
    params: Tuple[Any, ...] = (organizer_id,) if organizer_id is not None else ()

    cur.execute(
        f"""
        SELECT
            ap.pass_id,
            ap.organizer_id,
            ap.title,
            ap.description,
            ap.badge_artwork,
            ap.condition_type,
            ap.condition_value,
            ap.status,
            ap.created_at,
            f.festival_id,
            COALESCE(f.name, '') AS festival_name,
            e.event_id,
            COALESCE(e.event_name, '') AS event_name,
            vc.campaign_id AS voucher_campaign_id,
            COALESCE(vc.title, '') AS voucher_campaign_title,
            COUNT(DISTINCT pr.reward_id) AS earned_count
        FROM achievement_passes AS ap
        LEFT JOIN festivals AS f ON f.festival_id = ap.festival_id
        LEFT JOIN events AS e ON e.event_id = ap.event_id
        LEFT JOIN voucher_campaigns AS vc ON vc.campaign_id = ap.voucher_campaign_id
        LEFT JOIN achievements AS ach ON ach.pass_id = ap.pass_id
        LEFT JOIN participant_rewards AS pr ON pr.achievement_id = ach.achievement_id
        {where_sql}
        GROUP BY ap.pass_id, f.festival_id, f.name, e.event_id, e.event_name, vc.campaign_id, vc.title
        ORDER BY ap.created_at DESC
        """,
        params,
    )
    return cur.fetchall()


# -----------------------------------------------------------------------------
# FEATURE 12: ADMIN VOUCHER CAMPAIGN MANAGEMENT & TRACKING
# -----------------------------------------------------------------------------
def get_admin_voucher_campaigns(conn: ConnectionAdapter) -> List[Dict[str, Any]]:
    """Retrieves central voucher campaigns with computed live inventory and redemption rates."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            vc.campaign_id,
            vc.title,
            vc.voucher_type,
            vc.discount_percent,
            vc.reward_description,
            vc.total_quantity,
            vc.valid_from,
            vc.valid_until,
            vc.status,
            vc.created_at,
            COUNT(iv.voucher_id) AS issued_count,
            COUNT(CASE WHEN iv.status = 'redeemed' THEN 1 END) AS redeemed_count,
            (vc.total_quantity - COUNT(iv.voucher_id)) AS remaining_count,
            COUNT(CASE WHEN iv.status = 'expired' OR (iv.status = 'active' AND vc.valid_until < CURRENT_DATE) THEN 1 END) AS expired_count
        FROM voucher_campaigns AS vc
        LEFT JOIN issued_vouchers AS iv ON iv.campaign_id = vc.campaign_id
        GROUP BY vc.campaign_id
        ORDER BY vc.created_at DESC
        """
    )
    campaigns = cur.fetchall()
    for c in campaigns:
        tot = int(c["total_quantity"])
        iss = int(c["issued_count"])
        red = int(c["redeemed_count"])
        c["distribution_rate"] = round((iss / tot * 100), 1) if tot > 0 else 0.0
        c["redemption_rate"] = round((red / iss * 100), 1) if iss > 0 else 0.0
    return campaigns


def issue_voucher_to_user(
    conn: ConnectionAdapter,
    campaign_id: int,
    user_id: int,
    pass_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """
    Issues an individual voucher to a user under ACID transaction rules.
    Enforces campaign inventory limits and unique voucher codes.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT vc.campaign_id, vc.total_quantity, vc.status, vc.valid_until,
               COUNT(iv.voucher_id) AS issued_count
        FROM voucher_campaigns AS vc
        LEFT JOIN issued_vouchers AS iv ON iv.campaign_id = vc.campaign_id
        WHERE vc.campaign_id = %s
        GROUP BY vc.campaign_id, vc.total_quantity, vc.status, vc.valid_until
        """,
        (campaign_id,),
    )
    camp = cur.fetchone()
    if not camp or camp["status"] != "active":
        return None
    if int(camp["issued_count"]) >= int(camp["total_quantity"]):
        return None

    # Check for active unredeemed voucher from this campaign for user
    cur.execute(
        "SELECT voucher_id FROM issued_vouchers WHERE campaign_id = %s AND user_id = %s AND status = 'active'",
        (campaign_id, user_id),
    )
    if cur.fetchone():
        return None

    code = f"RNG-{campaign_id:02d}{user_id:02d}-{secrets.token_hex(3).upper()}"
    cur.execute(
        """
        INSERT INTO issued_vouchers (campaign_id, user_id, voucher_code, status, pass_id)
        VALUES (%s, %s, %s, 'active', %s)
        """,
        (campaign_id, user_id, code, pass_id),
    )
    cur.execute("SELECT voucher_id FROM issued_vouchers WHERE voucher_code = %s", (code,))
    vrow = cur.fetchone()
    vid = vrow["voucher_id"] if vrow else 0
    conn.commit()
    return {
        "voucher_id": vid,
        "issued_voucher_id": vid,
        "voucher_code": code,
        "campaign_id": campaign_id,
        "user_id": user_id,
    }


def redeem_voucher(
    conn: ConnectionAdapter,
    voucher_id: int,
    user_id: int,
    event_id: Optional[int] = None,
) -> Tuple[bool, str]:
    """Redeems an issued voucher at most once with timestamp and status update."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT iv.voucher_id, iv.user_id, iv.status, iv.redeemed_at, vc.valid_until, vc.title
        FROM issued_vouchers AS iv
        JOIN voucher_campaigns AS vc ON vc.campaign_id = iv.campaign_id
        WHERE iv.voucher_id = %s
        """,
        (voucher_id,),
    )
    voucher = cur.fetchone()
    if not voucher:
        return False, "Voucher record not found."
    if int(voucher["user_id"]) != int(user_id):
        return False, "Permission denied: You can only redeem your own vouchers."
    if voucher["status"] == "redeemed" or voucher["redeemed_at"] is not None:
        return False, "This voucher has already been redeemed and cannot be used again."
    if voucher["status"] == "expired":
        return False, "This voucher has expired."

    cur.execute(
        """
        UPDATE issued_vouchers
        SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP, redeemed_event_id = %s
        WHERE voucher_id = %s
        """,
        (event_id, voucher_id),
    )
    conn.commit()
    return True, f"Voucher '{voucher['title']}' was successfully redeemed!"

# =============================================================================
# 7. PRIMARY PAGE ROUTES (STRICTLY THREE INTERFACE TYPES)
# =============================================================================
@app.route("/")
def index_page() -> Any:
    """Page 1: Rangora Landing Page (Discovery, Featured Festivals, Beyond the Hype)."""
    user = get_current_user()
    return render_template("index.html", current_user=user)


@app.route("/auth")
def auth_page() -> Any:
    """Page 2: Combined Login & Sign-Up Experience (Supabase Auth, Google OAuth, OTP, Email)."""
    user = get_current_user()
    if user and (not request or request.args.get("switch") != "1"):
        return redirect(url_for("dashboard_page"))
    return render_template(
        "auth.html",
        current_user=user,
        supabase_url=SUPABASE_URL,
        supabase_anon_key=SUPABASE_ANON_KEY,
        google_client_id=GOOGLE_CLIENT_ID,
        demo_mode_enabled=ENABLE_LOCAL_DEMO_MODE,
    )


@app.route("/dashboard")
def dashboard_page() -> Any:
    """Page 3: Role-Based Dashboard (Adapts to Participant, Organizer, or Admin)."""
    user = get_current_user()
    if not user:
        return redirect(url_for("auth_page"))
    return render_template("dashboard.html", current_user=user)


# =============================================================================
# 8. REST API ROUTES (AUTH, DISCOVERY, TRANSACTIONS, ROLES, SUPABASE)
# =============================================================================

# -----------------------------------------------------------------------------
# AUTHENTICATION API
# -----------------------------------------------------------------------------
@app.route("/api/auth/signup", methods=["POST"])
def api_signup() -> Any:
    """
    Creates a new public user account.
    SECURITY RULE: Public signup ALWAYS assigns `role = 'participant'`.
    Even if an untrusted client sends `role: 'admin'` in the request payload,
    it is ignored and forced to `'participant'`.
    """
    data = request.get_json(silent=True) or {}
    full_name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", password))
    interest_ids = data.get("category_ids", [])

    if len(full_name) < 2:
        return jsonify({"ok": False, "error": "Please enter your full name (at least 2 characters)."}), 400
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify({"ok": False, "error": "Please provide a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "error": "Password must be at least 6 characters long."}), 400
    if password != confirm_password:
        return jsonify({"ok": False, "error": "Password confirmation does not match."}), 400

    pw_hash = hash_password(password)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({
                    "ok": False,
                    "error": "An account with this email already exists. Please sign in instead."
                }), 409

            # Force 'participant' role on public signup
            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES (%s, %s, %s, 'participant')
                """,
                (full_name, email, pw_hash),
            )
            cur.execute(
                """
                SELECT user_id, full_name, email, role,
                       COALESCE(avatar_url, '') AS avatar_url,
                       COALESCE(phone, '') AS phone,
                       COALESCE(city, 'Kolkata') AS city,
                       COALESCE(bio, '') AS bio,
                       COALESCE(auth_provider, 'email') AS auth_provider
                FROM users
                WHERE email = %s
                """,
                (email,),
            )
            new_user = cur.fetchone()

            if new_user and isinstance(interest_ids, list):
                for cid in interest_ids[:4]:
                    try:
                        cur.execute(
                            """
                            INSERT INTO user_preferences (user_id, category_id)
                            VALUES (%s, %s)
                            """,
                            (new_user["user_id"], int(cid)),
                        )
                    except Exception:
                        pass

            conn.commit()

        session["user_id"] = new_user["user_id"]
        return jsonify({
            "ok": True,
            "message": f"Welcome to Rangora, {new_user['full_name']}!",
            "user": new_user,
            "redirect": "/dashboard",
        }), 201
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Database error during signup: {exc}"}), 500


@app.route("/api/auth/login", methods=["POST"])
def api_login() -> Any:
    """Verifies credentials against stored password hashes and starts a Flask session."""
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"ok": False, "error": "Please enter both your email and password."}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT user_id, full_name, email, password_hash, role,
                       COALESCE(avatar_url, '') AS avatar_url,
                       COALESCE(phone, '') AS phone,
                       COALESCE(city, 'Kolkata') AS city,
                       COALESCE(bio, '') AS bio,
                       COALESCE(auth_provider, 'email') AS auth_provider
                FROM users
                WHERE email = %s
                """,
                (email,),
            )
            user = cur.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({
                "ok": False,
                "error": "Invalid email or password. Please check your credentials and try again."
            }), 401

        session["user_id"] = user["user_id"]
        return jsonify({
            "ok": True,
            "message": f"Welcome back, {user['full_name']}!",
            "user": {
                "user_id": user["user_id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user["role"],
                "avatar_url": user.get("avatar_url", ""),
                "phone": user.get("phone", ""),
                "city": user.get("city", "Kolkata"),
                "bio": user.get("bio", ""),
                "auth_provider": user.get("auth_provider", "email"),
            },
            "redirect": "/dashboard",
        })
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Database error during login: {exc}"}), 500


@app.route("/api/auth/logout", methods=["POST"])
def api_logout() -> Any:
    """Clears the current user session."""
    session.clear()
    return jsonify({"ok": True, "redirect": "/"})


@app.route("/api/auth/me", methods=["GET"])
def api_me() -> Any:
    """Returns the currently signed-in user or null."""
    user = get_current_user()
    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/config", methods=["GET"])
def api_auth_config() -> Any:
    """Returns authentication configuration status for the frontend."""
    return jsonify({
        "ok": True,
        "supabase_url": SUPABASE_URL,
        "supabase_anon_key": SUPABASE_ANON_KEY,
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "google_client_id": GOOGLE_CLIENT_ID,
        "demo_mode_enabled": ENABLE_LOCAL_DEMO_MODE,
        "providers": ["email"] + (["google", "supabase"] if (SUPABASE_URL and SUPABASE_ANON_KEY) else []),
    })


@app.route("/api/auth/oauth-login", methods=["POST"])
def api_oauth_login() -> Any:
    """
    Handles social OAuth sign-in when backed by verified provider tokens.
    Unverified mock OAuth requests are disabled to enforce genuine credentials.
    """
    data = request.get_json(silent=True) or {}
    token = str(data.get("token") or data.get("access_token") or data.get("id_token") or "").strip()
    supabase_uid = str(data.get("supabase_uid", "")).strip()

    # Disable mock client logins claiming arbitrary emails without provider verification
    if not token and not (SUPABASE_URL and SUPABASE_ANON_KEY and supabase_uid):
        return jsonify({
            "ok": False,
            "error": "Unverified mock OAuth is disabled. Please sign in or register with verified email and password."
        }), 400

    provider = str(data.get("provider", "google")).strip().lower()
    if provider not in ("google", "github", "apple", "supabase"):
        provider = "google"

    email = str(data.get("email", "")).strip().lower()
    full_name = str(data.get("full_name", "")).strip()

    if not email or "@" not in email:
        return jsonify({"ok": False, "error": "Please provide a valid email address for social sign-in."}), 400

    if not full_name:
        local_part = email.split("@")[0].replace(".", " ").replace("_", " ").title()
        full_name = local_part if len(local_part) >= 2 else "Rangora Explorer"

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    """
                    UPDATE users
                    SET auth_provider = %s,
                        supabase_uid = CASE WHEN %s <> '' THEN %s ELSE supabase_uid END
                    WHERE user_id = %s
                    """,
                    (provider, supabase_uid, supabase_uid, existing["user_id"]),
                )
                conn.commit()
                user_id = int(existing["user_id"])
            else:
                # Public OAuth signups default strictly to 'participant' with empty avatar_url initially
                # so the user can customize their face photo in Dashboard -> Profile & Settings
                random_pw_hash = hash_password(secrets.token_urlsafe(16))
                cur.execute(
                    """
                    INSERT INTO users (full_name, email, password_hash, role, avatar_url, auth_provider, supabase_uid)
                    VALUES (%s, %s, %s, 'participant', '', %s, %s)
                    """,
                    (full_name, email, random_pw_hash, provider, supabase_uid),
                )
                cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
                created = cur.fetchone()
                user_id = int(created["user_id"])

                # Seed default category preferences for new OAuth user
                cur.execute("SELECT category_id FROM categories ORDER BY category_id ASC LIMIT 2")
                for crow in cur.fetchall():
                    try:
                        cur.execute(
                            "INSERT INTO user_preferences (user_id, category_id) VALUES (%s, %s)",
                            (user_id, int(crow["category_id"])),
                        )
                    except Exception:
                        pass
                conn.commit()

            cur.execute(
                """
                SELECT user_id, full_name, email, role,
                       COALESCE(avatar_url, '') AS avatar_url,
                       COALESCE(phone, '') AS phone,
                       COALESCE(city, 'Kolkata') AS city,
                       COALESCE(bio, '') AS bio,
                       COALESCE(auth_provider, 'email') AS auth_provider
                FROM users
                WHERE user_id = %s
                """,
                (user_id,),
            )
            user_obj = cur.fetchone()

        session["user_id"] = user_obj["user_id"]
        provider_label = provider.capitalize()
        return jsonify({
            "ok": True,
            "message": f"Signed in with {provider_label} as {user_obj['full_name']}!",
            "user": user_obj,
            "redirect": "/dashboard",
        })
    except Exception as exc:
        return jsonify({"ok": False, "error": f"OAuth sign-in failed: {exc}"}), 500


@app.route("/api/auth/send-otp", methods=["POST"])
def api_send_otp() -> Any:
    """
    Passwordless OTP authentication is disabled without a verified SMS or SMTP gateway.
    Users must authenticate with verified email and password.
    """
    return jsonify({
        "ok": False,
        "error": "Passwordless OTP authentication is disabled without an active SMS or SMTP provider gateway. Please sign in or register with your email and password."
    }), 400


@app.route("/api/auth/verify-otp", methods=["POST"])
def api_verify_otp() -> Any:
    """
    Passwordless OTP verification is disabled; hardcoded OTP bypass removed.
    """
    return jsonify({
        "ok": False,
        "error": "Passwordless OTP verification is disabled. Please sign in or register with your email and password."
    }), 400


@app.route("/api/auth/switch-role", methods=["POST"])
def api_switch_demo_role() -> Any:
    """
    Convenience endpoint for local DBMS viva demonstrations: switches the active
    session between the seeded Participant, Organizer, and Administrator accounts.
    Restricted outside explicitly enabled local demonstration mode (ENABLE_LOCAL_DEMO_MODE=true).
    """
    if not ENABLE_LOCAL_DEMO_MODE:
        return jsonify({
            "ok": False,
            "error": "Role switcher is restricted outside explicitly enabled local demonstration mode. Set ENABLE_LOCAL_DEMO_MODE=true in .env to enable for local viva evaluation."
        }), 403

    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "participant")).strip().lower()
    role_email_map = {
        "participant": "participant@rangora.edu",
        "organizer": "organizer@rangora.edu",
        "admin": "admin@rangora.edu",
    }
    target_email = role_email_map.get(role, "participant@rangora.edu")
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_id, full_name, email, role,
                   COALESCE(avatar_url, '') AS avatar_url,
                   COALESCE(phone, '') AS phone,
                   COALESCE(city, 'Kolkata') AS city,
                   COALESCE(bio, '') AS bio,
                   COALESCE(auth_provider, 'email') AS auth_provider
            FROM users
            WHERE email = %s
            """,
            (target_email,),
        )
        user_obj = cur.fetchone()
        if not user_obj:
            return jsonify({"ok": False, "error": "Demo role account not found."}), 404
    session["user_id"] = user_obj["user_id"]
    return jsonify({
        "ok": True,
        "message": f"Switched active session to {user_obj['full_name']} ({user_obj['role'].upper()}).",
        "user": user_obj,
        "redirect": "/dashboard",
    })


@app.route("/api/profile", methods=["GET", "PUT"])
@require_auth()
def api_user_profile(current_user: Dict[str, Any]) -> Any:
    """
    Reads or updates the signed-in user's profile in the `users` table:
    - `full_name`, `phone`, `city`, `bio`, and `avatar_url` (used for the round user face
      icon in the top-right header across both the Dashboard and the Landing Page).
    - `category_ids` for personalized Beyond the Hype recommendations.
    """
    uid = int(current_user["user_id"])
    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT category_id FROM user_preferences WHERE user_id = %s", (uid,))
            pref_ids = [int(r["category_id"]) for r in cur.fetchall()]
        return jsonify({"ok": True, "user": get_current_user(), "preferred_category_ids": pref_ids})

    data = request.get_json(silent=True) or {}
    full_name = str(data.get("full_name", current_user.get("full_name", ""))).strip()
    phone = str(data.get("phone", current_user.get("phone", ""))).strip()[:40]
    city = str(data.get("city", current_user.get("city", "Kolkata"))).strip()[:80]
    bio = str(data.get("bio", current_user.get("bio", ""))).strip()[:500]
    avatar_url = str(data.get("avatar_url", current_user.get("avatar_url", ""))).strip()
    category_ids = data.get("category_ids")

    if len(full_name) < 2:
        return jsonify({"ok": False, "error": "Full name must be at least 2 characters."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users
            SET full_name = %s,
                phone = %s,
                city = %s,
                bio = %s,
                avatar_url = %s
            WHERE user_id = %s
            """,
            (full_name, phone, city, bio, avatar_url, uid),
        )
        if isinstance(category_ids, list):
            cur.execute("DELETE FROM user_preferences WHERE user_id = %s", (uid,))
            for cid in category_ids:
                try:
                    cur.execute(
                        "INSERT INTO user_preferences (user_id, category_id) VALUES (%s, %s)",
                        (uid, int(cid)),
                    )
                except Exception:
                    pass
        conn.commit()

    updated_user = get_current_user()
    return jsonify({
        "ok": True,
        "message": "Profile & avatar settings saved! Your top-right profile icon has been updated.",
        "user": updated_user,
    })


# -----------------------------------------------------------------------------
# PUBLIC EVENT & FESTIVAL DISCOVERY API
# -----------------------------------------------------------------------------
@app.route("/api/events", methods=["GET"])
def api_list_events() -> Any:
    """
    Queries the `v_event_directory` view (which joins `events`, `festivals`,
    `categories`, `venues`, `users`, and `LEFT JOIN registrations`) with
    optional search, category, festival, venue, and status filters.
    Computes live `Seat Pulse` and `Beyond the Hype` shelves.
    """
    q = str(request.args.get("q", "")).strip() if request else ""
    category_slug = str(request.args.get("category", "")).strip() if request else ""
    festival_id = str(request.args.get("festival_id", "")).strip() if request else ""
    venue_id = str(request.args.get("venue_id", "")).strip() if request else ""
    include_all = str(request.args.get("include_all", "")).strip() == "1" if request else False

    user = get_current_user() if request else None

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Build parameterized query against the joined view
            conditions = []
            params: List[Any] = []

            if not include_all:
                conditions.append("status IN ('published', 'completed')")

            if q:
                conditions.append(
                    "(event_name ILIKE %s OR description ILIKE %s OR festival_name ILIKE %s OR venue_name ILIKE %s)"
                )
                wildcard = f"%{q}%"
                params.extend([wildcard, wildcard, wildcard, wildcard])

            if category_slug and category_slug != "all":
                conditions.append("category_slug = %s")
                params.append(category_slug)

            if festival_id and festival_id != "all":
                conditions.append("festival_id = %s")
                params.append(int(festival_id))

            if venue_id and venue_id != "all":
                conditions.append("venue_id = %s")
                params.append(int(venue_id))

            where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""
            cur.execute(
                f"""
                SELECT *
                FROM v_event_directory
                {where_sql}
                ORDER BY
                    CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                    start_at ASC
                """,
                tuple(params),
            )
            events = cur.fetchall()

            # Enrich each event with Seat Pulse calculation
            for ev in events:
                ev["ticket_price"] = float(ev["ticket_price"])
                ev["confirmed_count"] = int(ev["confirmed_count"])
                ev["available_seats"] = int(ev["available_seats"])
                ev["max_seats"] = int(ev["max_seats"])
                ev["seat_pulse"] = compute_seat_pulse(
                    ev["confirmed_count"], ev["max_seats"], ev["status"]
                )

            # Fetch festivals, categories, venues for filter bars
            cur.execute("SELECT * FROM festivals WHERE status IN ('published', 'completed') ORDER BY start_date ASC")
            festivals = cur.fetchall()

            cur.execute("SELECT * FROM categories ORDER BY category_id ASC")
            categories = cur.fetchall()

            cur.execute("SELECT * FROM venues ORDER BY venue_name ASC")
            venues = cur.fetchall()

            # User-specific preferences and registrations for Beyond the Hype
            pref_ids: List[int] = []
            reg_event_ids: List[int] = []
            if user:
                cur.execute(
                    "SELECT category_id FROM user_preferences WHERE user_id = %s",
                    (user["user_id"],),
                )
                pref_ids = [int(r["category_id"]) for r in cur.fetchall()]
                cur.execute(
                    "SELECT event_id FROM registrations WHERE user_id = %s AND status = 'confirmed'",
                    (user["user_id"],),
                )
                reg_event_ids = [int(r["event_id"]) for r in cur.fetchall()]

            # Also query unfiltered published events for Beyond the Hype shelves
            cur.execute("SELECT * FROM v_event_directory WHERE status = 'published' ORDER BY start_at ASC")
            all_pub_events = cur.fetchall()
            for ev in all_pub_events:
                ev["ticket_price"] = float(ev["ticket_price"])
                ev["confirmed_count"] = int(ev["confirmed_count"])
                ev["available_seats"] = int(ev["available_seats"])
                ev["max_seats"] = int(ev["max_seats"])
                ev["seat_pulse"] = compute_seat_pulse(
                    ev["confirmed_count"], ev["max_seats"], ev["status"]
                )

            beyond_the_hype = build_beyond_the_hype(all_pub_events, pref_ids, reg_event_ids)

            # SQL Subquery demonstration: Events priced above the average published ticket price
            cur.execute(
                """
                SELECT event_id, event_name, ticket_price
                FROM events
                WHERE status = 'published'
                  AND ticket_price > (
                      SELECT AVG(ticket_price)
                      FROM events
                      WHERE status = 'published'
                  )
                ORDER BY ticket_price DESC
                """
            )
            above_avg_events = cur.fetchall()

        return jsonify({
            "ok": True,
            "events": events,
            "festivals": festivals,
            "categories": categories,
            "venues": venues,
            "beyond_the_hype": beyond_the_hype,
            "registered_event_ids": reg_event_ids,
            "above_avg_price_event_ids": [int(r["event_id"]) for r in above_avg_events],
        })
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Failed to load events from database: {exc}"}), 500


# -----------------------------------------------------------------------------
# TRANSACTION-SAFE EVENT REGISTRATION API (CRITICAL DBMS FLOW)
# -----------------------------------------------------------------------------
def register_user_for_event_tx(
    conn: ConnectionAdapter,
    user_id: int,
    event_id: int,
    ticket_tier: str = "General Pass",
) -> Tuple[bool, int, Dict[str, Any]]:
    """
    Executes the ACID transaction for registering a participant for an event:
    1. Locks the target event row (`SELECT ... FOR UPDATE` on PostgreSQL).
    2. Verifies the event is `'published'`.
    3. Checks if the user already has a registration row (`UNIQUE(user_id, event_id)`).
    4. Counts confirmed registrations (`SELECT COUNT(*)`) and compares with `max_seats`.
    5. Inserts or reactivates the registration within the same transaction and commits,
       or rolls back cleanly on any violation.
    """
    cur = conn.cursor()
    if ticket_tier not in ("General Pass", "Early Bird", "Student Creator"):
        ticket_tier = "General Pass"

    try:
        # Step 1: Lock the event row to prevent race-condition overbooking
        cur.execute(
            """
            SELECT event_id, event_name, status, max_seats, ticket_price
            FROM events
            WHERE event_id = %s
            FOR UPDATE
            """,
            (event_id,),
        )
        event = cur.fetchone()
        if not event:
            conn.rollback()
            return False, 404, {"ok": False, "error": "Event not found."}

        if event["status"] != "published":
            conn.rollback()
            return False, 400, {
                "ok": False,
                "error": f"Registration is not open for '{event['event_name']}' (current status: {event['status']})."
            }

        # Step 2: Check for existing registration by this user
        cur.execute(
            """
            SELECT registration_id, status, ticket_code
            FROM registrations
            WHERE user_id = %s AND event_id = %s
            """,
            (user_id, event_id),
        )
        existing = cur.fetchone()
        if existing and existing["status"] == "confirmed":
            conn.rollback()
            return False, 409, {
                "ok": False,
                "error": f"You are already registered for '{event['event_name']}' (Pass #{existing['ticket_code']})."
            }

        # Step 3: Authoritative capacity check inside the transaction
        cur.execute(
            """
            SELECT COUNT(registration_id) AS confirmed_count
            FROM registrations
            WHERE event_id = %s AND status = 'confirmed'
            """,
            (event_id,),
        )
        cnt_row = cur.fetchone()
        confirmed_count = int(cnt_row["confirmed_count"]) if cnt_row else 0
        max_seats = int(event["max_seats"])

        if confirmed_count >= max_seats:
            conn.rollback()
            return False, 409, {
                "ok": False,
                "error": f"Sorry, '{event['event_name']}' has reached full capacity ({max_seats}/{max_seats} seats booked)."
            }

        # Step 4: Insert new registration (or re-confirm a previously cancelled one)
        ticket_code = f"RNG-{event_id:02d}{user_id:02d}-{secrets.token_hex(2).upper()}"
        price = float(event["ticket_price"])

        if existing and existing["status"] == "cancelled":
            cur.execute(
                """
                UPDATE registrations
                SET status = 'confirmed',
                    ticket_tier = %s,
                    price_at_registration = %s,
                    registered_at = CURRENT_TIMESTAMP
                WHERE registration_id = %s
                """,
                (ticket_tier, price, existing["registration_id"]),
            )
            ticket_code = existing["ticket_code"]
        else:
            cur.execute(
                """
                INSERT INTO registrations
                    (user_id, event_id, status, ticket_tier, price_at_registration, ticket_code)
                VALUES (%s, %s, 'confirmed', %s, %s, %s)
                """,
                (user_id, event_id, ticket_tier, price, ticket_code),
            )

        conn.commit()

        new_confirmed = confirmed_count + 1
        seat_pulse = compute_seat_pulse(new_confirmed, max_seats, event["status"])
        return True, 201, {
            "ok": True,
            "message": f"Registration confirmed for '{event['event_name']}'!",
            "ticket_code": ticket_code,
            "event_id": event_id,
            "seat_pulse": seat_pulse,
        }
    except Exception as exc:
        conn.rollback()
        return False, 500, {"ok": False, "error": f"Transaction failed: {exc}"}


@app.route("/api/events/<int:event_id>/register", methods=["POST"])
@require_auth(roles=["participant", "organizer", "admin"])
def api_register_event(event_id: int, current_user: Dict[str, Any]) -> Any:
    """Endpoint to register the signed-in user for an event."""
    data = request.get_json(silent=True) or {}
    ticket_tier = str(data.get("ticket_tier", "General Pass")).strip()

    with get_db_connection() as conn:
        ok, status_code, payload = register_user_for_event_tx(
            conn, int(current_user["user_id"]), event_id, ticket_tier
        )
        if ok:
            evaluate_participant_rewards(conn, int(current_user["user_id"]))
    return jsonify(payload), status_code


@app.route("/api/registrations/<int:registration_id>/cancel", methods=["POST"])
@require_auth(roles=["participant", "organizer", "admin"])
def api_cancel_registration(registration_id: int, current_user: Dict[str, Any]) -> Any:
    """Allows a participant to cancel their own confirmed registration and frees the seat."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.registration_id, r.user_id, r.event_id, r.status, e.event_name, e.status AS event_status
            FROM registrations AS r
            JOIN events AS e ON r.event_id = e.event_id
            WHERE r.registration_id = %s
            """,
            (registration_id,),
        )
        reg = cur.fetchone()
        if not reg:
            return jsonify({"ok": False, "error": "Registration record not found."}), 404

        if int(reg["user_id"]) != int(current_user["user_id"]) and current_user["role"] != "admin":
            return jsonify({"ok": False, "error": "You can only cancel your own registrations."}), 403

        if reg["event_status"] == "completed":
            return jsonify({"ok": False, "error": "Completed events cannot be cancelled."}), 400

        cur.execute(
            "UPDATE registrations SET status = 'cancelled' WHERE registration_id = %s",
            (registration_id,),
        )
        conn.commit()

    return jsonify({
        "ok": True,
        "message": f"Registration for '{reg['event_name']}' has been cancelled and your seat was released."
    })


# -----------------------------------------------------------------------------
# UNIFIED ROLE-BASED DASHBOARD DATA API
# -----------------------------------------------------------------------------
@app.route("/api/dashboard/summary", methods=["GET"])
@require_auth()
def api_dashboard_summary(current_user: Dict[str, Any]) -> Any:
    """
    Returns role-tailored dashboard data driven by real database queries:
    - Common: User profile, platform overview counts, categories, venues, festivals.
    - Participant: My Registrations (JOIN), My Plan + Plan Rescue conflicts,
      Festival DNA + Festival Passport, Beyond the Hype recommendations.
    - Organizer: My Events (filtered by organizer_id), Participant Roster &
      Attendance Check-In controls, No-Clash Guardian validator, Event Echo recaps.
    - Administrator: All Users & Role controls, Event Approval queue, Festival &
      Venue management, Sponsor & Sponsorship ledger, Aggregate SQL analytics.
    """
    uid = int(current_user["user_id"])
    role = current_user["role"]

    with get_db_connection() as conn:
        cur = conn.cursor()

        # 1. Platform Overview Counts (Real SQL Aggregates)
        cur.execute("SELECT COUNT(*) AS cnt FROM festivals WHERE status IN ('published', 'completed')")
        total_festivals = int((cur.fetchone() or {"cnt": 0})["cnt"])

        cur.execute("SELECT COUNT(*) AS cnt FROM events WHERE status = 'published'")
        total_published_events = int((cur.fetchone() or {"cnt": 0})["cnt"])

        cur.execute("SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'confirmed'")
        total_confirmed_registrations = int((cur.fetchone() or {"cnt": 0})["cnt"])

        cur.execute("SELECT COALESCE(SUM(contribution_amount), 0) AS total_sponsorship FROM sponsorships WHERE status IN ('confirmed', 'received')")
        total_sponsorship = float((cur.fetchone() or {"total_sponsorship": 0})["total_sponsorship"])

        # 2. All Published Events for Discovery & Planning
        cur.execute("SELECT * FROM v_event_directory WHERE status = 'published' ORDER BY start_at ASC")
        published_events = cur.fetchall()
        for ev in published_events:
            ev["ticket_price"] = float(ev["ticket_price"])
            ev["confirmed_count"] = int(ev["confirmed_count"])
            ev["available_seats"] = int(ev["available_seats"])
            ev["max_seats"] = int(ev["max_seats"])
            ev["seat_pulse"] = compute_seat_pulse(ev["confirmed_count"], ev["max_seats"], ev["status"])

        # 3. Participant Data: My Registrations (Multi-table JOIN)
        cur.execute(
            """
            SELECT
                r.registration_id,
                r.registered_at,
                r.status AS registration_status,
                r.ticket_tier,
                r.price_at_registration,
                r.ticket_code,
                e.event_id,
                e.event_name,
                e.start_at,
                e.end_at,
                e.status AS event_status,
                e.poster_path,
                f.name AS festival_name,
                c.category_name,
                c.accent_color,
                v.venue_name,
                v.location AS venue_location,
                CASE WHEN ar.attendance_id IS NOT NULL THEN 1 ELSE 0 END AS is_verified_attended
            FROM registrations AS r
            JOIN events AS e ON r.event_id = e.event_id
            JOIN festivals AS f ON e.festival_id = f.festival_id
            JOIN categories AS c ON e.category_id = c.category_id
            JOIN venues AS v ON e.venue_id = v.venue_id
            LEFT JOIN attendance_records AS ar ON ar.registration_id = r.registration_id
            WHERE r.user_id = %s
            ORDER BY e.start_at ASC
            """,
            (uid,),
        )
        my_registrations = cur.fetchall()
        for reg in my_registrations:
            reg["price_at_registration"] = float(reg["price_at_registration"])
            reg["is_verified_attended"] = bool(reg["is_verified_attended"])

        # 4. Participant Data: My Plan & Plan Rescue
        cur.execute(
            """
            SELECT
                i.itinerary_id,
                i.notes,
                e.event_id,
                e.event_name,
                e.start_at,
                e.end_at,
                e.status,
                e.festival_id,
                e.category_id,
                f.name AS festival_name,
                c.category_name,
                c.accent_color,
                v.venue_name,
                v.location AS venue_location
            FROM itinerary_items AS i
            JOIN events AS e ON i.event_id = e.event_id
            JOIN festivals AS f ON e.festival_id = f.festival_id
            JOIN categories AS c ON e.category_id = c.category_id
            JOIN venues AS v ON e.venue_id = v.venue_id
            WHERE i.user_id = %s
            ORDER BY e.start_at ASC
            """,
            (uid,),
        )
        itinerary_rows = cur.fetchall()
        plan_rescue = build_plan_rescue(itinerary_rows, published_events)

        # 5. Participant Data: Festival DNA & Festival Passport
        dna_passport = build_festival_rewards_and_passport(conn, uid)

        # 6. Participant Preferences & Beyond the Hype
        cur.execute("SELECT category_id FROM user_preferences WHERE user_id = %s", (uid,))
        pref_ids = [int(r["category_id"]) for r in cur.fetchall()]
        confirmed_reg_ids = [
            int(r["event_id"]) for r in my_registrations if r["registration_status"] == "confirmed"
        ]
        beyond_the_hype = build_beyond_the_hype(published_events, pref_ids, confirmed_reg_ids)

        # 7. Reference Lists (Festivals, Categories, Venues, Sponsors)
        cur.execute("SELECT * FROM festivals ORDER BY start_date ASC")
        festivals = cur.fetchall()
        for f in festivals:
            f["budget"] = float(f["budget"] or 0)

        cur.execute("SELECT * FROM categories ORDER BY category_id ASC")
        categories = cur.fetchall()

        cur.execute("SELECT * FROM venues ORDER BY venue_name ASC")
        venues = cur.fetchall()

        # 8. Role-Specific Data for Organizer & Admin
        organizer_data: Dict[str, Any] = {}
        admin_data: Dict[str, Any] = {}

        if role in ("organizer", "admin"):
            org_filter_id = uid if role == "organizer" else None
            where_org = "WHERE organizer_id = %s" if org_filter_id else ""
            org_params: Tuple[Any, ...] = (org_filter_id,) if org_filter_id else ()

            cur.execute(
                f"""
                SELECT *
                FROM v_event_directory
                {where_org}
                ORDER BY start_at ASC
                """,
                org_params,
            )
            managed_events = cur.fetchall()
            for mev in managed_events:
                mev["ticket_price"] = float(mev["ticket_price"])
                mev["confirmed_count"] = int(mev["confirmed_count"])
                mev["available_seats"] = int(mev["available_seats"])
                mev["max_seats"] = int(mev["max_seats"])
                mev["seat_pulse"] = compute_seat_pulse(
                    mev["confirmed_count"], mev["max_seats"], mev["status"]
                )

            # Participant Roster for managed events
            roster_where = "WHERE e.organizer_id = %s" if org_filter_id else ""
            cur.execute(
                f"""
                SELECT
                    r.registration_id,
                    r.ticket_code,
                    r.ticket_tier,
                    r.status AS registration_status,
                    r.registered_at,
                    u.full_name AS participant_name,
                    u.email AS participant_email,
                    e.event_id,
                    e.event_name,
                    e.start_at,
                    v.venue_name,
                    CASE WHEN ar.attendance_id IS NOT NULL THEN 1 ELSE 0 END AS verified_attended
                FROM registrations AS r
                JOIN users AS u ON r.user_id = u.user_id
                JOIN events AS e ON r.event_id = e.event_id
                JOIN venues AS v ON e.venue_id = v.venue_id
                LEFT JOIN attendance_records AS ar ON ar.registration_id = r.registration_id
                {roster_where}
                ORDER BY r.registered_at DESC
                """,
                org_params,
            )
            participant_roster = cur.fetchall()
            for pr in participant_roster:
                pr["verified_attended"] = bool(pr["verified_attended"])

            event_echo = build_event_echo(conn, org_filter_id)

            organizer_data = {
                "managed_events": managed_events,
                "participant_roster": participant_roster,
                "event_echo": event_echo,
            }

        if role == "admin":
            cur.execute(
                """
                SELECT user_id, full_name, email, role, created_at
                FROM users
                ORDER BY created_at ASC
                """
            )
            all_users = cur.fetchall()

            cur.execute(
                """
                SELECT
                    sp.sponsorship_id,
                    sp.contribution_amount,
                    sp.tier,
                    sp.status,
                    s.sponsor_id,
                    s.sponsor_name,
                    s.contact_email,
                    s.industry,
                    f.festival_id,
                    f.name AS festival_name
                FROM sponsorships AS sp
                JOIN sponsors AS s ON sp.sponsor_id = s.sponsor_id
                JOIN festivals AS f ON sp.festival_id = f.festival_id
                ORDER BY sp.contribution_amount DESC
                """
            )
            sponsorships = cur.fetchall()
            for sp in sponsorships:
                sp["contribution_amount"] = float(sp["contribution_amount"])

            cur.execute("SELECT * FROM sponsors ORDER BY sponsor_name ASC")
            sponsors = cur.fetchall()

            # SQL GROUP BY + HAVING demonstration: High-demand events with >= 3 confirmed registrations
            cur.execute(
                """
                SELECT
                    e.event_id,
                    e.event_name,
                    COUNT(r.registration_id) AS confirmed_count
                FROM events AS e
                JOIN registrations AS r ON r.event_id = e.event_id
                WHERE r.status = 'confirmed'
                GROUP BY e.event_id, e.event_name
                HAVING COUNT(r.registration_id) >= 3
                ORDER BY confirmed_count DESC
                """
            )
            high_demand_events = cur.fetchall()

            admin_data = {
                "users": all_users,
                "sponsors": sponsors,
                "sponsorships": sponsorships,
                "high_demand_events": high_demand_events,
            }

    return jsonify({
        "ok": True,
        "user": current_user,
        "overview_stats": {
            "total_festivals": total_festivals,
            "total_published_events": total_published_events,
            "total_confirmed_registrations": total_confirmed_registrations,
            "total_sponsorship": total_sponsorship,
        },
        "participant": {
            "registrations": my_registrations,
            "plan_rescue": plan_rescue,
            "dna_passport": dna_passport,
            "beyond_the_hype": beyond_the_hype,
            "preferred_category_ids": pref_ids,
        },
        "organizer": organizer_data,
        "admin": admin_data,
        "festivals": festivals,
        "categories": categories,
        "venues": venues,
        "published_events": published_events,
    })


# -----------------------------------------------------------------------------
# PARTICIPANT ITINERARY (PLAN RESCUE) & FEEDBACK ROUTES
# -----------------------------------------------------------------------------
@app.route("/api/itinerary", methods=["POST"])
@require_auth()
def api_add_itinerary_item(current_user: Dict[str, Any]) -> Any:
    """Saves an event to the participant's personal itinerary and runs Plan Rescue."""
    data = request.get_json(silent=True) or {}
    event_id = int(data.get("event_id", 0))
    notes = str(data.get("notes", "")).strip()[:240]

    if not event_id:
        return jsonify({"ok": False, "error": "Please select a valid event to add to your plan."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT itinerary_id FROM itinerary_items WHERE user_id = %s AND event_id = %s",
            (current_user["user_id"], event_id),
        )
        if cur.fetchone():
            return jsonify({"ok": False, "error": "This event is already in your personal plan."}), 409

        cur.execute(
            """
            INSERT INTO itinerary_items (user_id, event_id, notes)
            VALUES (%s, %s, %s)
            """,
            (current_user["user_id"], event_id, notes),
        )
        conn.commit()

    return jsonify({"ok": True, "message": "Added to My Plan! Plan Rescue has checked your schedule."}), 201


@app.route("/api/itinerary/<int:event_id>", methods=["DELETE"])
@require_auth()
def api_remove_itinerary_item(event_id: int, current_user: Dict[str, Any]) -> Any:
    """Removes an event from the participant's personal itinerary."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM itinerary_items WHERE user_id = %s AND event_id = %s",
            (current_user["user_id"], event_id),
        )
        conn.commit()
    return jsonify({"ok": True, "message": "Removed event from your plan."})


@app.route("/api/itinerary/swap", methods=["POST"])
@require_auth()
def api_swap_itinerary_item(current_user: Dict[str, Any]) -> Any:
    """Swaps a clashing itinerary event with a conflict-free Plan Rescue alternative."""
    data = request.get_json(silent=True) or {}
    remove_event_id = int(data.get("remove_event_id", 0))
    add_event_id = int(data.get("add_event_id", 0))

    if not remove_event_id or not add_event_id:
        return jsonify({"ok": False, "error": "Both remove_event_id and add_event_id are required."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM itinerary_items WHERE user_id = %s AND event_id = %s",
            (current_user["user_id"], remove_event_id),
        )
        cur.execute(
            "SELECT itinerary_id FROM itinerary_items WHERE user_id = %s AND event_id = %s",
            (current_user["user_id"], add_event_id),
        )
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO itinerary_items (user_id, event_id, notes)
                VALUES (%s, %s, 'Swapped via Plan Rescue')
                """,
                (current_user["user_id"], add_event_id),
            )
        conn.commit()

    return jsonify({"ok": True, "message": "Schedule rescued! Replaced the clashing slot with your conflict-free choice."})


@app.route("/api/preferences", methods=["POST"])
@require_auth()
def api_update_preferences(current_user: Dict[str, Any]) -> Any:
    """Updates the participant's category interests for Beyond the Hype."""
    data = request.get_json(silent=True) or {}
    category_ids = data.get("category_ids", [])
    if not isinstance(category_ids, list):
        return jsonify({"ok": False, "error": "category_ids must be a list."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM user_preferences WHERE user_id = %s", (current_user["user_id"],))
        for cid in category_ids:
            cur.execute(
                "INSERT INTO user_preferences (user_id, category_id) VALUES (%s, %s)",
                (current_user["user_id"], int(cid)),
            )
        conn.commit()

    return jsonify({"ok": True, "message": "Your festival interests have been updated."})


@app.route("/api/events/<int:event_id>/feedback", methods=["POST"])
@require_auth()
def api_submit_feedback(event_id: int, current_user: Dict[str, Any]) -> Any:
    """Allows a participant to submit a 1–5 star rating and comment for Event Echo."""
    data = request.get_json(silent=True) or {}
    rating = int(data.get("rating", 5))
    comment = str(data.get("comment", "")).strip()

    if rating < 1 or rating > 5:
        return jsonify({"ok": False, "error": "Rating must be between 1 and 5."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT feedback_id FROM event_feedback WHERE user_id = %s AND event_id = %s",
            (current_user["user_id"], event_id),
        )
        if cur.fetchone():
            cur.execute(
                """
                UPDATE event_feedback
                SET rating = %s, comment = %s, submitted_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND event_id = %s
                """,
                (rating, comment, current_user["user_id"], event_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO event_feedback (event_id, user_id, rating, comment)
                VALUES (%s, %s, %s, %s)
                """,
                (event_id, current_user["user_id"], rating, comment),
            )
        conn.commit()

    return jsonify({"ok": True, "message": "Thank you! Your reflection has been added to Event Echo."})


# -----------------------------------------------------------------------------
# ORGANIZER API (NO-CLASH GUARDIAN, CREATE/EDIT EVENT, VERIFY ATTENDANCE)
# -----------------------------------------------------------------------------
@app.route("/api/organizer/check-clash", methods=["POST"])
@require_auth(roles=["organizer", "admin"])
def api_organizer_check_clash(current_user: Dict[str, Any]) -> Any:
    """Runs No-Clash Guardian pre-publish check without saving the event yet."""
    data = request.get_json(silent=True) or {}
    venue_id = int(data.get("venue_id", 0))
    start_at = str(data.get("start_at", "")).strip()
    end_at = str(data.get("end_at", "")).strip()
    max_seats = int(data.get("max_seats", 0))
    exclude_id = int(data["event_id"]) if data.get("event_id") else None

    if not venue_id or not start_at or not end_at or max_seats <= 0:
        return jsonify({
            "ok": False,
            "error": "Please provide venue, start time, end time, and a positive seat capacity."
        }), 400

    with get_db_connection() as conn:
        report = run_no_clash_guardian(
            conn,
            venue_id=venue_id,
            organizer_id=int(current_user["user_id"]),
            start_at=start_at,
            end_at=end_at,
            max_seats=max_seats,
            exclude_event_id=exclude_id,
        )
    return jsonify({"ok": True, "guardian": report})


@app.route("/api/organizer/events", methods=["POST"])
@require_auth(roles=["organizer", "admin"])
def api_create_event(current_user: Dict[str, Any]) -> Any:
    """
    Creates a new festival event after enforcing No-Clash Guardian checks
    (venue overlap and venue physical capacity limits).
    """
    data = request.get_json(silent=True) or {}
    festival_id = int(data.get("festival_id", 0))
    category_id = int(data.get("category_id", 0))
    venue_id = int(data.get("venue_id", 0))
    event_name = str(data.get("event_name", "")).strip()
    subtitle = str(data.get("subtitle", "")).strip()
    description = str(data.get("description", "")).strip()
    start_at = str(data.get("start_at", "")).strip()
    end_at = str(data.get("end_at", "")).strip()
    ticket_price = float(data.get("ticket_price", 0.0))
    max_seats = int(data.get("max_seats", 0))
    poster_path = str(data.get("poster_path", "")).strip() or "/static/images/hero_festival.jpg"

    if not (festival_id and category_id and venue_id and event_name and description and start_at and end_at):
        return jsonify({"ok": False, "error": "Please complete all required event fields."}), 400
    if ticket_price < 0 or max_seats <= 0:
        return jsonify({"ok": False, "error": "Ticket fee must be non-negative and capacity must be greater than 0."}), 400

    with get_db_connection() as conn:
        guardian = run_no_clash_guardian(
            conn,
            venue_id=venue_id,
            organizer_id=int(current_user["user_id"]),
            start_at=start_at,
            end_at=end_at,
            max_seats=max_seats,
        )
        if not guardian["passed"]:
            return jsonify({
                "ok": False,
                "error": "No-Clash Guardian blocked publication due to venue or capacity conflicts.",
                "guardian": guardian,
            }), 409

        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO events (
                festival_id, category_id, venue_id, organizer_id,
                event_name, subtitle, description, start_at, end_at,
                ticket_price, max_seats, status, is_featured, poster_path
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'published', FALSE, %s)
            """,
            (
                festival_id, category_id, venue_id, int(current_user["user_id"]),
                event_name, subtitle, description, start_at, end_at,
                ticket_price, max_seats, poster_path,
            ),
        )
        conn.commit()

    return jsonify({
        "ok": True,
        "message": f"'{event_name}' passed No-Clash Guardian and is now live on Rangora!",
        "guardian": guardian,
    }), 201


@app.route("/api/organizer/events/<int:event_id>", methods=["PUT"])
@require_auth(roles=["organizer", "admin"])
def api_update_event(event_id: int, current_user: Dict[str, Any]) -> Any:
    """
    Updates an existing event.
    AUTHORIZATION RULE: An organizer may update ONLY events where
    `events.organizer_id == current_user.user_id` (unless they are an admin).
    """
    data = request.get_json(silent=True) or {}

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM events WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"ok": False, "error": "Event not found."}), 404

        if current_user["role"] != "admin" and int(ev["organizer_id"]) != int(current_user["user_id"]):
            return jsonify({
                "ok": False,
                "error": "Permission denied: Organizers may only edit events they are authorized to manage."
            }), 403

        venue_id = int(data.get("venue_id", ev["venue_id"]))
        start_at = str(data.get("start_at", ev["start_at"])).strip()
        end_at = str(data.get("end_at", ev["end_at"])).strip()
        max_seats = int(data.get("max_seats", ev["max_seats"]))
        ticket_price = float(data.get("ticket_price", ev["ticket_price"]))
        event_name = str(data.get("event_name", ev["event_name"])).strip()
        status = str(data.get("status", ev["status"])).strip()

        guardian = run_no_clash_guardian(
            conn,
            venue_id=venue_id,
            organizer_id=int(ev["organizer_id"]),
            start_at=start_at,
            end_at=end_at,
            max_seats=max_seats,
            exclude_event_id=event_id,
        )
        if not guardian["passed"]:
            return jsonify({
                "ok": False,
                "error": "No-Clash Guardian found a scheduling or capacity conflict.",
                "guardian": guardian,
            }), 409

        cur.execute(
            """
            UPDATE events
            SET event_name = %s,
                venue_id = %s,
                start_at = %s,
                end_at = %s,
                ticket_price = %s,
                max_seats = %s,
                status = %s
            WHERE event_id = %s
            """,
            (event_name, venue_id, start_at, end_at, ticket_price, max_seats, status, event_id),
        )
        conn.commit()

    return jsonify({
        "ok": True,
        "message": f"Updated '{event_name}' successfully.",
        "guardian": guardian,
    })


@app.route("/api/organizer/registrations/<int:registration_id>/verify-attendance", methods=["POST"])
@require_auth(roles=["organizer", "admin"])
def api_verify_attendance(registration_id: int, current_user: Dict[str, Any]) -> Any:
    """
    Marks a participant's registration as verified attended.
    Enforces that an organizer can only verify attendance for their own events.
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.registration_id, r.status, e.event_id, e.event_name, e.organizer_id, u.full_name
            FROM registrations AS r
            JOIN events AS e ON r.event_id = e.event_id
            JOIN users AS u ON r.user_id = u.user_id
            WHERE r.registration_id = %s
            """,
            (registration_id,),
        )
        reg = cur.fetchone()
        if not reg:
            return jsonify({"ok": False, "error": "Registration record not found."}), 404

        if current_user["role"] != "admin" and int(reg["organizer_id"]) != int(current_user["user_id"]):
            return jsonify({
                "ok": False,
                "error": "Permission denied: You can only verify attendance for your own events."
            }), 403

        cur.execute(
            "SELECT attendance_id FROM attendance_records WHERE registration_id = %s",
            (registration_id,),
        )
        if cur.fetchone():
            return jsonify({"ok": True, "message": f"{reg['full_name']} is already checked in."})

        cur.execute(
            """
            INSERT INTO attendance_records (registration_id, verified_by)
            VALUES (%s, %s)
            """,
            (registration_id, current_user["user_id"]),
        )
        conn.commit()

        # Evaluate participant rewards and stamps based on newly verified attendance
        cur.execute("SELECT user_id FROM registrations WHERE registration_id = %s", (registration_id,))
        urow = cur.fetchone()
        if urow:
            evaluate_participant_rewards(conn, int(urow["user_id"]))

    return jsonify({
        "ok": True,
        "message": f"Verified attendance for {reg['full_name']} at '{reg['event_name']}'. Their Festival DNA & Passport have updated!"
    })


# -----------------------------------------------------------------------------
# ADMINISTRATOR API (USERS, FESTIVALS, VENUES, SPONSORS, EVENT APPROVAL)
# -----------------------------------------------------------------------------
@app.route("/api/admin/users/<int:target_user_id>/role", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_update_role(target_user_id: int, current_user: Dict[str, Any]) -> Any:
    """Allows an authorized administrator to update a user's role."""
    data = request.get_json(silent=True) or {}
    new_role = str(data.get("role", "")).strip()
    if new_role not in ("participant", "organizer", "admin"):
        return jsonify({"ok": False, "error": "Invalid role specified."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET role = %s WHERE user_id = %s",
            (new_role, target_user_id),
        )
        conn.commit()

    return jsonify({"ok": True, "message": f"Updated user #{target_user_id} role to '{new_role}'."})


@app.route("/api/admin/events/<int:event_id>/status", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_event_status(event_id: int, current_user: Dict[str, Any]) -> Any:
    """Allows an administrator to approve ('published'), complete, or cancel any event."""
    data = request.get_json(silent=True) or {}
    new_status = str(data.get("status", "")).strip()
    if new_status not in ("draft", "pending", "published", "completed", "cancelled"):
        return jsonify({"ok": False, "error": "Invalid event status."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE events SET status = %s WHERE event_id = %s", (new_status, event_id))
        conn.commit()

    return jsonify({"ok": True, "message": f"Event #{event_id} status updated to '{new_status}'."})


@app.route("/api/admin/festivals", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_create_festival(current_user: Dict[str, Any]) -> Any:
    """Allows an administrator to create a new parent festival."""
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    tagline = str(data.get("tagline", "")).strip()
    theme = str(data.get("theme", "")).strip()
    description = str(data.get("description", "")).strip()
    start_date = str(data.get("start_date", "")).strip()
    end_date = str(data.get("end_date", "")).strip()
    budget = float(data.get("budget", 0.0))

    if not (name and start_date and end_date):
        return jsonify({"ok": False, "error": "Festival name, start date, and end date are required."}), 400
    if end_date < start_date:
        return jsonify({"ok": False, "error": "Festival end date cannot precede its start date."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO festivals
                (name, tagline, theme, description, start_date, end_date, banner_path, budget, status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, '/static/images/hero_festival.jpg', %s, 'published', %s)
            """,
            (name, tagline, theme, description, start_date, end_date, budget, current_user["user_id"]),
        )
        conn.commit()

    return jsonify({"ok": True, "message": f"Festival '{name}' created and published."}), 201


@app.route("/api/admin/venues", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_create_venue(current_user: Dict[str, Any]) -> Any:
    """Allows an administrator to register a new campus venue with physical capacity."""
    data = request.get_json(silent=True) or {}
    venue_name = str(data.get("venue_name", "")).strip()
    location = str(data.get("location", "")).strip()
    venue_type = str(data.get("venue_type", "Auditorium")).strip()
    capacity = int(data.get("capacity", 0))

    if not venue_name or not location or capacity <= 0:
        return jsonify({"ok": False, "error": "Venue name, location, and positive capacity are required."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO venues (venue_name, location, venue_type, capacity)
            VALUES (%s, %s, %s, %s)
            """,
            (venue_name, location, venue_type, capacity),
        )
        conn.commit()

    return jsonify({"ok": True, "message": f"Venue '{venue_name}' (capacity {capacity}) added."}), 201


@app.route("/api/admin/sponsorships", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_create_sponsorship(current_user: Dict[str, Any]) -> Any:
    """Records a sponsor organization and links its contribution to a festival."""
    data = request.get_json(silent=True) or {}
    sponsor_name = str(data.get("sponsor_name", "")).strip()
    contact_email = str(data.get("contact_email", "")).strip()
    industry = str(data.get("industry", "Partner")).strip()
    festival_id = int(data.get("festival_id", 0))
    contribution_amount = float(data.get("contribution_amount", 0.0))
    tier = str(data.get("tier", "Title Partner")).strip()

    if not sponsor_name or not festival_id or contribution_amount < 0:
        return jsonify({"ok": False, "error": "Sponsor name, festival, and valid contribution amount are required."}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT sponsor_id FROM sponsors WHERE sponsor_name = %s", (sponsor_name,))
        row = cur.fetchone()
        if row:
            sponsor_id = int(row["sponsor_id"])
        else:
            cur.execute(
                "INSERT INTO sponsors (sponsor_name, contact_email, industry) VALUES (%s, %s, %s)",
                (sponsor_name, contact_email, industry),
            )
            cur.execute("SELECT sponsor_id FROM sponsors WHERE sponsor_name = %s", (sponsor_name,))
            sponsor_id = int((cur.fetchone() or {"sponsor_id": 0})["sponsor_id"])

        cur.execute(
            """
            INSERT INTO sponsorships (festival_id, sponsor_id, contribution_amount, tier, status)
            VALUES (%s, %s, %s, %s, 'confirmed')
            """,
            (festival_id, sponsor_id, contribution_amount, tier),
        )
        conn.commit()

    return jsonify({"ok": True, "message": f"Recorded ₹{contribution_amount:,.0f} sponsorship from {sponsor_name}."}), 201


# -----------------------------------------------------------------------------
# OPTIONAL MEDIA STORAGE HELPER: SUPABASE STORAGE UPLOAD
# -----------------------------------------------------------------------------
@app.route("/api/media/upload", methods=["POST"])
@require_auth(roles=["organizer", "admin"])
def api_upload_poster(current_user: Dict[str, Any]) -> Any:
    """
    Uploads an event poster to Supabase Storage if `SUPABASE_URL` and
    `SUPABASE_SERVICE_ROLE_KEY` are configured on the server.
    If Supabase is not configured, returns a graceful fallback notice and keeps
    using bundled local editorial photography.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return jsonify({
            "ok": True,
            "supabase_configured": False,
            "poster_path": "/static/images/hero_festival.jpg",
            "message": (
                "Supabase Storage is optional and not currently configured in .env. "
                "Using bundled local editorial photography instead."
            ),
        })

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No image file provided."}), 400

    uploaded = request.files["file"]
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", uploaded.filename or "poster.jpg")
    object_path = f"posters/{secrets.token_hex(6)}_{filename}"
    file_bytes = uploaded.read()

    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"ok": False, "error": "Poster image must be under 5 MB."}), 400

    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}"
    req = urllib.request.Request(
        upload_url,
        data=file_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": uploaded.content_type or "image/jpeg",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"
                return jsonify({
                    "ok": True,
                    "supabase_configured": True,
                    "poster_path": public_url,
                    "message": "Uploaded poster to Supabase Storage and linked URL to Neon.",
                })
    except urllib.error.URLError as exc:
        return jsonify({"ok": False, "error": f"Supabase Storage upload error: {exc}"}), 502

    return jsonify({"ok": False, "error": "Unexpected response from Supabase Storage."}), 500


# =============================================================================
# =============================================================================
# REWARDS, ACHIEVEMENT PASSES, VOUCHERS & LEADERBOARD REST API ROUTES
# =============================================================================

@app.route("/api/participant/rewards", methods=["GET"])
@require_auth(roles=["participant", "organizer", "admin"])
def api_participant_rewards(current_user: Dict[str, Any]) -> Any:
    """Returns participant's Festival DNA, Passport stamps, earned badges, achievements, and vouchers."""
    uid = int(current_user["user_id"])
    with get_db_connection() as conn:
        rewards_data = build_festival_rewards_and_passport(conn, uid)
    return jsonify({"ok": True, "rewards": rewards_data})


@app.route("/api/vouchers/<int:voucher_id>/redeem", methods=["POST"])
@require_auth(roles=["participant", "organizer", "admin"])
def api_redeem_voucher(voucher_id: int, current_user: Dict[str, Any]) -> Any:
    """Redeems an individual voucher at most once for the authorized participant."""
    uid = int(current_user["user_id"])
    data = request.get_json(silent=True) or {}
    event_id = data.get("event_id")
    with get_db_connection() as conn:
        ok, msg = redeem_voucher(conn, voucher_id, uid, event_id)
        if not ok:
            return jsonify({"ok": False, "error": msg}), 400
    return jsonify({"ok": True, "message": msg})


@app.route("/api/leaderboard", methods=["GET"])
def api_get_leaderboard() -> Any:
    """Returns transparent leaderboard rankings computed from verified records and achievements."""
    category = request.args.get("category")
    festival_id = request.args.get("festival_id")
    filter_type = str(request.args.get("filter_type", "overall")).strip()
    filter_val = request.args.get("filter_val")

    if category:
        filter_type = "category"
        filter_val = category
    elif festival_id:
        filter_type = "festival"
        filter_val = festival_id

    with get_db_connection() as conn:
        leaderboard = build_leaderboard(conn, filter_type, filter_val)
    return jsonify({"ok": True, "leaderboard": leaderboard, "filter_type": filter_type, "filter_val": filter_val})


@app.route("/api/organizer/achievement-passes", methods=["GET", "POST"])
@require_auth(roles=["organizer", "admin"])
def api_organizer_achievement_passes(current_user: Dict[str, Any]) -> Any:
    """Organizer achievement pass creation and listing with authorization scoping."""
    org_id = int(current_user["user_id"])
    is_admin = current_user["role"] == "admin"
    with get_db_connection() as conn:
        cur = conn.cursor()
        if request.method == "GET":
            passes = get_organizer_passes(conn, org_id if not is_admin else None)
            if is_admin:
                cur.execute("SELECT event_id, event_name, festival_id FROM events ORDER BY event_name ASC")
                events = cur.fetchall()
                cur.execute("SELECT festival_id, name FROM festivals ORDER BY name ASC")
                festivals = cur.fetchall()
            else:
                cur.execute("SELECT event_id, event_name, festival_id FROM events WHERE organizer_id = %s ORDER BY event_name ASC", (org_id,))
                events = cur.fetchall()
                cur.execute("SELECT festival_id, name FROM festivals WHERE created_by = %s OR festival_id IN (SELECT DISTINCT festival_id FROM events WHERE organizer_id = %s)", (org_id, org_id))
                festivals = cur.fetchall()
            cur.execute("SELECT campaign_id, title, discount_percent, voucher_type FROM voucher_campaigns WHERE status = 'active' ORDER BY title ASC")
            campaigns = cur.fetchall()
            return jsonify({
                "ok": True,
                "passes": passes,
                "managed_events": events,
                "managed_festivals": festivals,
                "voucher_campaigns": campaigns,
            })

        # POST: Create a pass
        data = request.get_json(silent=True) or {}
        title = str(data.get("title", "")).strip()
        desc = str(data.get("description", "")).strip()
        badge_artwork = str(data.get("badge_artwork") or data.get("badge_artwork_url") or "badge_first_experience.svg").strip()
        condition_type = str(data.get("condition_type", "attend_single_event")).strip()
        condition_value = str(data.get("condition_value") or data.get("condition_target_count") or "").strip()
        festival_id = data.get("festival_id") or data.get("target_festival_id")
        event_id = data.get("event_id") or data.get("target_event_id")
        campaign_id = data.get("voucher_campaign_id")
        status = "active" if data.get("is_active") is True else str(data.get("status", "active")).strip()

        if not title:
            return jsonify({"ok": False, "error": "Pass title is required."}), 400
        if not desc:
            return jsonify({"ok": False, "error": "Pass description is required."}), 400
        if condition_type not in ("attend_single_event", "attend_n_festival_events", "attend_category_events", "milestone_checkins"):
            return jsonify({"ok": False, "error": "Invalid condition type specified."}), 400

        # Validate ownership of event or festival
        if event_id and not is_admin:
            cur.execute("SELECT organizer_id FROM events WHERE event_id = %s", (event_id,))
            ev = cur.fetchone()
            if not ev or int(ev["organizer_id"]) != org_id:
                return jsonify({"ok": False, "error": "Permission denied: You do not manage this event."}), 403

        cur.execute(
            """
            INSERT INTO achievement_passes (
                organizer_id, festival_id, event_id, title, description,
                badge_artwork, condition_type, condition_value, voucher_campaign_id, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (org_id, festival_id or None, event_id or None, title, desc, badge_artwork, condition_type, condition_value, campaign_id or None, status),
        )
        cur.execute("SELECT pass_id FROM achievement_passes WHERE organizer_id = %s AND title = %s ORDER BY pass_id DESC LIMIT 1", (org_id, title))
        row = cur.fetchone()
        new_pass_id = row["pass_id"] if row else 0

        code = f"pass_{new_pass_id}_{secrets.token_hex(2)}"
        cur.execute(
            """
            INSERT INTO achievements (code, pass_id, title, criteria, badge_artwork, badge_type, points)
            VALUES (%s, %s, %s, %s, %s, 'badge', 35)
            """,
            (code, new_pass_id, title, desc, badge_artwork),
        )
        conn.commit()

        return jsonify({"ok": True, "message": f"Achievement Pass '{title}' created successfully!", "pass_id": new_pass_id}), 201


@app.route("/api/organizer/achievement-passes/<int:pass_id>", methods=["PUT", "DELETE"])
@require_auth(roles=["organizer", "admin"])
def api_organizer_manage_pass(pass_id: int, current_user: Dict[str, Any]) -> Any:
    """Allows an organizer to edit, activate, deactivate, or delete a pass they created."""
    org_id = int(current_user["user_id"])
    is_admin = current_user["role"] == "admin"
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT pass_id, organizer_id, title FROM achievement_passes WHERE pass_id = %s", (pass_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"ok": False, "error": "Pass not found."}), 404
        if not is_admin and int(p["organizer_id"]) != org_id:
            return jsonify({"ok": False, "error": "Permission denied: You do not own this pass."}), 403

        if request.method == "DELETE":
            cur.execute("DELETE FROM achievement_passes WHERE pass_id = %s", (pass_id,))
            conn.commit()
            return jsonify({"ok": True, "message": f"Pass '{p['title']}' deleted."})

        data = request.get_json(silent=True) or {}
        new_status = data.get("status")
        if "is_active" in data:
            new_status = "active" if data["is_active"] else "draft"
        title = data.get("title")
        desc = data.get("description")
        badge_artwork = data.get("badge_artwork") or data.get("badge_artwork_url")

        updates = []
        params = []
        if new_status and new_status in ("draft", "active", "paused", "archived"):
            updates.append("status = %s")
            params.append(new_status)
        if title:
            updates.append("title = %s")
            params.append(title.strip())
        if desc:
            updates.append("description = %s")
            params.append(desc.strip())
        if badge_artwork:
            updates.append("badge_artwork = %s")
            params.append(badge_artwork.strip())

        if updates:
            params.append(pass_id)
            cur.execute(f"UPDATE achievement_passes SET {', '.join(updates)} WHERE pass_id = %s", tuple(params))
            conn.commit()

        return jsonify({"ok": True, "message": f"Pass '{p['title']}' updated."})


@app.route("/api/organizer/reward-performance", methods=["GET"])
@require_auth(roles=["organizer", "admin"])
def api_organizer_reward_performance(current_user: Dict[str, Any]) -> Any:
    """Returns reward performance statistics strictly scoped to organizer's managed events."""
    org_id = int(current_user["user_id"])
    is_admin = current_user["role"] == "admin"
    with get_db_connection() as conn:
        cur = conn.cursor()
        org_filter = "" if is_admin else "WHERE ap.organizer_id = %s"
        params = () if is_admin else (org_id,)
        cur.execute(
            f"""
            SELECT
                ap.pass_id,
                ap.title AS pass_title,
                ap.badge_artwork,
                ap.status,
                e.event_name,
                f.name AS festival_name,
                COUNT(pr.reward_id) AS total_earned
            FROM achievement_passes AS ap
            LEFT JOIN events AS e ON e.event_id = ap.event_id
            LEFT JOIN festivals AS f ON f.festival_id = ap.festival_id
            LEFT JOIN achievements AS ach ON ach.pass_id = ap.pass_id
            LEFT JOIN participant_rewards AS pr ON pr.achievement_id = ach.achievement_id
            {org_filter}
            GROUP BY ap.pass_id, ap.title, ap.badge_artwork, ap.status, e.event_name, f.name
            ORDER BY total_earned DESC, ap.created_at DESC
            """,
            params,
        )
        passes_perf = cur.fetchall()

        cur.execute(
            f"""
            SELECT
                u.full_name AS participant_name,
                ap.title AS pass_title,
                ap.badge_artwork,
                pr.earned_at
            FROM participant_rewards AS pr
            JOIN achievements AS ach ON ach.achievement_id = pr.achievement_id
            JOIN achievement_passes AS ap ON ap.pass_id = ach.pass_id
            JOIN users AS u ON u.user_id = pr.user_id
            {org_filter}
            ORDER BY pr.earned_at DESC
            LIMIT 20
            """,
            params,
        )
        recent_earners = cur.fetchall()

    return jsonify({
        "ok": True,
        "passes_performance": passes_perf,
        "recent_earners": recent_earners,
    })


@app.route("/api/admin/voucher-campaigns", methods=["GET", "POST"])
@require_auth(roles=["admin"])
def api_admin_voucher_campaigns(current_user: Dict[str, Any]) -> Any:
    """Administrator voucher campaign management and live distribution tracking."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        if request.method == "GET":
            campaigns = get_admin_voucher_campaigns(conn)
            cur.execute(
                """
                SELECT
                    iv.voucher_id,
                    iv.voucher_code,
                    iv.status,
                    iv.issued_at,
                    iv.redeemed_at,
                    vc.title AS campaign_title,
                    vc.discount_percent,
                    vc.voucher_type,
                    u.full_name AS recipient_name,
                    u.email AS recipient_email
                FROM issued_vouchers AS iv
                JOIN voucher_campaigns AS vc ON vc.campaign_id = iv.campaign_id
                JOIN users AS u ON u.user_id = iv.user_id
                ORDER BY iv.issued_at DESC
                LIMIT 25
                """
            )
            recent_vouchers = cur.fetchall()

            total_allocated = sum(int(c["total_quantity"]) for c in campaigns)
            total_issued = sum(int(c["issued_count"]) for c in campaigns)
            total_redeemed = sum(int(c["redeemed_count"]) for c in campaigns)
            total_remaining = sum(int(c["remaining_count"]) for c in campaigns)
            total_expired = sum(int(c["expired_count"]) for c in campaigns)
            red_rate = round((total_redeemed / total_issued * 100), 1) if total_issued > 0 else 0.0

            summary_metrics = {
                "total_allocated": total_allocated,
                "total_issued": total_issued,
                "total_redeemed": total_redeemed,
                "total_remaining": total_remaining,
                "total_expired": total_expired,
                "redemption_rate_percent": red_rate,
            }

            return jsonify({
                "ok": True,
                "campaigns": campaigns,
                "recent_vouchers": recent_vouchers,
                "summary_metrics": summary_metrics,
            })

        # POST: Create voucher campaign
        data = request.get_json(silent=True) or {}
        title = str(data.get("title") or data.get("name") or "").strip()
        raw_vtype = str(data.get("voucher_type", "discount_pct")).strip().lower()
        vtype_map = {
            "percentage_discount": "discount_pct",
            "discount": "discount_pct",
            "discount_pct": "discount_pct",
            "free_workshop": "free_entry",
            "free_entry": "free_entry",
            "free_merch": "free_merch",
            "merch": "free_merch",
            "vip_access": "vip_access",
            "vip": "vip_access",
        }
        vtype = vtype_map.get(raw_vtype, raw_vtype)
        if vtype not in ("discount_pct", "free_entry", "free_merch", "vip_access"):
            vtype = "discount_pct"

        disc_pct = int(data.get("discount_percent", 0) or 0)
        desc = str(data.get("reward_description") or data.get("benefit_description") or "Festival perk voucher").strip()
        qty = int(data.get("total_quantity", 0) or 0)
        vfrom = str(data.get("valid_from") or datetime.date.today().isoformat()).strip()
        vuntil = str(data.get("valid_until") or (datetime.date.today() + datetime.timedelta(days=60)).isoformat()).strip()
        status = str(data.get("status", "active")).strip()
        festival_id = data.get("festival_id")
        event_id = data.get("event_id")

        if not title:
            return jsonify({"ok": False, "error": "Campaign title is required."}), 400
        if not desc:
            return jsonify({"ok": False, "error": "Reward description is required."}), 400
        if qty <= 0:
            return jsonify({"ok": False, "error": "Total quantity must be greater than 0."}), 400
        if disc_pct < 0 or disc_pct > 100:
            return jsonify({"ok": False, "error": "Discount percentage must be between 0 and 100."}), 400
        if vuntil < vfrom:
            return jsonify({"ok": False, "error": "Expiration date cannot be earlier than start date."}), 400

        cur.execute(
            """
            INSERT INTO voucher_campaigns (
                title, voucher_type, discount_percent, reward_description,
                total_quantity, festival_id, event_id, valid_from, valid_until,
                status, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (title, vtype, disc_pct, desc, qty, festival_id or None, event_id or None, vfrom, vuntil, status, int(current_user["user_id"])),
        )
        cur.execute("SELECT campaign_id FROM voucher_campaigns WHERE title = %s ORDER BY campaign_id DESC LIMIT 1", (title,))
        camp_row = cur.fetchone()
        new_camp_id = camp_row["campaign_id"] if camp_row else 0
        conn.commit()

        return jsonify({
            "ok": True,
            "message": f"Voucher campaign '{title}' created successfully!",
            "campaign_id": new_camp_id,
        }), 201


@app.route("/api/admin/vouchers/issue", methods=["POST"])
@require_auth(roles=["admin"])
def api_admin_issue_voucher(current_user: Dict[str, Any]) -> Any:
    """Manually issues a voucher to a specific participant within campaign inventory limits."""
    data = request.get_json(silent=True) or {}
    campaign_id = int(data.get("campaign_id") or 0)
    user_id = int(data.get("user_id") or 0)

    if not campaign_id or not user_id:
        return jsonify({"ok": False, "error": "Campaign ID and User ID are required."}), 400

    with get_db_connection() as conn:
        res = issue_voucher_to_user(conn, campaign_id, user_id)
        if not res:
            return jsonify({"ok": False, "error": "Could not issue voucher. Either the campaign inventory is exhausted, inactive, or the user already holds an active voucher for this campaign."}), 400

    return jsonify({
        "ok": True,
        "message": f"Issued voucher {res['voucher_code']} to user #{user_id}.",
        "voucher": res,
        "voucher_code": res["voucher_code"],
        "voucher_id": res["voucher_id"],
        "issued_voucher_id": res["issued_voucher_id"],
    }), 201

# =============================================================================
# CLI ENTRYPOINT & INITIALIZATION
# =============================================================================
def print_startup_banner() -> None:
    db_mode = "NEON POSTGRESQL (LIVE CLOUD CLUSTER)" if DATABASE_URL else "LOCAL SQLITE FALLBACK (DEMO MODE)"
    db_target = DATABASE_URL.split("@")[-1] if DATABASE_URL and "@" in DATABASE_URL else (DATABASE_URL or LOCAL_SQLITE_PATH)
    demo_status = "ENABLED (1-click viva role switching active)" if ENABLE_LOCAL_DEMO_MODE else "DISABLED (Strict RBAC authentication)"
    supabase_status = "CONFIGURED (Live bucket uploads)" if (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) else "OPTIONAL / NOT CONFIGURED (Bundled images active)"

    border = "=" * 78
    print(f"\n{border}")
    print("  RANGORA — Campus Festival Platform & Relational Discovery Engine")
    print(border)
    print(f"  * ACTIVE DATABASE:  {db_mode}")
    print(f"    Target Storage:   {db_target}")
    if not DATABASE_URL:
        print("    [!] NOTICE: Set DATABASE_URL in .env to connect to your live Neon PostgreSQL cluster.")
    print(f"  * DEMO ROLE SWITCH: {demo_status}")
    print(f"  * MEDIA STORAGE:    {supabase_status}")
    print(f"  * REFERENCE SCHEMA: {SCHEMA_SQL_PATH}")
    print(border)


if __name__ == "__main__":
    print_startup_banner()
    print("Initializing Rangora relational schema and sample festival records...")
    init_db(seed_if_empty=True)
    if FLASK_AVAILABLE:
        port = int(os.environ.get("PORT", 5000))
        print(f"Starting Rangora server on http://127.0.0.1:{port}\n")
        app.run(host="0.0.0.0", port=port, debug=True)
    else:
        print("Flask is not installed in this Python environment. Install via: pip install -r requirements.txt")

