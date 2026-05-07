-- Relax lead required fields, add CHECK constraint, add rate_limits table, and
-- add a UNIQUE index on lower(email) for active leads.
--
-- This file IS runnable via `supabase db push`. It's also the canonical reference
-- for the manual prod migration applied via Supabase Studio on 2026-05-06.
--
-- For PRODUCTION rollouts on a live `leads` table, do NOT run this file as-is via
-- `supabase db push` against prod (the inline non-concurrent UNIQUE INDEX creation
-- briefly takes a SHARE-mode lock that blocks writes). Instead, drop the
-- `CREATE UNIQUE INDEX idx_leads_email_unique` line and run the equivalent
-- `CREATE UNIQUE INDEX CONCURRENTLY` separately via Studio (see
-- ~/Downloads/connect-crm-add-lead-handoff/RUNBOOK.md, Step 2).
--
-- For fresh dev/preview/CI databases, the inline form here is correct and
-- unblocks `supabase db push`-driven bootstrap.

BEGIN;

-- Defense in depth: prevent concurrent inserts during the brief transaction window
-- so a row written between verification and CHECK ADD can't slip past validation.
LOCK TABLE public.leads IN SHARE MODE;

-- A. Lowercase backfill (fast; uses btree on PK)
UPDATE public.leads SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

-- B. Relax NOT NULL on the four columns
ALTER TABLE public.leads ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN job_title DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN company DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN company_size DROP NOT NULL;

-- C. CHECK constraint: first_name required + at least one of email/phone present.
ALTER TABLE public.leads
  ADD CONSTRAINT leads_first_name_and_contact_required
  CHECK (
    first_name IS NOT NULL AND first_name <> '' AND
    ((email IS NOT NULL AND email <> '') OR (phone IS NOT NULL AND phone <> ''))
  );

-- D. UNIQUE partial index — DB-enforced dedup. Catches RLS-blind cases, in-batch
--    dupes, and concurrent-call races. Predicate excludes soft-deleted rows AND
--    rows with NULL/empty email (phone-only leads can repeat).
--    NOTE: non-CONCURRENT here so it works inside the transaction. For PROD on a
--    live table, see file header for the CONCURRENTLY variant.
CREATE UNIQUE INDEX idx_leads_email_unique
  ON public.leads (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> '';

-- E. Rate limits table (for bulk-leads-parse and other rate-limited edge functions).
--    SERVICE ROLE REQUIRED for inserts; RLS enabled with no policies = deny-all to
--    authenticated browser clients. Cleanup cron not yet implemented; v1 accepts
--    unbounded growth.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, called_at DESC);
COMMENT ON TABLE public.rate_limits IS
  'Per-user, per-action call log for sliding-window rate limiting. SERVICE ROLE REQUIRED for inserts; RLS enabled with no policies (deny-all). Cleanup cron not yet implemented; v1 accepts unbounded growth.';

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

COMMIT;
