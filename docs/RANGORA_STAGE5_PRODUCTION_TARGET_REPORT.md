# Rangora 2.0 — Stage 5: Production Neon Target Preparation Report

**Date:** 2026-11-12  
**Target Environment:** Neon PostgreSQL Production Target (`main` branch)  
**Expected Timeline ID:** `ff6dc35ad13680c0a665fbd20e4d4876`  
**Validation Timeline ID (Isolated):** `5f158bb406de27fe9f592ee841655ebe`  
**Execution Mode:** **Read-Only Inspection & Dry-Run Validation Only**  
**Database Modification Status:** **ZERO DDL/DML executed. Production remains untouched.**

---

## 1. Executive Summary

The production database connection was restored and verified in accordance with safety instructions.
1. **Production Direct Connection Restored:** `DATABASE_URL_DIRECT` was recovered with 100% confidence and configured in `.env` to point directly to production compute endpoint `ep-shy-wildflower-ben4ibwk.c-9.us-east-2.aws.neon.tech` (port 5432).
2. **Production Pooled Connection Preserved:** `DATABASE_URL` remains the pooled PgBouncer endpoint `ep-shy-wildflower-ben4ibwk-pooler.c-9.us-east-2.aws.neon.tech`.
3. **Timeline ID Verified:** On an active direct connection, `SHOW neon.timeline_id` returned `ff6dc35ad13680c0a665fbd20e4d4876`, confirming 100% match with the expected production branch.
4. **Branch Separation Confirmed:** The production timeline (`ff6dc35ad13680c0a665fbd20e4d4876`) and validation timeline (`5f158bb406de27fe9f592ee841655ebe`) operate on separate compute endpoints and distinct timeline IDs.
5. **Dry-Run Completed Safely:** `node scripts/apply-neon-migrations.mjs --dry-run` successfully targeted the production direct endpoint and scheduled migrations 0007 and 0008 without modifying the database.

---

## 2. Redacted Target & Branch Separation Comparison

| Inspection Parameter | Production Branch (`main`) | Validation Branch (`rangora-stage5-validation`) | Isolation Status |
| :--- | :--- | :--- | :---: |
| **Neon Timeline ID** | `ff6dc35ad13680c0a665fbd20e4d4876` | `5f158bb406de27fe9f592ee841655ebe` | **DISTINCT TIMELINES** |
| **Direct Endpoint Host** | `ep-shy-w....c-9.us-east-2.aws.neon.tech` | `ep-dry-t....c-9.us-east-2.aws.neon.tech` | **DISTINCT COMPUTE** |
| **Host Mode** | Direct Compute (`port 5432`) | Direct Compute (`port 5432`) | Direct DDL Mode |
| **Pooled App Endpoint** | `ep-shy-w....-pooler.c-9.us-east-2.aws.neon.tech` | N/A | App Traffic Only |
| **Database Name** | `neondb` | `neondb` | Same Schema Namespace |
| **SSL Enforcement** | `sslmode=require` | `sslmode=require` | Verified TLS |
| **Migration Ledger Table** | **Not Present (`false`)** | **Present (`true`, 2 entries)** | **UNTOUCHED ON PROD** |

*Verification:* The production branch compute instance is completely separate from the validation branch. No cross-branch contamination occurred.

---

## 3. Read-Only Production Target Verification Checks

A direct, read-only probe was executed over `DATABASE_URL_DIRECT`:

- **Database Name:** `neondb` (100% match with expected)
- **Connected Role:** `neondb_owner`
- **PostgreSQL Version:** `PostgreSQL 18.6 (ac70818)`
- **Host Port:** `5432` (Direct compute connection, `isPooler === false`)
- **Active Timeline ID:** `ff6dc35ad13680c0a665fbd20e4d4876` (100% match with expected production timeline)
- **Public Domain Tables:** 21 tables present from the initial schema baseline (`achievements`, `admin_profiles`, `attendance`, `categories`, `event_badges`, `events`, `festivals`, `help_requests`, `leaderboard`, `organiser_profiles`, `profiles`, `registrations`, `review_likes`, `reviews`, `reward_awards`, `sponsors`, `user_achievements`, `user_event_badges`, `user_roles`, `user_vouchers`, `voucher_campaigns`).
- **Migration Ledger Status:** `SELECT to_regclass('public._rangora_migrations')` returned `null` (`false`).
- **Audit Conclusion:** The production database has **not** acquired any migration runner ledger records or unexpected modifications.

---

## 4. Migration Runner Dry-Run Outcome

Executed:
```bash
node scripts/apply-neon-migrations.mjs --dry-run
```

Output:
```text
=============================================================================
         RANGORA 2.0 — NEON MIGRATION RUNNER (DRY RUN MODE)
=============================================================================
Protection:  NO DATABASE WRITES PERFORMED (Safe read-only inspection)
Endpoint:    Direct Compute (port 5432, pooler bypass enforced)
Target:      postgresql://[REDACTED_USER]:[REDACTED_PASS]@ep-shy-w....c-9.us-east-2.aws.neon.tech/neondb
             Host Pooler: DIRECT COMPUTE (CORRECT)
             SSL Mode:    require
-----------------------------------------------------------------------------
MIGRATION FILES SCHEDULED:

 [1/2] 0007_neon_complete_schema_and_functions
     File:        0007_neon_complete_schema_and_functions.sql
     Size:        14,718 bytes (399 lines)
     SHA-256:     e5e40c71b98d565261bd5f12a4da01049474d4e5257fd356e340ab273a5bcd83
     Description: Consolidated 21 domain tables, constraints, indexes, 5 triggers, and sync procedures

 [2/2] 0008_neon_seed_catalogue_data
     File:        0008_neon_seed_catalogue_data.sql
     Size:        23,955 bytes (111 lines)
     SHA-256:     55863ee8c77248328437c152ee7f8faba865ccde911fda2f05ca968bee43cc84
     Description: Catalogue & reference seed data (38 events, 8 categories, 6 festivals, 13 badges, 5 voucher campaigns)

-----------------------------------------------------------------------------
DRY-RUN STATUS: PASS
All migration files exist, are readable, and direct credentials are validly formatted.
Zero modifications were made to the database.

To execute migrations against Neon, run with explicit approval flag:
   node scripts/apply-neon-migrations.mjs --apply

=============================================================================
```

*Findings:*
- Identified direct production compute endpoint `ep-shy-w...`
- Verified pooler bypass (`Host Pooler: DIRECT COMPUTE`).
- Scheduled only `0007` and `0008` with identical SHA-256 checksums.
- Zero modifications were made to the production database.

---

## 5. Security & Credential Hygiene Confirmation

- Zero usernames, passwords, API keys, or raw connection strings were logged or displayed.
- Supabase environment variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, etc.) and Gemini environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`) remain untouched.
- `DATABASE_URL` remains pointed to the production pooled proxy.
- `DATABASE_URL_DIRECT` is restored to the direct production compute instance.
- No `--apply` execution was performed on production.

---

## 6. Ready State & Blockers

- **Blockers:** None.
- **Verification Status:** Ready for authorized production migration when approved with explicit timeline guard:
  ```bash
  node scripts/apply-neon-migrations.mjs --apply --expect-timeline-id ff6dc35ad13680c0a665fbd20e4d4876
  ```

