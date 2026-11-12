# Rangora 2.0 — Demonstration SQL Cookbook
**Target Database**: Dedicated Neon PostgreSQL Demo Branch (`DATABASE_URL_DEMO`)  
**Audience**: Project Evaluators, Faculty Examiners, and System Administrators

> [!IMPORTANT]
> **Active Backend Notice**:
> Rangora 2.0 is currently operating against the **Local JSON Demo Repository** (`.demo-data/demo-state.json`).
> Writes made within the `/demo` workspace persist locally to this isolated store and **do NOT** appear in Neon until `DATABASE_URL_DEMO` is configured with credentials for a dedicated Neon demo branch.
> 
> The queries in this cookbook represent the **exact schema-level verification queries** to run in the **Neon SQL Editor** once `DATABASE_URL_DEMO` is connected or after restoring `backup/complete_application_data_backup.json` to PostgreSQL. All demo user IDs in this cookbook use standard RFC 4122 v4 UUIDs for strict PostgreSQL `uuid` type compatibility.

---

## Standard Demo Actor UUIDs
| Actor Role | Display Name | Canonical RFC 4122 UUID |
|---|---|---|
| **Participant** | Maya Sen | `'d3300001-0000-4000-8000-000000000001'` |
| **Organiser** | Ritwik Das (Campus Arts Guild) | `'d3300002-0000-4000-8000-000000000002'` |
| **Administrator** | Dean Kabir Mehta (Secretariat) | `'d3300003-0000-4000-8000-000000000003'` |
| **Pending Organiser** | Aarav Sen (Robotics Guild) | `'d3300004-0000-4000-8000-000000000004'` |
| **Approved Curator** | Sneha Roy (Cinema Collective) | `'d3300005-0000-4000-8000-000000000005'` |

---

## Journey A: Registration & Seat Pulse

### Query A.1 — Inspect Participant Registrations & Pass Codes
*Purpose: Verifies that when Maya Sen registers for an event, a real registration record with a cryptographic pass code is persisted.*
```sql
SELECT 
    r.id AS registration_id,
    r.user_id,
    p.full_name AS participant_name,
    e.id AS event_id,
    e.name AS event_name,
    r.kind AS pass_type,
    r.pass_code,
    r.created_at
FROM public.registrations r
JOIN public.profiles p ON p.id = r.user_id
JOIN public.events e ON e.id = r.event_id
WHERE r.user_id = 'd3300001-0000-4000-8000-000000000001'
ORDER BY r.created_at DESC;
```
**Interpretation**:
- Rows with `kind = 'booked'` represent confirmed passes with ticket codes (e.g. `RNG-DEMO-1043`).
- Rows with `kind = 'planned'` represent items saved to Maya's personal festival plan without reserving a seat.

---

### Query A.2 — Seat Pulse Live Seat Availability Calculation
*Purpose: Demonstrates that remaining seats are calculated dynamically from confirmed registrations.*
```sql
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    e.venue,
    e.max_seats AS total_capacity,
    COUNT(r.id) FILTER (WHERE r.kind = 'booked') AS booked_seats,
    (e.max_seats - COUNT(r.id) FILTER (WHERE r.kind = 'booked')) AS remaining_seats,
    CASE 
        WHEN (e.max_seats - COUNT(r.id) FILTER (WHERE r.kind = 'booked')) <= 0 THEN 'SOLD OUT'
        WHEN (e.max_seats - COUNT(r.id) FILTER (WHERE r.kind = 'booked')) <= 5 THEN 'FILLING FAST'
        ELSE 'AVAILABLE'
    END AS seat_pulse_status
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id
GROUP BY e.id, e.name, e.venue, e.max_seats
ORDER BY e.id;
```
**Interpretation**:
- When Maya books a pass, `booked_seats` increments and `remaining_seats` decrements.
- When Maya cancels a pass, `remaining_seats` increments immediately.

---

## Journey B: Attendance Verification, Badges & Leaderboard

### Query B.1 — Separation of Registration and Attendance
*Purpose: Proves that registration is distinct from physical venue check-in.*
```sql
SELECT 
    r.id AS registration_id,
    r.pass_code,
    p.full_name AS attendee_name,
    e.name AS event_name,
    CASE WHEN a.id IS NOT NULL THEN 'VERIFIED CHECKED-IN' ELSE 'PENDING AT DOOR' END AS checkin_status,
    a.scanned_at,
    a.scanned_by
FROM public.registrations r
JOIN public.profiles p ON p.id = r.user_id
JOIN public.events e ON e.id = r.event_id
LEFT JOIN public.attendance a ON a.registration_id = r.id
WHERE r.user_id = 'd3300001-0000-4000-8000-000000000001';
```
**Interpretation**:
- Before check-in: `checkin_status` is `PENDING AT DOOR` and `a.id` is `NULL`.
- After Organiser scans `RNG-DEMO-1043`: a separate audit record is written to `public.attendance` with the scanner timestamp.

