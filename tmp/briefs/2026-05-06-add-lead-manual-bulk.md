# Brief: Manual + Bulk Add Lead in Leads Tab (+ AI Enhance fix)

## Why
Today, leads enter the system only through Apollo enrichment (`LeadGeneratorPage`) or campaign CSV import. There is no path for a user to add a lead from their personal contacts or research. Users want a fast, low-friction way to add one lead manually OR paste a messy block of contacts and have AI structure them.

Separately, the "AI Enhance / text cleanup" button (todo notes, etc. — unrelated to leads) is broken because the OpenRouter model ID is invalid. Fix in the same change set since both involve the OpenRouter integration.

## Context

**Database:** Supabase (confirmed — `supabase/` dir, edge functions, RLS, migrations). Not Neon.

**Leads tab:** `src/pages/LeadsPage.tsx`. No add-lead UI exists today. Add button goes here.

**`leads` table** (per `src/types/crm.ts:14-37` + migrations):
- `NOT NULL`: `first_name`, `last_name`, `email`, `job_title`, `company`, `company_size`
- Nullable: `phone`, `industry`, `location`, `notes`, `tags`, `linkedin_url`, `email_status`, `timezone`, `apollo_id`
- Defaults: `status='cold'`, `assigned_to=NULL`, `call_count=0`, `email_count=0`, `created_at=now()`
- RLS allows employees + admins to INSERT (employees auto-scope to self via `assigned_to=auth.uid()`)

**TanStack Query key:** `['leads']` in `src/hooks/use-leads.ts:11`. Single invalidation point.

**Edge function pattern:** All LLM calls go through Supabase edge functions, never browser-direct. Examples: `assign-leads-ai`, `lead-gen-chat`, `apollo-search`, `campaign-ai`, `todo-ai-enhance`, `generate-template`.

**Existing API insert path:** `supabase/functions/api-leads/index.ts:74-93` — accepts array or single object; admins can set `assigned_to`, employees auto-self-assign. No payload validation today.

**AI Enhance breakage:** `supabase/functions/todo-ai-enhance/index.ts:34` calls model `inception/mercury-coder-small-beta` — not a valid OpenRouter model ID. Used by `TodoDetailSheet.tsx:115-135` and `TodoCreateForm.tsx:49-64`. The separate `TemplateEditor.tsx` cleanup button uses `generate-template` with `openai/gpt-4.1-mini` (likely working — confirm with user later).

## Decisions

- **Add Lead button** placed on Leads tab — opens a dialog with two tabs: Manual (default, top) and Bulk Paste.
- **Manual tab** = standard form for one lead. Required fields: `first_name` + (email OR phone). Everything else optional.
- **Bulk tab** = big textarea + Process button. On Process, calls a new Supabase edge function `bulk-leads-parse` that hits OpenRouter with model `anthropic/claude-sonnet-4.6` and returns structured leads.
- **Review step** = editable table (one row per parsed lead, all fields inline, per-row edit/remove). Header asks "Does this look good?". Submit button at bottom.
- **Schema migration** to relax `NOT NULL` on `last_name`, `job_title`, `company`, `company_size`, plus a CHECK constraint requiring `first_name IS NOT NULL AND (email IS NOT NULL OR phone IS NOT NULL)`. Verify carefully against prod before applying — user will grant DB access when ready.
- **Dedup**: on submit, check email collisions. Default = skip duplicate; show "duplicate" badge in the review table so user sees what was skipped. Low-frequency edge case, intentionally minimal.
- **Bulk cap** = ~100 leads per paste (clear error otherwise). Keeps one LLM call fast and the review table usable.
- **Assignment**: follow existing convention — employees auto-self-assign, admins can leave unassigned. Mirror `api-leads` edge function logic.
- **Cache invalidation**: invalidate `['leads']` on submit. New leads behave identically to Apollo-sourced leads.
- **AI Enhance fix**: swap `inception/mercury-coder-small-beta` → the correct **Mercury 2** OpenRouter slug. Verify exact slug on OpenRouter before editing code (do not guess). Redeploy `todo-ai-enhance` edge function.

## Rejected Alternatives

- **Keep schema, fill missing fields with `""`** — pollutes data; breaks downstream code that assumes non-empty strings.
- **Keep all fields required in form** — defeats the "quick" goal; manual contacts rarely have job_title / company_size.
- **Editable cards instead of table** — fine for 1-5 leads, painful at 20-100. Table scales better.
- **Browser-direct OpenRouter call** — violates existing pattern; leaks API key. Edge function it is.
- **Switch AI Enhance to Sonnet** — overkill for plain text cleanup. User explicitly wants Mercury 2 (cheap + fast for that job).
- **Stream/chunk unlimited bulk paste** — added complexity for v1; cap is simpler.

## Where Reasoning Clashed

None — every decision settled cleanly. The only soft area is the exact Mercury 2 OpenRouter slug, which we will verify against OpenRouter docs at implementation time rather than guess now.

## One Thing to Do First

Verify the exact Mercury 2 model slug on OpenRouter (e.g. `inception/mercury-2`, `inception/mercury`, etc.) so the AI Enhance fix is one-line accurate. Five-minute task; unblocks the smaller of the two pieces of work.

## Direction

Add a single dialog to the Leads tab with Manual + Bulk tabs. Bulk runs a new `bulk-leads-parse` edge function (Sonnet 4.6) and surfaces results in an editable review table before insert. One small migration relaxes overly-strict NOT NULL columns to make manual entry humane. Separately, fix the broken `todo-ai-enhance` model slug to restore the AI Enhance button. All LLM work stays server-side via existing edge function pattern.
