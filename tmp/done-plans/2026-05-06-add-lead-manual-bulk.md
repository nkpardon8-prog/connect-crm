# Plan: Add Lead (Manual + Bulk Paste) in Leads Tab + AI Enhance Fix — v2

## Goal

Ship two changes:

1. **Add Lead dialog on the Leads tab.** A new "Add Lead" button opens a modal with two tabs: **Manual** (default, single-lead form) and **Bulk Paste** (textarea → AI parse via Sonnet 4.6 on OpenRouter → editable review table → bulk insert). Manually added leads must be indistinguishable from Apollo-sourced leads in the rest of the app (same table, same realtime, same RLS, same assignment rules).
2. **Fix the broken AI Enhance button** by replacing the dead model slug `inception/mercury-coder-small-beta` in `supabase/functions/todo-ai-enhance/index.ts` with the verified-live slug `inception/mercury-2`.

End state: a user can click "Add Lead" → type one lead → submit; OR paste a messy block of contacts → click Process → review/edit a structured table → submit. The To-Do AI Enhance button works again.

## Summary

- **Ship sequence**: AI Enhance fix ships FIRST as an independent commit + deploy (one-line model swap; do not gate behind the larger feature).
- New components: `AddLeadDialog`, `ManualLeadForm`, `BulkLeadPaste`, `BulkLeadReviewTable` under `src/components/leads/add-lead/` (each component co-locates its own validator/types — no shared util file).
- New edge function: `supabase/functions/bulk-leads-parse/index.ts` (OpenRouter Sonnet 4.6, strict JSON, AbortController-friendly, rate-limited via shared util).
- New shared edge-function util: `supabase/functions/_shared/rate-limit.ts` (per-user, per-action, sliding-window — durable across edge cold starts via a new `rate_limits` table).
- New API helper: `src/lib/api/bulk-leads-parse.ts`.
- **Modified**: `src/lib/api/leads.ts` — add server-aware dedup INSIDE `createLeads` with new signature `createLeads(leads, { currentUserId, isAdmin })`. Caller passes auth context (no internal `auth.getUser()` / `profiles.role` round-trips). Handles 23505 unique-violations from the new UNIQUE index. The `api-leads` edge function is NOT touched.
- **Modified**: `src/hooks/use-leads.ts` — expose `addLeadsAsync`. Hook reads `useAuth()` once and passes `{ currentUserId, isAdmin }` into `createLeads` via the mutationFn closure.
- **Modified**: `src/types/crm.ts` — relax 5 fields: `lastName?`, `jobTitle?`, `company?`, `companySize?`, `assignedTo: string | null` (was `string`).
- **Modified**: `src/pages/LeadsPage.tsx` — mount dialog + button in toolbar.
- **Modified**: `supabase/functions/todo-ai-enhance/index.ts` — model swap.
- **NOT modified**: `src/lib/transforms.ts` (it's a pure key-renamer; no schema knowledge needed). `supabase/functions/api-leads/index.ts` (not in the dialog's write path).
- **DB migration**: relax NOT NULL on the 4 lead columns; add CHECK constraint; lowercase backfill of existing emails; **UNIQUE partial index** on `lower(email) WHERE deleted_at IS NULL AND email <> ''` (DB-enforced dedup, defense-in-depth against client-side misses); create `rate_limits` table. Applied via Supabase Studio SQL editor in the browser, driven by chrome-devtools MCP.
- **Final verification**: smoke-test on the live site via chrome-devtools MCP.

## Intent / Why

- **User value**: Today leads only enter via Apollo enrichment or campaign CSV. Users can't add a contact they met at a conference or 30 names from a Slack thread.
- **Bulk paste**: Real-world lead data is messy. Asking users to clean it themselves is the wrong job. Sonnet 4.6 handles unstructured input well.
- **Schema relaxation**: Current `NOT NULL` constraints on `last_name`/`job_title`/`company`/`company_size` are Apollo-shaped, not user-shaped.
- **AI Enhance fix**: Dead model returns 502 → broken button across To-Do feature.
- **Rate limiting**: Dev-grade rate limit on the LLM endpoint to bound damage if a session token leaks.
- **Invariants that must hold**: Apollo flow keeps working unchanged. RLS still scopes employee leads correctly. `['leads']` cache invalidation pattern unchanged. No new browser-side OpenRouter calls.

## Source Artifacts

- Brief: `./tmp/briefs/2026-05-06-add-lead-manual-bulk.md`
- Three independent plan-reviewer passes consumed; v2 incorporates their critical/high/medium findings.

## What

### User-Visible Behavior

- Leads tab toolbar gets a new primary button: **"+ Add Lead"** (placed as the LAST sibling in the toolbar `flex items-center gap-3 flex-wrap` row, with `ml-auto` for right alignment, so it's always visible regardless of `selected.size`).
- Clicking it opens a centered modal with title "Add Lead" and two tabs: **Manual** (active by default) and **Bulk Paste**.
- **Manual tab**: form with First Name (required), Last Name, Email, Phone, Job Title, Company, Company Size, Industry, Location, LinkedIn URL, Status (default `cold`), Notes. Submit button is disabled until First Name + (Email OR Phone) are non-empty after `.trim()`. On submit: insert one lead, invalidate `['leads']`, close dialog, show toast.
- **Bulk Paste tab**: large textarea (~12 rows, monospace), placeholder "paste any messy lead data — names, emails, phones, anything", and a **Process** button (disabled when empty/processing). Below textarea: char counter and hint "~100 leads max per paste".
- After Process click: spinner with "This may take up to a minute" sub-text, then results render below as an editable review table — columns: First Name, Last Name, Email, Phone, Job Title, Company, Industry, Location, and a remove (×) button per row. Cells are inline-editable. Above the table: heading "Does this look good?" and a count "12 leads ready". A "+truncated to 100" warning chip if the LLM truncated. Submit button at bottom: "Add N leads".
- Submit inserts non-duplicate rows (server-side dedup in `createLeads`), invalidates `['leads']`, closes dialog, toast: "Added N leads. M skipped as already-existing emails: x@y.com, z@w.com" (only if M > 0; truncated to first 5 emails).
- Empty parse result ("LLM found 0 leads"): toast "No leads detected — try a clearer paste or smaller batch"; stay on textarea, do not transition to review.
- Manually-added leads appear in the Leads list immediately (realtime + invalidation both fire), are filterable/sortable/editable like any other lead, and are auto-assigned to the creating user (non-admin) or left unassigned (admin).

### Success Criteria

- [ ] Schema migration applied to production via Supabase Studio, verified via post-checks (column nullability, CHECK constraint, lower-email index, rate_limits table).
- [ ] Apollo enrichment path still works end-to-end (verify by importing one Apollo result post-migration).
- [ ] Manual tab: submitting "First Name + Phone only" creates a lead.
- [ ] Manual tab: submit button disabled until first_name + (email OR phone) present.
- [ ] Bulk parse: pasting 5 messy contacts returns 5 structured rows.
- [ ] Bulk parse: pasting >50KB of input returns a clear client-side error before any network call.
- [ ] Bulk parse: 11th call within 60s returns 429 from the rate limiter with message "Rate limited — try again in N seconds".
- [ ] Bulk dedup: a row whose email matches an existing non-deleted lead (case-insensitive) is skipped on submit and surfaced in the toast.
- [ ] AI Enhance button on a To-Do produces refined text instead of a 502 toast.
- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] Final E2E smoke test on the live site via chrome-devtools MCP: AI Enhance → Manual add → Bulk add → duplicate detection.

## Verified Repo Truths

### Data / State

- Fact: `leads` INSERT RLS policy is `is_admin() OR auth.uid() IS NOT NULL` — permissive, does NOT enforce `assigned_to = auth.uid()`.
  Evidence: `supabase/migrations/20260415000001_lead_assignment_rls.sql:19-22`
  Implication: The frontend MUST explicitly set `assigned_to = currentUser.id` for non-admins. Cannot rely on RLS or any edge function (since dialog uses direct insert, not `api-leads`).