---

### Query B.2 — Participant Achievement & Badge Audit
*Purpose: Inspects badges awarded based on genuine participation conditions.*
```sql
SELECT 
    ua.user_id,
    p.full_name,
    ua.code AS achievement_code,
    a.title AS badge_title,
    a.points AS point_value,
    ua.earned_at
FROM public.user_achievements ua
JOIN public.achievements a ON a.code = ua.code
JOIN public.profiles p ON p.id = ua.user_id
WHERE ua.user_id = 'd3300001-0000-4000-8000-000000000001'
ORDER BY ua.earned_at DESC;
```
**Interpretation**:
- Upon first check-in, `verified_debut` ("Studio Debut") is unlocked (+50 pts).
- Other category badges (e.g. `guild_artisan`, `first_experience`) appear only when criteria are met.

---

### Query B.3 — Leaderboard Recalculation from Source Transactions
*Purpose: Proves that leaderboard scores are calculated from underlying bookings, attendances, and badges.*
```sql
SELECT 
    p.id AS user_id,
    p.full_name,
    p.department,
    -- Formula: 10 pts per booking + 25 pts per verified check-in + badge points
    (COALESCE(regs.booked_count, 0) * 10) +
    (COALESCE(atts.verified_count, 0) * 25) +
    COALESCE(ach.badge_points, 0) AS calculated_points,
    l.points AS leaderboard_table_points
FROM public.profiles p
LEFT JOIN (
    SELECT user_id, COUNT(*) AS booked_count 
    FROM public.registrations 
    WHERE kind = 'booked' 
    GROUP BY user_id
) regs ON regs.user_id = p.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS verified_count 
    FROM public.attendance 
    GROUP BY user_id
) atts ON atts.user_id = p.id
LEFT JOIN (
    SELECT ua.user_id, SUM(a.points) AS badge_points 
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.code = ua.code
    GROUP BY ua.user_id
) ach ON ach.user_id = p.id
LEFT JOIN public.leaderboard l ON l.user_id = p.id
WHERE p.id = 'd3300001-0000-4000-8000-000000000001';
```
**Interpretation**:
- `calculated_points` perfectly matches `leaderboard_table_points`. Points are derived from authentic records, never fabricated.

---

## Journey C: Organiser Event Creation & Venue Schedule Conflicts

### Query C.1 — Venue Schedule Conflict Detection
*Purpose: Detects overlapping events scheduled at the same campus venue.*
```sql
SELECT 
    e1.id AS event_1_id,
    e1.name AS event_1_name,
    e2.id AS event_2_id,
    e2.name AS event_2_name,
    e1.venue,
    e1.start_at AS e1_start,
    e1.end_at AS e1_end,
    e2.start_at AS e2_start,
    e2.end_at AS e2_end
FROM public.events e1
JOIN public.events e2 
  ON e1.id < e2.id 
  AND LOWER(e1.venue) = LOWER(e2.venue)
  AND (e1.start_at < e2.end_at AND e1.end_at > e2.start_at);
```
**Interpretation**:
- If an organiser tries to create an event at the same venue and overlapping time window, the system throws a schedule conflict error (`events_no_clash`).
- Zero rows in this query confirms a conflict-free festival schedule.

---

### Query C.2 — Newly Published Events Visibility
*Purpose: Verifies that events published by organisers immediately enter the public catalogue.*
```sql
SELECT 
    e.id,
    e.name,
    e.venue,
    e.price,
    e.max_seats,
    e.published,
    op.org_name AS host_guild,
    e.created_at
FROM public.events e
LEFT JOIN public.organiser_profiles op ON op.user_id = e.organiser_id
WHERE e.published = true
ORDER BY e.created_at DESC
LIMIT 5;
```

---

## Journey D: Admin Organiser Application Review

### Query D.1 — Organiser Application & RBAC Status
*Purpose: Proves that administrator approval transitions the club profile and syncs user roles.*
```sql
SELECT 
    op.user_id,
    p.full_name AS applicant_name,
    op.org_name,
    op.org_type,
    op.status AS application_status,
    op.reviewed_at,
    STRING_AGG(ur.role, ', ') AS assigned_roles
FROM public.organiser_profiles op
JOIN public.profiles p ON p.id = op.user_id
LEFT JOIN public.user_roles ur ON ur.user_id = op.user_id
WHERE op.user_id = 'd3300004-0000-4000-8000-000000000004'
GROUP BY op.user_id, p.full_name, op.org_name, op.org_type, op.status, op.reviewed_at;
```
**Interpretation**:
- Before admin review: `application_status = 'pending'`, `assigned_roles = 'participant'`.
- After admin approves: `application_status = 'approved'`, and the trigger `sync_organiser_role_after_review` automatically adds `'organizer'` to `user_roles`.