- Fact: `leads` UPDATE RLS WITH CHECK does enforce `is_admin() OR assigned_to = auth.uid()`. SELECT lets employees see own + unassigned.
  Evidence: `supabase/migrations/20260415000001_lead_assignment_rls.sql:27-37, 11-16`
  Implication: An employee cannot insert a lead assigned to another user (well, INSERT RLS is permissive; UPDATE is strict — but if a non-admin inserts with `assigned_to = otherUser.id`, the row is created and they can't update it after; weird state). Frontend explicit-self-assign closes this.

- Fact: `createLeads` writes via `supabase.from('leads').insert(snaked)` directly from the browser. It does NOT call any edge function.
  Evidence: `src/lib/api/leads.ts:54-65`
  Implication: All dedup/assignment logic for the Add Lead dialog must live in `createLeads` (TS), NOT in the `api-leads` edge function.

- Fact: `mergePhoneReveals` early-returns when no `apolloId`s in the input array.
  Evidence: `src/lib/api/leads.ts:86-88`
  Implication: Manual/bulk leads have no `apolloId`, so this is a safe no-op. No defensive change needed.

- Fact: `toSnakeCase` in `transforms.ts` is a pure key-renamer with no value-coercion logic.
  Evidence: `src/lib/transforms.ts:29-47`
  Implication: Empty strings pass through verbatim. Adding column-specific null-coercion would break its single responsibility. Don't modify.

- Fact: TanStack Query key for leads is `['leads']`; realtime postgres_changes invalidates on every change.
  Evidence: `src/hooks/use-leads.ts:11, 18-20`
  Implication: After any insert from the dialog, calling `invalidateQueries(['leads'])` is sufficient. The realtime listener will also fire (per-row for bulk inserts of 100 → 100 invalidations; TanStack batches but it's wasteful — acceptable v1).

- Fact: `addLeadsMutation` uses `useMutation` and is exposed as `.mutate(...)` (fire-and-forget, returns `void`). No `addLeadsAsync` exists.
  Evidence: `src/hooks/use-leads.ts:32-38, 53-54`
  Implication: To read `{ inserted, skippedDuplicates }` after submit, MUST add `addLeadsAsync` paralleling the existing `updateLeadAsync` at line 51-52.

- Fact: `Lead` interface requires `tags: string[]`, `assignedTo: string`, `lastContactedAt: string | null`, `notes: string`, `status: LeadStatus`, plus `firstName`, `email`, `phone`, `industry`, `location` as non-optional strings.
  Evidence: `src/types/crm.ts:14-37`
  Implication: Form-submit handler must build the FULL `Omit<Lead, 'id' | 'createdAt'>` object — including defaults for `tags`, `assignedTo`, `lastContactedAt`, `notes`, `status` — not just the fields the form collects.

- Fact: There is no `src/integrations/supabase/types.ts` generated-types file.
  Evidence: Researcher confirmed via codebase-wide search.
  Search Evidence: `find . -path '*/integrations/supabase/types.ts'` returned no results.
  Implication: No codegen step. We update `src/types/crm.ts` manually.

### Entry Points / Integrations

- Fact: All LLM calls go through Supabase edge functions; OpenRouter API key is server-side only.
  Evidence: `.env.example:5`, `supabase/functions/todo-ai-enhance/index.ts:9`, `supabase/functions/assign-leads-ai/index.ts:81`.
  Implication: Bulk parse must be a new edge function. No browser-direct OpenRouter.

- Fact: `assign-leads-ai/index.ts:107` lists EVERY property in `required` — all 7 fields are required. `additionalProperties: false`. `strict: true`. Plain `type: 'string'` for each property (no nullable arrays).
  Evidence: `supabase/functions/assign-leads-ai/index.ts:81-138, especially line 107`
  Implication: This is the only proven pattern in this repo. OpenRouter strict mode (mirroring OpenAI's contract) REQUIRES every property in `properties` to also appear in `required`. The "omit from `required` to mark optional" pattern is non-strict-mode behavior and will likely cause a 400 from OpenRouter. Therefore, `bulk-leads-parse` MUST list every property in `required` and use empty-string sentinels for missing data, then strip empties server-side after parse.

- Fact: `useAuth()` already exposes `{ user, isAdmin }` in the React tree. `user.id` is available; `isAdmin = user?.role === 'admin'`.
  Evidence: `src/contexts/AuthContext.tsx:99` (Provider value)
  Implication: `createLeads` MUST accept `{ currentUserId, isAdmin }` from the caller rather than re-fetching internally. Avoids two extra round-trips per call AND eliminates the silent admin-assignment-corruption window if `profiles.role` SELECT errors transiently.

- Fact: `_shared/auth.ts:46-65 resolveUser` returns `profile.id` selected from the `profiles` table by the JWT-resolved user id, and is used as the canonical user id in edge functions. Implies `profiles.id = auth.users.id` (standard Supabase 1:1 mapping).
  Evidence: `supabase/functions/_shared/auth.ts:46-65`
  Implication: `useAuth().user.id` (= profile id, fetched via `getProfile`) equals `auth.uid()` for INSERT RLS purposes. The frontend's explicit `assigned_to = currentUserId` correctly satisfies the UPDATE RLS WITH CHECK clause (`assigned_to = auth.uid()`).

- Fact: `addLeads` from `useLeads` has TWO existing callers in the codebase: `LeadGeneratorPage.tsx` (Apollo enrichment) AND `CampaignBuilderPage.tsx` (campaign import).
  Evidence: `src/pages/LeadGeneratorPage.tsx:151-168`, `src/pages/CampaignBuilderPage.tsx:512`
  Implication: Both callers must continue to work after the `createLeads` signature change. Since auth context is internalized in `useLeads` (reads from `useAuth`), neither caller's call site changes — but Task 3/4 audit must verify both still typecheck and behave correctly post-change.

- Fact: `_shared/cors.ts` and `_shared/auth.ts` provide reusable CORS + JWT helpers.
  Evidence: `supabase/functions/_shared/cors.ts:1-4`, `supabase/functions/_shared/auth.ts:16-66`
  Implication: `bulk-leads-parse` imports `corsHeaders` and `resolveUser`. New `_shared/rate-limit.ts` will import `corsHeaders` and the supabase admin client pattern.

- Fact: Apollo import flow already dedupes BEFORE calling `addLeads` (per discussion-phase research).
  Evidence: Reported by Explore agent re: `LeadGeneratorPage.tsx:151-168` flow comment "User describes ICP → AI chat → Apollo search → dedup check → batch import".
  Implication: Adding dedup inside `createLeads` is additive and safe — Apollo will pre-filter, then `createLeads` re-filters defensively, with the second pass being a near-no-op. No regression risk.

### Frontend / UI

- Fact: shadcn `Dialog`, `Tabs`, `Input`, `Label`, `Textarea`, `Select`, `Button`, `Badge`, `Table` are all available in `src/components/ui/`.
  Evidence: directory listing confirmed by Explore agent.
  Implication: Zero new UI primitives needed.

- Fact: `ProjectCreateDialog.tsx` is the canonical existing dialog-with-form pattern: controlled `useState`, `Dialog open/onOpenChange` with reset-on-close, derived `canCreate` for disabled submit.
  Evidence: `src/components/todo/ProjectCreateDialog.tsx:1-221`
  Implication: Copy this exact pattern. Do NOT introduce `react-hook-form` or `zod` (zero existing usage in repo).

- Fact: The Leads page toolbar at `LeadsPage.tsx:193-287` uses a single `flex items-center gap-3 flex-wrap` row; the bulk-action buttons block at lines 280-286 is wrapped in `{selected.size > 0 && (...)}` — conditionally rendered.
  Evidence: `src/pages/LeadsPage.tsx:280-287`
  Implication: New `<AddLeadDialog />` must be placed as a sibling AFTER the conditional block (not inside it) with `ml-auto`, so it's always visible regardless of selection state.

- Fact: No existing component uses `react-hook-form` or `zod`.
  Search Evidence: codebase-wide search confirmed no imports of either.
  Implication: Manual `useState` validation is the established pattern. Use it.

## Locked Decisions

- **Dedup location (defense-in-depth)**: client-side pre-check inside `src/lib/api/leads.ts createLeads` for friendly UX (surfaces duplicates in toast); DB-level **UNIQUE partial index** as the authoritative enforcement (catches RLS-blind cases, in-batch dupes, and concurrent-call races).
- **Dedup case-insensitivity**: one-time `UPDATE leads SET email = lower(email)` backfill, then **UNIQUE partial index** `CREATE UNIQUE INDEX idx_leads_email_unique ON public.leads (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> ''`. Going forward, `createLeads` lowercases incoming emails before insert AND pre-check query. On `23505` unique-violation, push the offending email into `skippedDuplicates` and retry insert with that row removed (single retry max).
- **`createLeads` signature**: `createLeads(leads, { currentUserId, isAdmin }): Promise<{ inserted, skippedDuplicates }>`. Caller (the new dialog and existing Apollo path in `LeadGeneratorPage`) reads from `useAuth()` and passes context. NO internal `auth.getUser()` or `profiles.role` SELECT.
- **Frontend assignment rule**: for non-admins, `createLeads` overwrites incoming `assignedTo` with `currentUserId`. For admins, preserves caller's `assignedTo` value (`null` or a specific user id). Form treats empty-string `assignedTo` as `null` via `|| null` (NOT `??`, which would let `''` through).
- **DB column relaxation**: only `last_name`, `job_title`, `company`, `company_size`. Email and phone stay column-nullable but jointly required via CHECK.
- **CHECK constraint**: strict form — `first_name IS NOT NULL AND first_name <> '' AND ((email IS NOT NULL AND email <> '') OR (phone IS NOT NULL AND phone <> ''))`. Constraint name: `leads_first_name_and_contact_required`.
- **Form submits empty fields as `''`**, not `null`. DB accepts both; `''` matches existing data convention. No `transforms.ts` modification needed.
- **Bulk LLM model**: `anthropic/claude-sonnet-4.6` — VERIFY via curl during Task 5 (do not deploy if unverified).
- **AI Enhance model**: `inception/mercury-2` — VERIFY via curl during Task 2.
- **Bulk paste cap**: 50KB textarea (client-side hard reject) AND 100 leads in LLM output (server-side: silently truncate + return `truncated: true` flag for UI warning).
- **Rate limiting**: `bulk-leads-parse` enforces 10 calls per user per 60s rolling window. New `rate_limits` table + new `_shared/rate-limit.ts` util. **Fails CLOSED** on infra error (the whole point is bounding LLM cost during a token leak — fail-open defeats the purpose).
- **Timeout**: client-side `AbortController` with 90s deadline on the Process call.
- **Tab state**: dialog close resets BOTH manual form AND bulk state machine. Tab switch does NOT reset bulk state.
- **JSON schema strategy**: use plain `type: 'string'` for all properties; **list every property in `required`** (matches OpenRouter strict mode + the existing in-repo precedent at `assign-leads-ai/index.ts:107`). System prompt instructs the model to emit empty string `""` for missing fields. Server-side post-parse: convert `""` → `undefined` per field. Do NOT use `type: ['string', 'null']` arrays (unverified for Anthropic-via-OpenRouter strict mode AND not needed if all-required + empty-string sentinel works).
- **No new validation libraries** (no react-hook-form, no zod). Manual `validate()` co-located in `ManualLeadForm.tsx`.
- **No shared `lead-validation.ts`** — each component co-locates its own tiny validator/types.
- **Toast lib**: existing `sonner`.
- **Migration application**: via Supabase Studio SQL editor in the browser, driven by chrome-devtools MCP. Supabase MCP is NOT used (not configured).
- **Migration `.sql` file in repo**: documentation-only — Studio is the source of truth for prod. Do not run via CLI; the project's deploy flow does not invoke `supabase db push`.
- **Edge function deploy precondition**: confirm `supabase --version` and `supabase login` BEFORE Task 5/6/7 deploys. If CLI unavailable, inline `_shared/*` helpers into the edge function file as a flat single-file deploy via Studio.
- **Ship sequence**: AI Enhance fix is its own commit + deploy, shipped FIRST. Add Lead feature ships second.
- **Client-side duplicate badges in review table**: DROPPED. Cache is paginated; badges would be unreliable. Server returns `skippedDuplicates` post-submit, surfaced in toast only.

## Known Mismatches / Assumptions

- Mismatch: Brief said "Sonnet 4.5"; user later said "Sonnet 46" in chat.
  Repo Evidence: N/A.
  Requirement Evidence: User chat: "Let's do Sonnet 46".
  Planning Decision: `anthropic/claude-sonnet-4.6` exact slug, VERIFIED via curl in Task 5 before deploy.

- Mismatch: Brief said reject >100 leads with error; reviewer #1 noted that's the worst-of-both behavior.
  Repo Evidence: N/A.
  Requirement Evidence: Reviewer recommendation; UX reasoning.
  Planning Decision: Silently truncate to 100 leads in edge function output, attach `truncated: true` flag, surface to UI as a warning chip rather than a hard error.

- Mismatch: Brief said modify `transforms.ts`; reviewers showed it's a pure key-renamer that doesn't need touching.
  Repo Evidence: `src/lib/transforms.ts:29-47`.
  Requirement Evidence: Brief decision (since revised).
  Planning Decision: Do NOT modify transforms.ts. DB accepts `''`; form submits `''`.

- Mismatch: Brief said modify `api-leads` for server-side dedup; reviewers showed `api-leads` is not in the dialog's write path.
  Repo Evidence: `src/lib/api/leads.ts:54-65` shows direct insert; the `api-leads` edge function is not invoked from `createLeads`.
  Requirement Evidence: Brief decision (since revised).
  Planning Decision: Do NOT modify `api-leads`. Implement dedup inside `src/lib/api/leads.ts createLeads`.

- Assumption: chrome-devtools MCP will be reconnected by the user before Task 13 (migration). It is currently disconnected per session start. Plan flags this as a precondition.

## Critical Codebase Anchors

- Anchor: `supabase/functions/assign-leads-ai/index.ts:81-138` — OpenRouter strict JSON schema call with plain `type: 'string'` properties AND every property listed in `required` (line 107).
  Evidence: `supabase/functions/assign-leads-ai/index.ts:81-138, line 107 in particular`
  Reuse / Watch for: Copy `response_format.json_schema.strict: true` shape EXACTLY — every property in `properties` MUST also be in `required`. Copy the 502 guard for `!data.choices?.length || !data.choices[0].message?.content`. Copy `JSON.parse(data.choices[0].message.content)`. Use plain `type: 'string'` everywhere. Use empty-string `""` as the "missing" sentinel; convert to `undefined` after parse.

- Anchor: `src/lib/api/leads.ts:54-65` — `createLeads` (the actual write path).
  Evidence: `src/lib/api/leads.ts:54-65`
  Reuse / Watch for: Modify in-place to (a) accept new `{ currentUserId, isAdmin }` parameter, (b) lowercase incoming emails, (c) in-batch dedup (drop same-email duplicates within the batch), (d) pre-SELECT existing lowercased emails for friendly UX, (e) explicit `assigned_to = currentUserId` for non-admins, (f) return `{ inserted: Lead[], skippedDuplicates: string[] }`, (g) catch Postgres `23505` from the new UNIQUE index and merge those into `skippedDuplicates`.

- Anchor: `src/hooks/use-leads.ts:32-38, 51-54` — `addLeadsMutation` + `updateLeadAsync` exposure pattern.
  Evidence: `src/hooks/use-leads.ts:32-38, 51-54`
  Reuse / Watch for: Add `addLeadsAsync: (newLeads) => addLeadsMutation.mutateAsync(newLeads)` paralleling `updateLeadAsync`. The mutation's return value automatically becomes the resolved promise value.

- Anchor: `src/components/todo/ProjectCreateDialog.tsx:1-221` — dialog + controlled form + reset-on-close.
  Evidence: `src/components/todo/ProjectCreateDialog.tsx:1-221`
  Reuse / Watch for: Copy `handleOpenChange(nextOpen)` → `if (!nextOpen) resetForm()` and the derived `canCreate` disabled state.

- Anchor: `src/pages/LeadsPage.tsx:193-287` — toolbar JSX.
  Evidence: `src/pages/LeadsPage.tsx:193-287`
  Reuse / Watch for: Insert `<AddLeadDialog />` as a NEW sibling AFTER the `selected.size > 0 && (...)` conditional block, before the closing `</div>` of the toolbar at line 287, with `ml-auto` className. Always visible.

- Anchor: `supabase/functions/_shared/auth.ts:16-66` — `resolveUser` for JWT-gated edge functions.
  Evidence: `supabase/functions/_shared/auth.ts:16-66`
  Reuse / Watch for: Edge function MUST call `resolveUser(req.headers.get('Authorization'), supabaseAdmin)` and reject 401 on failure.

- Anchor: `supabase/migrations/20260415000001_lead_assignment_rls.sql:19-22` — leads INSERT RLS policy (permissive).
  Evidence: `supabase/migrations/20260415000001_lead_assignment_rls.sql:19-22`
  Reuse / Watch for: Frontend MUST explicitly set `assigned_to`. RLS does not enforce self-assignment on INSERT.

## All Needed Context

### Documentation & References

- Repo reference: `supabase/functions/assign-leads-ai/index.ts:1-160` — OpenRouter strict-JSON template.
- Repo reference: `src/components/todo/ProjectCreateDialog.tsx:1-221` — dialog + controlled form template.
- Repo reference: `supabase/functions/_shared/cors.ts`, `_shared/auth.ts` — required imports for any edge function.
- Repo reference: `src/lib/api/leads.ts:54-65` — `createLeads` to be modified.
- Repo reference: `supabase/migrations/20260415000001_lead_assignment_rls.sql` — RLS evidence; new migration will follow same naming convention.
- External doc: https://openrouter.ai/api/v1/models — verify model slugs at implementation time. Live as of researcher confirmation 2026-05-06.
- External doc: https://openrouter.ai/docs/guides/features/structured-outputs — strict JSON schema syntax.
- External doc: https://supabase.com/dashboard — where the migration is applied via SQL Editor.

### Files Being Changed

```
connect-crm/
├── src/
│   ├── pages/
│   │   └── LeadsPage.tsx                                    ← MODIFIED (mount AddLeadDialog after bulk-action block, ml-auto)
│   ├── components/
│   │   └── leads/
│   │       └── add-lead/
│   │           ├── AddLeadDialog.tsx                        ← NEW (orchestrator: dialog shell + tabs + state)
│   │           ├── ManualLeadForm.tsx                       ← NEW (single-lead form + co-located validate())
│   │           ├── BulkLeadPaste.tsx                        ← NEW (textarea + Process + state machine)
│   │           ├── BulkLeadReviewTable.tsx                  ← NEW (editable table + per-row remove)
│   │           └── types.ts                                 ← NEW (ParsedLead + BulkInsertResponse types only)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── leads.ts                                     ← MODIFIED (createLeads: dedup + assignment + lowercase emails)
│   │   │   └── bulk-leads-parse.ts                          ← NEW (supabase.functions.invoke wrapper with AbortController)
│   │   └── transforms.ts                                    ← UNCHANGED
│   ├── hooks/
│   │   └── use-leads.ts                                     ← MODIFIED (expose addLeadsAsync)
│   └── types/
│       └── crm.ts                                           ← MODIFIED (relax 4 Lead fields to optional)
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   └── rate-limit.ts                                ← NEW (per-user, per-action sliding window)
│   │   ├── bulk-leads-parse/
│   │   │   └── index.ts                                     ← NEW (Sonnet 4.6 strict-JSON parse + rate limit)
│   │   ├── todo-ai-enhance/
│   │   │   └── index.ts                                     ← MODIFIED (model slug fix only)
│   │   └── api-leads/
│   │       └── index.ts                                     ← UNCHANGED
│   └── migrations/
│       └── 20260506000000_relax_lead_required_fields.sql    ← NEW (NOT NULL relaxation + CHECK + lowercase backfill + index + rate_limits table)
└── tmp/
    └── ready-plans/
        └── 2026-05-06-add-lead-manual-bulk.md               ← THIS PLAN (v2)
```

### Known Gotchas & Library Quirks

- **OpenRouter strict mode**: `additionalProperties: false` is required at every object level. Every property in `properties` must appear in `required`. Mark optional fields by OMITTING them from `required`, not by `type: ['string', 'null']` (the latter is unverified for Anthropic-via-OpenRouter strict mode).
- **Supabase Edge Function timeout**: ~60-150s wall clock. Sonnet 4.6 parsing 100 contacts can take 15-40s — within budget, but use `AbortController` with 90s deadline client-side to fail fast on stalls.
- **Realtime double-fetch**: `useLeads` listens to `postgres_changes` and invalidates on every event. Bulk insert of 100 rows fires 100 events → 100 invalidations. TanStack batches but it's wasteful. **Acceptable in v1; do not try to suppress.**
- **CHECK constraint with empty strings**: existing data uses `''` not NULL for many fields. Pre-migration verification query MUST confirm zero rows would violate the new CHECK before applying. If non-zero, abort and investigate.
- **Email case sensitivity**: existing `email` column has no citext / no functional index. Migration adds (a) one-time `UPDATE leads SET email = lower(email)` backfill and (b) functional index on `lower(email)`. After migration, `createLeads` dedup uses `.in('email', incomingLowercased)` against the now-lowercased column.
- **Apollo path interaction**: Apollo already dedupes before calling `addLeads`. Adding dedup inside `createLeads` is defense in depth — Apollo's pre-filter means the second pass usually returns zero duplicates. No regression.
- **`mergePhoneReveals` + manual leads**: short-circuits at `apolloIds.length === 0`, so manual leads (no `apolloId`) skip it entirely. No defensive coercion needed.
- **`addLeads` mutate vs mutateAsync**: existing `addLeads` returns `void`. We add `addLeadsAsync` that returns the response so the dialog can read `{ inserted, skippedDuplicates }`.
- **Type relaxation cascade**: making `lastName?` optional surfaces `undefined` at every `${firstName} ${lastName}` template literal. Task 3 includes a grep step to find and fix every consumer.
- **Edge function `_shared/` imports + Studio UI**: Studio's edge function UI cannot resolve relative imports. Either deploy via `supabase functions deploy bulk-leads-parse` (CLI), OR inline the helpers into a flat single-file version. Plan defaults to CLI; CLI absence triggers inline fallback.
- **Rate limit table growth**: `rate_limits` table accumulates rows. Migration adds an `idx_rate_limits_lookup` partial index for fast windowed counts AND a comment recommending a future cleanup cron (out of scope; v1 accepts unbounded growth — table is small per user).
- **Empty parse result**: if Sonnet returns `leads: []`, the dialog shows a toast and stays on the textarea — does NOT transition to the empty-table review state.
- **chrome-devtools MCP currently disconnected**: per session start system reminder. User must reconnect before Task 13 (migration) and Task 14 (E2E test).
- **Dev rate limit budget**: 10 calls / 60s / user. Token cost per call (Sonnet 4.6, ~16k input tokens worst case @ $3/M = $0.048/call). Worst-case bored attacker burns ~$0.48/min/user — bounded.

## Reconciliation Notes

- Added from v1 review: rate limiting (per finding #13), AbortController + timeout (per #10), correct insertion point in LeadsPage (per #11), addLeadsAsync exposure (per #2), explicit assignment client-side (per #4 + RLS read), email lowercase backfill + functional index (per #6 + #9), JSON schema strategy clarification (per #11), full default Lead object construction (per #5), empty-result and truncate behavior (per #18 + #19), drop client-side duplicate badges (per #16), drop transforms.ts mod and api-leads mod (per #1, #3, #8), ship-sequence note (per #22).
- Conflict resolved: brief said modify `api-leads` for dedup; v2 instead modifies `createLeads` (the actual write path).
- Conflict resolved: brief implied `transforms.ts` modification; v2 leaves it untouched (DB accepts `''`).
- Intentionally dropped: `lead-validation.ts` shared util (per simplification finding #20).

## Delta Design

### Data / State Changes

Existing:
- `public.leads` columns `last_name`, `job_title`, `company`, `company_size` are `NOT NULL`.
- No CHECK constraint on first_name + (email OR phone).
- Email column has no functional index; mixed-case emails likely.
- No rate limits table.

Change:
- DROP NOT NULL on those four columns.
- ADD CHECK constraint `leads_first_name_and_contact_required` (strict form: `IS NOT NULL AND <> ''`).
- Lowercase backfill: `UPDATE leads SET email = lower(email) WHERE email <> lower(email)`.
- ADD functional index `idx_leads_email_lower ON leads (lower(email))`.
- CREATE TABLE `rate_limits` (`id uuid pk`, `user_id uuid`, `action text`, `called_at timestamptz default now()`) + index `idx_rate_limits_lookup ON rate_limits (user_id, action, called_at DESC)`.
- Update `Lead` TS interface: `lastName?`, `jobTitle?`, `company?`, `companySize?` optional.

Why:
- Apollo always supplies the four fields; relaxation only enables manual entry.
- CHECK enforces the minimum invariant at DB layer.
- Lowercase backfill + index makes case-insensitive dedup correct AND fast.
- Rate limits table is the durable store for sliding-window enforcement (edge function memory doesn't survive cold starts).

Risks:
- If existing rows violate the new CHECK, migration fails. Mitigation: pre-verification query MUST return 0.
- Lowercase backfill may break code that expects original casing. Audit: `grep -rn "email\b" src/ | grep -v 'lower'` — likely only display, not comparison. Email in display can render lowercase without harm.
- Rate limits table grows unbounded over time. v1 accepts this; future cleanup cron is out of scope.

### Entry Point / Integration Flow

Existing:
- `createLeads` does `supabase.from('leads').insert(snaked).select()`. No dedup. No assignment logic.

Change:
- `createLeads` becomes:
  1. Get current user (`supabase.auth.getUser()`).
  2. Check role (read from `profiles` table or context).
  3. Lowercase incoming emails.
  4. Pre-SELECT `email FROM leads WHERE deleted_at IS NULL AND email = ANY($lowercased)`.
  5. Filter incoming to drop matches. Track `skippedDuplicates: string[]`.
  6. For non-admins, force `assigned_to = currentUser.id`. For admins, preserve incoming `assigned_to ?? null`.
  7. Insert. Return `{ inserted: Lead[], skippedDuplicates: string[] }`.

Why:
- Server-side (in TS, in browser, gated by RLS — "server-side" relative to the LLM/UI) dedup is the right place because `createLeads` is the only write path.
- Explicit assignment ensures the convention is enforced even though RLS doesn't.

Risks:
- `createLeads` now has a different return shape. Callers: `src/hooks/use-leads.ts addLeadsMutation` (the only known caller). Mutation's `mutationFn` must return the new shape; downstream `mutate`/`mutateAsync` callers see it. Apollo path uses `addLeads(.mutate)` and ignores return value — safe.
- Pre-SELECT adds one round-trip. For 100-lead batches, single query with `IN` clause — fast. Fine.
- Auth lookup adds another round-trip. Cache the role result OR pass user from caller. Acceptable: do `supabase.auth.getUser()` once per call.

### User-Facing / Operator-Facing Surface

Existing:
- Leads tab toolbar has filters + bulk status buttons. No add-lead UI.

Change:
- New `<AddLeadDialog />` mounted as a NEW sibling AFTER the `{selected.size > 0 && (...)}` block, with `ml-auto`.
- Dialog: `<Tabs defaultValue="manual">` with `manual` and `bulk`.
- Manual tab: `<ManualLeadForm onSubmit={handleManualSubmit} />` with co-located validate().
- Bulk tab: state machine `'idle' | 'parsing' | 'review'`. `BulkLeadPaste` (idle/parsing) → `BulkLeadReviewTable` (review).

Why:
- Single dialog with tabs matches user's brief verbatim and is standard UX.

Risks:
- Tab state must reset on dialog close. Use `handleOpenChange(false)` → reset everything.
- Bulk state must persist across tab switches (only reset on dialog close). Hold state in `AddLeadDialog`, not the inner components.
- `${firstName} ${lastName}` rendering will display "John undefined" if not fixed in Task 3.

### External / Operational Surface

Existing:
- 9 edge functions deployed. `OPENROUTER_API_KEY` set as Supabase secret.

Change:
- 1 new edge function: `bulk-leads-parse`.
- 1 modified edge function: `todo-ai-enhance` (model slug).
- 1 new shared util: `_shared/rate-limit.ts`.

Why:
- Standard pattern. No new secrets needed.

Risks:
- Edge function cold start ~200-500ms; first Process click of the day feels slightly slow.
- CLI deploy precondition: if `supabase` CLI is unavailable, must use Studio UI with inlined helpers (slower, error-prone).

## Implementation Blueprint

### Architecture Overview

**Add Lead (Manual)**:
```
LeadsPage toolbar → <AddLeadDialog>
  → Dialog (tab=manual)
  → ManualLeadForm captures state, validate() guards submit
  → onSubmit → useLeads().addLeadsAsync([oneLead])
  → addLeadsAsync → mutationFn → api.mergePhoneReveals (no-op, no apolloId) → api.createLeads
  → createLeads → auth.getUser → profiles.role → lowercase emails → dedup pre-SELECT → assigned_to fix → insert
  → Returns { inserted, skippedDuplicates }
  → invalidateQueries(['leads']) → toast → close dialog
```

**Add Lead (Bulk)**:
```
Dialog tab=bulk → BulkLeadPaste textarea + Process button
  → client validates byteLength <= 50KB
  → AbortController(90s) → POST /functions/v1/bulk-leads-parse { text }
  → edge fn → resolveUser (JWT) → rate-limit check → length guard → OpenRouter Sonnet 4.6 strict JSON
  → Returns { leads: ParsedLead[], truncated: boolean }
  → If leads.length === 0: toast "No leads detected", stay on textarea
  → Else: BulkLeadReviewTable renders editable rows (+ "+truncated to 100" chip if applicable)
  → User edits inline, may remove rows
  → Submit click → map ParsedLead → Omit<Lead,...> with full defaults → useLeads().addLeadsAsync(filteredRows)
  → Returns { inserted, skippedDuplicates }
  → toast "Added N leads. M skipped: x@y.com, ..." → close dialog
```

**AI Enhance fix** (separate first commit):
```
TodoDetailSheet/TodoCreateForm "AI Enhance" click
  → existing supabase.functions.invoke('todo-ai-enhance', { body: { text } })
  → edge fn (model: 'inception/mercury-2')
  → returns { enhanced } → existing UI swaps text
```

### Key Pseudocode

**`src/lib/api/leads.ts createLeads` (rewrite)**:

```typescript
export interface CreateLeadsContext {
  currentUserId: string
  isAdmin: boolean
}

export async function createLeads(
  leads: Omit<Lead, 'id' | 'createdAt'>[],
  ctx: CreateLeadsContext,
): Promise<{ inserted: Lead[]; skippedDuplicates: string[] }> {
  if (leads.length === 0) return { inserted: [], skippedDuplicates: [] }

  // 1. Lowercase incoming emails
  const normalized = leads.map(l => ({
    ...l,
    email: typeof l.email === 'string' ? l.email.trim().toLowerCase() : l.email,
  }))

  // 2. In-batch dedup (same email pasted twice) — keep first occurrence
  const seen = new Set<string>()
  const skippedDuplicates: string[] = []
  const inBatchDeduped = normalized.filter(l => {
    if (!l.email) return true
    if (seen.has(l.email)) {
      skippedDuplicates.push(l.email)
      return false
    }
    seen.add(l.email)
    return true
  })

  // 3. Friendly pre-SELECT against existing rows (RLS-bound; the UNIQUE index is the real enforcer)
  const incomingEmails = inBatchDeduped.map(l => l.email).filter((e): e is string => !!e)
  let existingSet = new Set<string>()
  if (incomingEmails.length > 0) {
    const { data: dupRows } = await supabase
      .from('leads')
      .select('email')
      .is('deleted_at', null)
      .in('email', incomingEmails)
    existingSet = new Set((dupRows ?? []).map(r => (r.email ?? '').toLowerCase()))
  }

  const toInsert = inBatchDeduped.filter(l => {
    if (l.email && existingSet.has(l.email)) {
      skippedDuplicates.push(l.email)
      return false
    }
    return true
  })

  // 4. Force assigned_to for non-admins; treat empty-string assignedTo as null for admins
  const finalRows = toInsert.map(l => ({
    ...l,
    assignedTo: ctx.isAdmin ? (l.assignedTo || null) : ctx.currentUserId,
  }))

  if (finalRows.length === 0) {
    return { inserted: [], skippedDuplicates }
  }

  // 5. Insert. On 23505 (UNIQUE violation from RLS-blind / racing duplicate), parse the offending
  //    email from error.details, push to skippedDuplicates, retry without that row. Loop because
  //    Postgres aborts on the FIRST conflict — multi-conflict batches need multiple passes.
  let rowsToInsert = finalRows
  let inserted: Lead[] = []
  for (let attempt = 0; attempt < 5; attempt++) {
    if (rowsToInsert.length === 0) break
    const snaked = rowsToInsert.map(l => toSnakeCase(l as unknown as Record<string, unknown>))
    const { data, error } = await supabase.from('leads').insert(snaked).select()
    if (!error) {
      inserted = transformRows<Lead>(data || [])
      break
    }
    if (error.code !== '23505' || !/idx_leads_email_unique/.test(error.message ?? '')) throw error
    // Parse offending email from "Key (lower(email))=(foo@bar.com) already exists."
    const match = (error.details ?? '').match(/\(lower\(email\)\)=\(([^)]+)\)/)
    if (!match) {
      // Couldn't parse — surface a useful error rather than infinite-loop
      throw new Error(`Insert failed with unique-violation but offending email could not be parsed: ${error.message}`)
    }
    const offending = match[1].toLowerCase()
    skippedDuplicates.push(offending)
    rowsToInsert = rowsToInsert.filter(l => l.email !== offending)
  }
  if (rowsToInsert.length > 0 && inserted.length === 0) {
    // Hit the retry cap without making progress — pathological concurrent-write scenario
    throw new Error('Too many duplicate-conflict retries; please try again')
  }

  return { inserted, skippedDuplicates }
}
```

**Note**: `createLead` (singular) at `src/lib/api/leads.ts:31-41` is left untouched. Audit during Task 4: `grep -rn "\\bcreateLead\\b" src/` — if any caller exists, route through `createLeads([lead], ctx)` and remove `createLead`.

**`use-leads.ts` change** — read `useAuth` once, pass context into `createLeads`, expose `addLeadsAsync`:

```typescript
import { useAuth } from '@/contexts/AuthContext'

export function useLeads() {
  const queryClient = useQueryClient()
  const { user, isAdmin } = useAuth()

  // ...existing query + realtime + updateLeadMutation unchanged

  const addLeadsMutation = useMutation({
    mutationFn: async (newLeads: Omit<Lead, 'id' | 'createdAt'>[]) => {
      if (!user) throw new Error('Not authenticated')
      await api.mergePhoneReveals(newLeads)  // no cast — structurally compatible
      return api.createLeads(newLeads, { currentUserId: user.id, isAdmin })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })

  return {
    // ...existing returns
    addLeads: (newLeads: Omit<Lead, 'id' | 'createdAt'>[]) => addLeadsMutation.mutate(newLeads),
    addLeadsAsync: (newLeads: Omit<Lead, 'id' | 'createdAt'>[]) => addLeadsMutation.mutateAsync(newLeads),
    // ...
  }
}
```

**Apollo path (`LeadGeneratorPage.tsx`) is unchanged** — it already calls `useLeads().addLeads(...)`, which now passes auth context internally. No caller changes required.

**`_shared/rate-limit.ts`**:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds?: number
  reason?: string
}

export async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  windowSeconds: number,
  maxCalls: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // Count calls in window
  const { count, error: countErr } = await supabaseAdmin
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('called_at', since)

  if (countErr) {
    // Fail CLOSED — this endpoint bounds LLM cost. Failing open during a token leak defeats the purpose.
    console.error('Rate limit check failed (failing closed):', countErr)
    return { ok: false, retryAfterSeconds: 60, reason: 'Rate limit infrastructure unavailable — try again shortly' }
  }

  if ((count ?? 0) >= maxCalls) {
    // Find earliest call in window to compute retry-after — use maybeSingle to avoid PGRST116 if a concurrent cleanup races
    const { data: oldest } = await supabaseAdmin
      .from('rate_limits')
      .select('called_at')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('called_at', since)
      .order('called_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const oldestMs = oldest?.called_at ? new Date(oldest.called_at).getTime() : Date.now()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + windowSeconds * 1000 - Date.now()) / 1000))
    return { ok: false, retryAfterSeconds, reason: `Rate limited — try again in ${retryAfterSeconds}s` }
  }

  // Record this call. Awaited so we know whether it landed; if it errors we fail closed too.
  const { error: insertErr } = await supabaseAdmin.from('rate_limits').insert({ user_id: userId, action })
  if (insertErr) {
    console.error('Rate limit insert failed (failing closed):', insertErr)
    return { ok: false, retryAfterSeconds: 60, reason: 'Rate limit infrastructure unavailable — try again shortly' }
  }
  // Note: count + insert is not atomic. Under N concurrent edge invocations all N can pass the
  // count check before any insert lands. Worst-case burst ~ 10 + N calls per 60s window. At Sonnet
  // 4.6 ~$0.05/call this caps practical damage well under $1/min/user. Acceptable for v1; future
  // fix is a Postgres function with row-level locking.

  return { ok: true }
}
```

**`bulk-leads-parse/index.ts`**:

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { resolveUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const MAX_INPUT_BYTES = 50_000
const MAX_OUTPUT_LEADS = 100
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // 1. Auth
  let user
  try { user = await resolveUser(req.headers.get('Authorization'), supabaseAdmin) }
  catch (e) { return json({ error: (e as Error).message }, 401) }

  // 2. Rate limit
  const rl = await checkRateLimit(supabaseAdmin, user.id, 'bulk-leads-parse', RATE_LIMIT_WINDOW_S, RATE_LIMIT_MAX)
  if (!rl.ok) return json({ error: rl.reason, retryAfterSeconds: rl.retryAfterSeconds }, 429)

  // 3. Validate input
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
  if (!OPENROUTER_API_KEY) return json({ error: 'OpenRouter API key not configured' }, 500)

  const { text } = await req.json()
  if (!text || typeof text !== 'string' || !text.trim()) return json({ error: 'Text is required' }, 400)
  if (new TextEncoder().encode(text).byteLength > MAX_INPUT_BYTES) {
    return json({ error: 'Input too large — paste at most ~100 leads worth of data' }, 413)
  }

  // 4. Call OpenRouter — strict JSON schema, plain `type: 'string'` (nullables omitted from required)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'IntegrateAPI CRM',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_leads',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['leads'],
            properties: {
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  // ALL properties listed in `required` — OpenRouter strict mode contract.
                  // Model emits empty string "" for missing fields (per system prompt); server strips post-parse.
                  required: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'industry', 'location', 'linkedinUrl', 'notes'],
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    jobTitle: { type: 'string' },
                    company: { type: 'string' },
                    industry: { type: 'string' },
                    location: { type: 'string' },
                    linkedinUrl: { type: 'string' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('OpenRouter error:', response.status, errorBody)
    return json({ error: `LLM request failed (${response.status})` }, 502)
  }

  const data = await response.json()
  if (!data.choices?.length || !data.choices[0].message?.content) return json({ error: 'No response from LLM' }, 502)

  let parsed
  try { parsed = JSON.parse(data.choices[0].message.content) }
  catch { return json({ error: 'LLM returned invalid JSON' }, 502)}

  if (!Array.isArray(parsed.leads)) return json({ error: 'LLM returned wrong shape' }, 502)

  // Strip empty-string sentinels → undefined per field; require non-empty firstName AND (email OR phone).
  // Filtering email-AND-phone-empty here matches the DB CHECK constraint, so we never present a row
  // to the user that would fail at insert.
  const STRING_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'industry', 'location', 'linkedinUrl', 'notes'] as const
  const cleaned = parsed.leads
    .filter((l: unknown): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l: Record<string, unknown>) => {
      const out: Record<string, string | undefined> = {}
      for (const k of STRING_FIELDS) {
        const v = l[k]
        out[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
      }
      return out
    })
    .filter((l) =>
      typeof l.firstName === 'string' && l.firstName.length > 0 &&
      ((typeof l.email === 'string' && l.email.length > 0) || (typeof l.phone === 'string' && l.phone.length > 0))
    )

  // Silent truncate to MAX_OUTPUT_LEADS
  const truncated = cleaned.length > MAX_OUTPUT_LEADS
  const final = truncated ? cleaned.slice(0, MAX_OUTPUT_LEADS) : cleaned

  return json({ leads: final, truncated })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SYSTEM_PROMPT = `You extract sales leads from messy unstructured text. Input may contain names, emails, phone numbers, job titles, company names, LinkedIn URLs, and other notes — possibly from copied LinkedIn profiles, email signatures, Slack threads, conference rosters, or notepads.

Rules:
- Output strictly the JSON shape requested. No prose, no markdown.
- One object per distinct person.
- EVERY field listed in the schema MUST be present in your output. For fields where you have no data, use the empty string "" (not null, not omitted).
- firstName is REQUIRED to be a NON-EMPTY string. If you cannot identify a first name for a candidate person, DO NOT include that lead at all.
- firstName/lastName: split full names sensibly. If only one name token, put it in firstName and use "" for lastName.
- email: lowercase. If you see multiple emails for one person, pick the work email; otherwise the first.
- phone: keep digits + +/() only; preserve country code if present.
- linkedinUrl: full URL including https://.
- notes: capture anything contextual that doesn't fit other fields, otherwise "".
- Skip non-person entries (company-only mentions, generic info@ addresses unless paired with a person).
- Maximum 100 leads. If input has more, return the first 100 in source order.`
```

**Manual form `validate()` (co-located in ManualLeadForm.tsx)**:

```typescript
function validateManualLead(form: ManualFormState): { ok: boolean; reason?: string } {
  if (!form.firstName.trim()) return { ok: false, reason: 'First name is required' }
  if (!form.email.trim() && !form.phone.trim()) return { ok: false, reason: 'Email or phone is required' }
  return { ok: true }
}
```

**Form-submit handler — full Lead default object**:

```typescript
async function handleManualSubmit(form: ManualFormState) {
  const lead: Omit<Lead, 'id' | 'createdAt'> = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim() || undefined,
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    jobTitle: form.jobTitle.trim() || undefined,
    company: form.company.trim() || undefined,
    companySize: form.companySize.trim() || undefined,
    industry: form.industry.trim(),
    location: form.location.trim(),
    status: form.status || 'cold',
    notes: form.notes.trim(),
    tags: [],
    assignedTo: null,         // createLeads will overwrite to currentUserId for non-admins; admin keeps null
    lastContactedAt: null,
    linkedinUrl: form.linkedinUrl.trim() || undefined,
  }

  const { inserted, skippedDuplicates } = await addLeadsAsync([lead])
  if (skippedDuplicates.length > 0) {
    toast.info('Lead already exists', { description: skippedDuplicates[0] })
  } else {
    toast.success('Lead added')
  }
  setOpen(false)
}
```

**Migration SQL** (run in Supabase Studio):

```sql
-- ============================================
-- VERIFICATION (run first; abort if unexpected)
-- ============================================

-- 1. Confirm `apollo_id`, `email`, `phone`, `deleted_at` columns exist (other queries depend on these)
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name IN ('apollo_id', 'email', 'phone', 'deleted_at');
-- Expected: all 4 rows present. If `apollo_id` missing, drop query #3 below.

-- 2. Rows that would violate the new CHECK
SELECT COUNT(*) AS would_violate
FROM public.leads
WHERE first_name IS NULL
   OR first_name = ''
   OR ((email IS NULL OR email = '') AND (phone IS NULL OR phone = ''));
-- Expected: 0. If > 0, STOP and review offenders before proceeding.

-- 3. Apollo-imported rows that would violate (regression risk for re-imports). SKIP if apollo_id absent (per query #1).
SELECT COUNT(*) AS apollo_would_violate
FROM public.leads
WHERE apollo_id IS NOT NULL
  AND (first_name IS NULL
       OR first_name = ''
       OR ((email IS NULL OR email = '') AND (phone IS NULL OR phone = '')));
-- Expected: 0. If > 0, Apollo path may break on future updates of those rows.

-- 4. Current nullability of target columns
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name IN ('last_name', 'job_title', 'company', 'company_size');
-- Expected: all four = 'NO' currently.

-- 5. Confirm no conflicting CHECK constraint exists
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.leads'::regclass AND contype = 'c';
-- Expected: 'leads_first_name_and_contact_required' NOT in list.

-- 6. Email casing distribution (for backfill scope)
SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE email <> lower(email)) AS would_change
FROM public.leads WHERE email IS NOT NULL;
-- Note the would_change count — this is what the backfill will UPDATE.

-- 7. Confirm there are no existing case-insensitive duplicates that would block the UNIQUE index
SELECT lower(email) AS lemail, COUNT(*) AS cnt
FROM public.leads
WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> ''
GROUP BY lower(email)
HAVING COUNT(*) > 1;
-- Expected: 0 rows. If non-zero, MUST resolve duplicates before Script 2 can run.

-- 8. Approximate table size (informational; the new migration uses CREATE INDEX CONCURRENTLY regardless)
SELECT count(*) AS row_count FROM public.leads;

-- ============================================
-- MIGRATION (run after verification passes)
-- ============================================

-- ============================================
-- IMPORTANT: This migration is split into TWO scripts to avoid blocking writes on the live leads table.
-- Script 1 = transactional DDL (fast, brief lock).
-- Script 2 = standalone `CREATE UNIQUE INDEX CONCURRENTLY` (cannot be inside a transaction).
-- Run Script 1 first; wait for COMMIT; then run Script 2 in a fresh SQL editor query.
-- ============================================

-- ============================================
-- SCRIPT 1 — transactional DDL (run inside Supabase Studio SQL editor)
-- ============================================

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

-- C. CHECK constraint (strict form). Use ADD CONSTRAINT NOT VALID + VALIDATE later if the table
--    is large; for small tables (the typical case here) the inline form is fine.
ALTER TABLE public.leads
  ADD CONSTRAINT leads_first_name_and_contact_required
  CHECK (
    first_name IS NOT NULL AND first_name <> '' AND
    ((email IS NOT NULL AND email <> '') OR (phone IS NOT NULL AND phone <> ''))
  );

-- D. Rate limits table
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

-- ============================================
-- SCRIPT 2 — UNIQUE partial index, NON-BLOCKING (run in a fresh SQL editor query, NOT inside a transaction)
-- ============================================

-- DB-enforced dedup. Catches RLS-blind cases, in-batch dupes, and concurrent-call races.
-- Predicate excludes soft-deleted rows AND rows with NULL/empty email (phone-only leads can repeat).
-- CONCURRENTLY = does NOT block reads or writes during the build. Required for production.
-- DO NOT WRAP THIS IN BEGIN/COMMIT — it will error.
CREATE UNIQUE INDEX CONCURRENTLY idx_leads_email_unique
  ON public.leads (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> '';

-- ============================================
-- POST-VERIFICATION
-- ============================================

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name IN ('last_name', 'job_title', 'company', 'company_size');
-- Expected: all four = 'YES'.

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.leads'::regclass AND conname = 'leads_first_name_and_contact_required';
-- Expected: one row.

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'leads' AND indexname = 'idx_leads_email_unique';
-- Expected: one row; indexdef should include `UNIQUE`, `lower(email)`, and the partial `WHERE` predicate.

SELECT to_regclass('public.rate_limits');
-- Expected: 'rate_limits' (not NULL).
```

### Data Models and Structure

**Updated `src/types/crm.ts`** (only the diff):

```typescript
export interface Lead {
  id: string;
  firstName: string;             // unchanged: required, validated by CHECK
  lastName?: string;             // was: lastName: string
  email: string;                 // remains string in TS; CHECK enforces non-empty when phone empty
  phone: string;                 // remains string in TS
  jobTitle?: string;             // was: jobTitle: string
  company?: string;              // was: company: string
  companySize?: string;          // was: companySize: string
  industry: string;
  location: string;
  status: LeadStatus;
  assignedTo: string | null;     // was: string. Required to express admin's "no assignment" intent.
  createdAt: string;
  lastContactedAt: string | null;
  notes: string;
  tags: string[];
  linkedinUrl?: string;
  emailStatus?: string;
  timezone?: string;
  apolloId?: string;
  callCount?: number;
  emailCount?: number;
}
```

**`src/components/leads/add-lead/types.ts`**:

```typescript
export interface ParsedLead {
  firstName: string;          // strict mode guarantees this
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface BulkParseResponse {
  leads: ParsedLead[];
  truncated: boolean;
}

export interface BulkInsertResponse {
  inserted: import('@/types/crm').Lead[];
  skippedDuplicates: string[];
}
```

### Tasks (in implementation order)

**Task 1 — Verify Mercury 2 + Sonnet 4.6 slugs are live on OpenRouter**
Goal:
- Don't repeat the AI Enhance bug.
Files:
- N/A (curl).
Pattern to copy:
- N/A.
Gotchas:
- Run BOTH curls; both must return non-empty.
Definition of done:
- `curl -s https://openrouter.ai/api/v1/models | jq '.data[] | select(.id == "inception/mercury-2") | .id'` returns `"inception/mercury-2"`.
- `curl -s https://openrouter.ai/api/v1/models | jq '.data[] | select(.id == "anthropic/claude-sonnet-4.6") | .id'` returns `"anthropic/claude-sonnet-4.6"`.
- If either returns empty, STOP and consult OpenRouter catalog for the actual current slug. Do NOT proceed with a guessed slug.

**Task 2 — Fix `todo-ai-enhance` model slug (independent first deploy)** [x] code change done 2026-05-06 (deploy still pending — manual)
Goal:
- Restore AI Enhance button. Ship as own commit, deploy immediately, do not gate behind larger feature.
Files:
- MODIFY `supabase/functions/todo-ai-enhance/index.ts:34` — `'inception/mercury-coder-small-beta'` → `'inception/mercury-2'`.
Pattern to copy:
- N/A.
Gotchas:
- Single line change. Commit + deploy independently before starting Task 3.
Definition of done:
- Diff shows exactly one line changed.
- Edge function redeployed (CLI: `supabase functions deploy todo-ai-enhance`; OR Studio Edge Functions UI driven by chrome-devtools MCP).
- Manual smoke test on live site: open To-Do, click AI Enhance, see refined text.

**Task 3 — Update `Lead` type for relaxed fields + audit consumers**
Goal:
- Type signals match upcoming DB shape; surface every site that interpolates the relaxed fields so undefined doesn't render as the literal string `"undefined"`.
Files:
- MODIFY `src/types/crm.ts:14-37` — mark `lastName`, `jobTitle`, `company`, `companySize` as optional; change `assignedTo: string` to `assignedTo: string | null`.
- MODIFY all consumers found by:
  - `grep -rn '\.lastName\b\|\.jobTitle\b\|\.companySize\b' src/`
  - `grep -rn '\.company\b' src/` (review hits — `.company` is a substring of `.companyName`/`.companyId`; only fix `Lead.company`)
  - `grep -rn 'lead\.assignedTo\|leads\.\?\w*assignedTo' src/` — scope to LEAD consumers only. **Deal also has `assignedTo: string` (`src/types/crm.ts:78`); do NOT change Deal logic.**
  - `grep -rn 'assignedTo\s*:' src/` — also catch object-literal keys (e.g., `{ ...rest, assignedTo: user!.id }` in `CampaignBuilderPage.tsx:511`).
- AUDIT both known callers of `useLeads().addLeads`:
  - `src/pages/LeadGeneratorPage.tsx:151-168` (Apollo)
  - `src/pages/CampaignBuilderPage.tsx:512` (campaign import)
  Confirm both still typecheck and behaviorally pass under the new context-passing flow.
Pattern to copy:
- For display: `${lead.firstName} ${lead.lastName ?? ''}`.trim() — preserves "John" without trailing space.
- For comparison/filter: guard with `lead.lastName?.toLowerCase().includes(...)`.
- For CSV/export: write empty string for undefined / null fields.
- For `assignedTo` consumers: add explicit `lead.assignedTo === null` branches where it matters (e.g., displaying "Unassigned" in an avatar slot).
Gotchas:
- Don't naively `?? ''` everywhere — `${a} ${b}` with `b = ''` produces "a " (trailing space). Use `.trim()`.
- Likely touches 5-20 files. List them in the implementation report.
- `assignedTo` is consumed by filter logic, RLS-bound queries, lead-detail panels, and call/email logging — be thorough.
Definition of done:
- `npm run typecheck` passes.
- Both greps return zero unguarded usages.

**Task 4 — Modify `createLeads` (new signature + dedup + assignment + lowercase + 23505 handling)**
Goal:
- Single write path enforces dedup (in-batch + RLS-friendly pre-check + DB-enforced UNIQUE) and assignment.
Files:
- MODIFY `src/lib/api/leads.ts:54-65` — replace with the rewritten createLeads from Key Pseudocode.
- AUDIT `src/lib/api/leads.ts:31-41` (`createLead` singular) via `grep -rn '\bcreateLead\b' src/`. If callers exist, route through `createLeads([lead], ctx)` and remove `createLead`. If no callers, just delete `createLead`.
Pattern to copy:
- The pseudocode in this plan.
Gotchas:
- New signature: `createLeads(leads, { currentUserId, isAdmin })`. ALL callers must pass context.
- Return shape changes from `Lead[]` to `{ inserted: Lead[], skippedDuplicates: string[] }`. Single caller (`useLeads.addLeadsMutation`) updated in Task 5.
- 23505 catch is for the rare RLS-blind / racing dupe case — surfaces as a thrown error with offending emails. The friendly path (in-batch dedup + RLS-bound pre-SELECT) catches the common cases silently into `skippedDuplicates`.
- ONE round-trip added (the dedup pre-SELECT). The previous v2 design had 3 (auth.getUser + profiles + pre-SELECT); v3 has 1 because auth context comes from caller.
Definition of done:
- `npm run typecheck` passes.
- `grep -rn '\bcreateLead\b' src/` returns no remaining references to the singular function (or `createLead` is documented as intentionally retained).
- Apollo flow still works (verify by importing one Apollo result post-deploy).

**Task 5 — Wire `useAuth` into `useLeads`, expose `addLeadsAsync`**
Goal:
- Hook closes over `{ currentUserId, isAdmin }` once and passes to `createLeads`. Dialog can read `{ inserted, skippedDuplicates }`.
Files:
- MODIFY `src/hooks/use-leads.ts:1-58` — add `import { useAuth } from '@/contexts/AuthContext'`, call `useAuth()` near the top, pass context into `createLeads` via the mutationFn closure, expose `addLeadsAsync`. Remove the unnecessary `as Array<...>` cast on `mergePhoneReveals` (existing call has no cast and structural typing handles it).
Pattern to copy:
- Existing `updateLeadAsync` at line 51-52 for the async exposure.
- `useAuth` hook usage: any component file currently importing it (e.g., `src/pages/LeadsPage.tsx:34`).
Gotchas:
- `user` from `useAuth` may be `null` during initial render; `mutationFn` throws if user is null at call-time. Acceptable — UI can't open the dialog without auth.
- Mutation return type now infers `{ inserted, skippedDuplicates }`. Verify TanStack Query types propagate.
Definition of done:
- `npm run typecheck` passes.
- Apollo path (`LeadGeneratorPage.tsx`) still compiles and works — it calls `addLeads(...)` without changes; auth context is internal to the hook.

**Task 6 — Create `_shared/rate-limit.ts`** [x] DONE
Goal:
- Reusable sliding-window rate limiter that fails CLOSED on infra error.
Files:
- CREATE `supabase/functions/_shared/rate-limit.ts`
Pattern to copy:
- The pseudocode in this plan.
- For the Supabase admin client pattern, copy from `supabase/functions/api-leads/index.ts:5-8`.
Gotchas:
- **Fail CLOSED** on infra error. Returning a 429 with "infrastructure unavailable" beats burning unbounded LLM tokens during an outage or token leak.
- Use `.maybeSingle()` (not `.single()`) for the oldest-call lookup — avoids PGRST116 if a concurrent cleanup races.
- Minor count+insert race allows ~2x burst; the UNIQUE-on-email index caps damage from any duplicate inserts that result. Acceptable v1.
- Don't import `createClient` if not used — pseudocode comment about unused import.
Definition of done:
- File compiles in Deno.
- Manually tested via direct invocation (e.g., insert N rows for one user, confirm 11th call returns 429 with retry-after).
- Force a table-unavailable scenario (e.g., revoke service role briefly) and confirm the function returns 429, not 200.

**Task 7 — Create `bulk-leads-parse` edge function** [x]
Goal:
- New endpoint: messy text → structured leads via Sonnet 4.6.
Files:
- CREATE `supabase/functions/bulk-leads-parse/index.ts`
Pattern to copy:
- `supabase/functions/assign-leads-ai/index.ts:81-138` (OpenRouter strict JSON pattern; ALL properties listed in `required`).
- `_shared/auth.ts` (`resolveUser`).
- `_shared/cors.ts`.
- `_shared/rate-limit.ts` (just created).
Gotchas:
- `additionalProperties: false` at every object level.
- **Every property in `properties` MUST also appear in `required`** (OpenRouter strict mode contract). Missing fields are conveyed via empty-string sentinels per system prompt; server strips empties → undefined post-parse.
- Set `temperature: 0.2`.
- Reject inputs > 50KB (413).
- Silent truncate to 100 leads + return `truncated: true`.
- After `JSON.parse`, run the empty-string strip pass and re-filter for non-empty `firstName` (defense in depth — even if model violates the prompt, no leads with blank firstName escape).
- Rate limit check BEFORE OpenRouter call, AFTER auth.
Definition of done:
- Function deployed.
- `curl -X POST $URL/functions/v1/bulk-leads-parse -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"text":"John Doe john@example.com 555-1234"}'` returns `{"leads":[{"firstName":"John","lastName":"Doe","email":"john@example.com","phone":"555-1234"}],"truncated":false}` (empty fields like `jobTitle` are absent from the object after the strip pass).
- Repeat call 11x in 60s — 11th returns 429 with retry-after.

**Task 8 — Create `src/lib/api/bulk-leads-parse.ts` API helper** [x]
Goal:
- Thin wrapper with AbortController + 90s timeout.
Files:
- CREATE `src/lib/api/bulk-leads-parse.ts`.
Pattern to copy:
- Existing `supabase.functions.invoke` calls in `src/lib/api/*` (find via grep).
Gotchas:
- Use `AbortController` with 90_000ms deadline. On abort, throw a typed error the dialog can catch and display as "Took too long — try a smaller batch".
- Surface server error messages cleanly (server returns `{ error: string }`).
Definition of done:
- Exports `parseLeadsFromText(text: string, signal?: AbortSignal): Promise<BulkParseResponse>`.
- Throws on non-2xx with the server's error message.

**Task 9 — Create `ManualLeadForm` component**
Goal:
- Single-lead form with co-located validate().
Files:
- CREATE `src/components/leads/add-lead/ManualLeadForm.tsx`.
Pattern to copy:
- `src/components/todo/ProjectCreateDialog.tsx` (controlled state + canCreate + reset).
Gotchas:
- Submit button disabled until validate() returns ok.
- Status select defaults to `cold`.
- Build full `Omit<Lead, 'id' | 'createdAt'>` per the Key Pseudocode form-submit handler.
- `linkedinUrl` and other optional fields: send `undefined` when blank, not `''`.
Definition of done:
- Component renders all fields, submit triggers `props.onSubmit(lead)` only when valid.

**Task 10 — Create `BulkLeadPaste` component**
Goal:
- Textarea + Process button + state machine boundary.
Files:
- CREATE `src/components/leads/add-lead/BulkLeadPaste.tsx`.
Pattern to copy:
- shadcn `Textarea` + `Button`.
Gotchas:
- Client-side check `new TextEncoder().encode(text).byteLength > 50_000` BEFORE invoking edge function.
- AbortController for 90s timeout.
- Preserve textarea contents on parse error (state lives in parent so this is automatic).
- "This may take up to a minute" sub-text during parsing state.
- Disabled Process button while parsing.
Definition of done:
- Sends valid request; surfaces error toasts; on success calls `props.onParsed(result)`.

**Task 11 — Create `BulkLeadReviewTable` component**
Goal:
- Editable table for parsed leads.
Files:
- CREATE `src/components/leads/add-lead/BulkLeadReviewTable.tsx`.
Pattern to copy:
- shadcn `Table` for layout.
- Inline `Input` per cell, controlled via parent state.
Gotchas:
- Per-row remove (×) button.
- "+truncated to 100" warning chip if `props.truncated` is true.
- Header: "Does this look good?" + count "N leads ready".
- Submit button: `Add ${eligibleCount} leads`. **Always enabled when at least one row is eligible** — incomplete rows (missing firstName OR (missing email AND missing phone)) are visually marked with a subtle warning row tint and SKIPPED on submit (with their count surfaced in the toast: "Added 5 leads. Skipped 2 incomplete rows."). Do NOT block submit on incomplete rows.
- Map eligible `ParsedLead` → `Omit<Lead, 'id' | 'createdAt'>` with explicit coercion since `ParsedLead.email` is `string | undefined` but `Lead.email` is `string`:

```typescript
const leads: Omit<Lead, 'id' | 'createdAt'>[] = eligibleRows.map(row => ({
  firstName: row.firstName!,                // eligibility filter guarantees non-empty
  lastName: row.lastName,                   // optional
  email: row.email ?? '',                   // coerce undefined → ''; CHECK passes via phone branch
  phone: row.phone ?? '',
  jobTitle: row.jobTitle,
  company: row.company,
  companySize: undefined,                   // not parsed by LLM
  industry: row.industry ?? '',
  location: row.location ?? '',
  linkedinUrl: row.linkedinUrl,
  status: 'cold',
  notes: row.notes ?? '',
  tags: [],
  assignedTo: null,                         // createLeads overwrites for non-admins
  lastContactedAt: null,
}))
```
Definition of done:
- Renders rows; edits propagate to parent state; submit fires `props.onSubmit(rows)`.

**Task 12 — Create `AddLeadDialog` orchestrator**
Goal:
- Dialog shell + tabs + state.
Files:
- CREATE `src/components/leads/add-lead/AddLeadDialog.tsx`.
- CREATE `src/components/leads/add-lead/types.ts`.
Pattern to copy:
- `src/components/todo/ProjectCreateDialog.tsx` for dialog open/reset.
- shadcn `Tabs` for two-tab layout (Manual default).
Gotchas:
- `handleOpenChange(false)` resets BOTH manual form AND bulk state machine.
- Tab switch does NOT reset bulk state.
- Mounts its own trigger: `<DialogTrigger asChild><Button disabled={!user}><Plus className="h-4 w-4 mr-2" /> Add Lead</Button></DialogTrigger>` — disabled when auth is loading/null.
- Import `Plus` from `lucide-react`. Read `user` from `useAuth()` for the disabled state.
- Toast "Added N leads. M skipped: ..." truncates skipped emails to first 5.
- Empty parse result: show toast, stay on textarea (don't transition to review).
Definition of done:
- Self-contained drop-in for `LeadsPage.tsx`.

**Task 13 — Mount `<AddLeadDialog />` in `LeadsPage.tsx`**
Goal:
- Make the button visible.
Files:
- MODIFY `src/pages/LeadsPage.tsx:287` (closing `</div>` of toolbar) — insert `<div className="ml-auto"><AddLeadDialog /></div>` as a NEW SIBLING immediately before the closing `</div>`, AFTER the `{selected.size > 0 && (...)}` block at lines 280-286.
Pattern to copy:
- N/A (specific insertion).
Gotchas:
- Verify `Button` and `Plus` imports if not already present.
- Don't put it INSIDE the conditional — must always render.
Definition of done:
- Page renders; button visible right-aligned in toolbar regardless of selection state.

**Task 14 — Create migration SQL file (documentation-only repo artifact)**
Goal:
- Repo records the schema change.
Files:
- CREATE `supabase/migrations/20260506000000_relax_lead_required_fields.sql`.
Pattern to copy:
- `supabase/migrations/20260415000001_lead_assignment_rls.sql`.
Gotchas:
- File contents = the BEGIN…COMMIT block from Migration SQL (NOT the verification queries; put those in a header comment).
- Header comment: `-- DOCUMENTATION ONLY. Applied to prod via Supabase Studio SQL Editor on 2026-05-06.`
- Verify timestamp `20260506000000` sorts after the latest existing file (`ls supabase/migrations/ | sort | tail -1` should be older).
Definition of done:
- File exists with exact SQL applied.

**Task 15 — Apply migration to PRODUCTION via Supabase Studio (chrome-devtools MCP)**
Goal:
- Schema is live.
Files:
- N/A (live DB action).
Pattern to copy:
- N/A.
Gotchas:
- **PRECONDITION**: chrome-devtools MCP must be reconnected.
- **PRECONDITION**: All 5 verification queries pass; abort if any return unexpected results.
- Walk the user through each step in chat — show SQL being pasted, get explicit "go" before clicking Run.
- Confirm post-verification queries return expected results.
- This is a production database change.
Definition of done:
- Verification + migration + post-verification all green in Studio.
- User confirms.

**Task 16 — Final E2E smoke test on live site (chrome-devtools MCP)**
Goal:
- Prove the full feature works end-to-end.
Files:
- N/A.
Pattern to copy:
- N/A.
Gotchas:
- Test order: (1) AI Enhance on a To-Do (already deployed in Task 2 — re-verify); (2) Manual add lead with first name + phone only; (3) Bulk paste 3 sample contacts → process → review → submit; (4) Verify 4 leads appear in Leads list; (5) Bulk paste same emails → confirm skipped in toast; (6) Hammer Process button 11x → confirm 11th returns rate-limit error.
Definition of done:
- All 6 scenarios pass on the live site.

### Integration Points

- Data / schema source of truth: Supabase Studio (where it's applied) + `supabase/migrations/` (committed for history).
- Entry points to extend: NEW `supabase/functions/bulk-leads-parse/index.ts` and `_shared/rate-limit.ts`. NO modification to `api-leads`.
- Validation layer: manual `validate()` co-located in `ManualLeadForm.tsx`. NO new lib (no zod, no react-hook-form).
- Domain / service layer: `src/hooks/use-leads.ts` (add `addLeadsAsync`), `src/lib/api/leads.ts createLeads` (rewritten with dedup + assignment), new `src/lib/api/bulk-leads-parse.ts`.
- User-facing surface: `src/pages/LeadsPage.tsx` toolbar gets `<AddLeadDialog />`; new `src/components/leads/add-lead/*`.
- Shared types / export hubs: `src/types/crm.ts` (Lead changes); `src/components/leads/add-lead/types.ts` (ParsedLead, BulkParseResponse, BulkInsertResponse).
- External / operational hooks: 1 new edge function + 1 modified edge function. New `rate_limits` table.

## Validation

```bash
cd /Users/omidzahrai/Desktop/CODEBASES/CRM/connect-crm
npm run lint
npm run typecheck
# Expected: 0 errors.
```

### Factuality Checks

- `Verified Repo Truths` uses `Fact / Evidence / Implication` for every bullet ✓
- Every negative claim includes `Search Evidence` ✓
- No proposal language in `Verified Repo Truths` ✓
- No placeholder strings remain ✓
- Every `MODIFY` path exists in the repo ✓

### Manual Checks

- Scenario: Click "+ Add Lead" → Manual tab → fill First Name + Phone only → Submit
  Expected: Toast "Lead added"; dialog closes; new lead appears at top with empty last name/job title/company; `assigned_to = currentUser.id` (non-admin).

- Scenario: Bulk → paste 5 messy contacts → Process → wait → review table → edit one row's email → remove one row → "Add 3 leads"
  Expected: Toast "Added 3 leads"; dialog closes; 3 new leads in list.

- Scenario: Repeat bulk submit with same emails → Process again → Submit
  Expected: Toast "Added 0 leads. 3 skipped: x@y.com, z@w.com, a@b.com".

- Scenario: Paste 200KB block → Process
  Expected: Client toast "Input too large…" before any network call.

- Scenario: Process 11 times in 60 seconds
  Expected: 11th returns rate-limit error with retry-after.

- Scenario: To-Do → AI Enhance
  Expected: Field text refined; no 502.

- Scenario: Apollo flow → import 25 leads
  Expected: Still works.

- Scenario: Empty paste result (LLM returns no leads)
  Expected: Toast "No leads detected"; stay on textarea.

## Open Questions

- None. All previously open questions resolved by RLS inspection + reviewer findings.

## Final Validation Checklist

- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run typecheck`
- [ ] Error cases handled: LLM 502, oversized input, rate-limited, missing required fields, empty parse, network timeout
- [ ] Verified Repo Truths contains only checked facts
- [ ] Every verified fact includes exact evidence
- [ ] Every negative claim includes search evidence
- [ ] No proposal language in `Verified Repo Truths`
- [ ] Every `MODIFY` path exists
- [ ] No template placeholders remain
- [ ] Sonnet 4.6 + Mercury 2 slugs verified live via curl BEFORE deploying

## Deprecated / Removed Code

- `inception/mercury-coder-small-beta` model string in `supabase/functions/todo-ai-enhance/index.ts:34` — replaced.
- The pure-`Lead[]` return shape from `createLeads` — replaced by `{ inserted, skippedDuplicates }`. Single caller (`addLeadsMutation`) updated in same commit.

## Anti-Patterns to Avoid

- Don't introduce `react-hook-form` or `zod`.
- Don't bypass `useLeads().addLeadsAsync` with raw `supabase.from('leads').insert()`.
- Don't make the OpenRouter call from the browser.
- Don't use `nullable: true` (OpenAPI) or `type: ['string', 'null']` arrays in JSON schema for OpenRouter strict mode — use plain `type: 'string'` with **every property listed in `required`** and empty-string sentinels for missing data.
- Don't omit fields from `required` to mark them optional — that's non-strict-mode behavior and will be rejected.
- Don't skip `additionalProperties: false`.
- Don't apply the migration without first running ALL 8 verification queries (the duplicate-emails query is a hard blocker — UNIQUE index will fail to build if there are existing dupes).
- Don't use Supabase MCP — use chrome-devtools MCP to drive Supabase Studio.
- Don't deploy any model slug without curl verification first.
- Don't show client-side duplicate badges in the review table (cache is paginated; would mislead).
- Don't put the Add Lead button inside the `{selected.size > 0 && ...}` conditional block.
- Don't modify `src/lib/transforms.ts` — it's a pure key-renamer; coercion belongs in form/API code.
- Don't modify `supabase/functions/api-leads/index.ts` — it's not in the dialog's write path.
- Don't fail-open in the rate limiter — fail-closed for cost-bearing endpoints.
- Don't internally re-fetch `auth.getUser()` or `profiles.role` inside `createLeads` — accept context from the caller.
- Don't disable the bulk submit button on incomplete rows — skip-and-report instead.
- Don't use `?? null` on a string field to coerce empty-string to null (it lets `''` through). Use `|| null`.
- Don't forget to set `assigned_to` explicitly client-side — RLS does NOT enforce self-assignment on INSERT.

---

**Confidence score: 9.7/10 (v4)**

Reasoning: v4 addresses all v3 critical findings from a third reviewer pass. Three meaningful fixes since v3:

1. **23505 retry actually retries.** `createLeads` now parses the offending email out of `error.details`, pushes to `skippedDuplicates`, and re-inserts up to 5 times (handles multi-conflict batches). Pathological case throws cleanly.
2. **Migration split into two scripts.** Script 1 = transactional DDL (with `LOCK TABLE … IN SHARE MODE` defense-in-depth). Script 2 = standalone `CREATE UNIQUE INDEX CONCURRENTLY` (non-blocking, required for production). Operator can no longer accidentally block writes.
3. **Bulk → Lead mapping coercion specified.** Task 11 has explicit pseudocode handling `string | undefined` → `string` coercion. No more "type error waiting to happen".

Plus polish: `CampaignBuilderPage.tsx:512` added as a known second `addLeads` caller; Task 3 grep scope clarifies `Deal.assignedTo` exclusion; verification queries reordered (apollo_id existence first); bulk-leads-parse strip pass also rejects empty-email-AND-empty-phone before review (matches DB CHECK); `retryAfterSeconds` included in 429 response; `_shared/auth.ts` evidence confirms `profiles.id = auth.users.id`.

Remaining soft spots, all bounded: (1) model slugs verified at implementation time via Task 1 curl; (2) chrome-devtools MCP reconnection precondition for Tasks 15-16; (3) rate-limit count+insert race ~10+N concurrent calls per window — practical damage bounded under $1/min/user; (4) `useAuth().user` is null during initial load — dialog trigger should disable when `!user`.