---

## Journey E: Voucher Campaign Stock & Redemption

### Query E.1 — Voucher Campaign Stock and Issued Count
*Purpose: Inspects remaining voucher inventory before and after participant issuance.*
```sql
SELECT 
    vc.id AS campaign_id,
    vc.title AS campaign_name,
    vc.pct AS discount_percent,
    vc.stock AS current_stock,
    COUNT(uv.id) AS claimed_count
FROM public.voucher_campaigns vc
LEFT JOIN public.user_vouchers uv ON uv.campaign_id = vc.id
GROUP BY vc.id, vc.title, vc.pct, vc.stock
ORDER BY vc.id;
```
**Interpretation**:
- When Admin issues a voucher to Maya (or Maya claims a perk), `current_stock` decrements by 1 and `claimed_count` increments by 1.

---

### Query E.2 — Participant Claimed & Redeemed Vouchers
*Purpose: Verifies voucher ownership in Maya Sen's festival wallet.*
```sql
SELECT 
    uv.id AS voucher_id,
    uv.user_id,
    vc.title AS perk_title,
    uv.code AS voucher_code,
    uv.issued_at
FROM public.user_vouchers uv
JOIN public.voucher_campaigns vc ON vc.id = uv.campaign_id
WHERE uv.user_id = 'd3300001-0000-4000-8000-000000000001'
ORDER BY uv.issued_at DESC;
```
**Interpretation**:
- When Maya clicks "Redeem at Counter", the voucher is consumed and recorded as redeemed.

---

## Journey F: Event Echo Reviews & Organiser Likes

### Query F.1 — Event Echo Submission & Organiser Like Audit
*Purpose: Verifies participant review storage, media paths, and organiser appreciation endorsement.*
```sql
SELECT 
    r.id AS review_id,
    e.name AS event_name,
    r.author_name,
    r.rating,
    r.comment,
    r.visibility,
    r.liked_by_organiser,
    r.tagged_friends,
    r.created_at
FROM public.reviews r
JOIN public.events e ON e.id = r.event_id
ORDER BY r.created_at DESC
LIMIT 5;
```
**Interpretation**:
- `liked_by_organiser` toggles to `true` when Ritwik Das appreciates Maya's pottery review.
- Reviews with `visibility = 'public'` become eligible for the Event Pulse gallery.

---

## Journey G: Helpdesk Routing & Sponsorship Approval

### Query G.1 — Automated Helpdesk Routing by Category
*Purpose: Proves that help requests targeting specific events route to the responsible organiser.*
```sql
SELECT 
    h.id AS request_id,
    h.author_name,
    h.category,
    h.subject,
    h.status,
    h.routed_to,
    op.org_name AS assigned_organiser,
    h.answer,
    h.created_at
FROM public.help_requests h
LEFT JOIN public.organiser_profiles op ON op.user_id = h.routed_to
ORDER BY h.created_at DESC;
```
**Interpretation**:
- Pottery workshop queries (`event_id = 4`) automatically route to `demo-organiser-ritwik` ("Campus Arts Guild").
- General queries remain with the Administrator Secretariat (`routed_to IS NULL`).

---

### Query G.2 — Sponsorship Proposal Lifecycle
*Purpose: Demonstrates sponsorship proposals submitted by organisers and approved by administrators.*
```sql
SELECT 
    s.id AS sponsor_id,
    s.name AS sponsor_name,
    s.tier,
    s.amount,
    s.status,
    p.full_name AS submitted_by_organiser,
    s.created_at
FROM public.sponsors s
LEFT JOIN public.profiles p ON p.id = s.user_id
ORDER BY s.created_at DESC;
```
**Interpretation**:
- Organiser submits proposal with status `'requested'`.
- Administrator marks proposal `'active'`. Organiser dashboard reflects the approved sponsorship immediately.

---

## Quick Reset Verification

To verify that the demo workspace returns to its clean reference baseline after clicking **Reset Demo Workspace**:
```sql
-- Count baseline records across core demo tables
SELECT 'registrations' AS tbl, COUNT(*) FROM public.registrations
UNION ALL
SELECT 'user_achievements', COUNT(*) FROM public.user_achievements
UNION ALL
SELECT 'events', COUNT(*) FROM public.events
UNION ALL
SELECT 'reviews', COUNT(*) FROM public.reviews
UNION ALL
SELECT 'help_requests', COUNT(*) FROM public.help_requests
UNION ALL
SELECT 'sponsors', COUNT(*) FROM public.sponsors;
```
*(In default demo seed state: registrations=3, achievements=3, reviews=1, help_requests=2, sponsors=2).*

