# Outreach & Email

> Gmail-style inbox with threading, email compose, bulk campaigns (AI + manual modes), and email sequences.

**Status:** Active
**Last Updated:** 2026-03-23
**Related Docs:** [OVERVIEW.md](./OVERVIEW.md) | [state-management.md](./state-management.md) | [data-model.md](./data-model.md) | [leads.md](./leads.md) | [campaigns.md](./campaigns.md)

---

## Overview

The Outreach page (`/outreach`) is a multi-tab interface for all email-related features. It includes a Gmail-style threaded inbox, single-email compose, bulk campaign creation (with both AI-assisted and manual modes), and email sequence templates. This is the most complex page in the application.

---

## File Map

| File | Purpose |
|------|---------|
| `src/pages/OutreachPage.tsx` | Main outreach page — all 4 tabs (Inbox, Compose, Campaigns, Sequences) |
| `src/pages/CampaignDetailPage.tsx` | Campaign detail page — analytics, content preview, recipient status, clone |
| `src/components/outreach/CampaignAIChat.tsx` | AI chat component for campaign creation |
| `src/components/outreach/CampaignList.tsx` | Campaign management list with status badges and per-campaign analytics |
| `src/components/outreach/CampaignAnalytics.tsx` | Analytics display component (sent/opened/clicked/bounced metrics) |
| `src/lib/api/campaign-ai.ts` | Client API function for campaign AI Edge Function |

---

## Detailed Behavior

### Tab: Inbox

#### Thread Building Logic

Emails are grouped into threads client-side from the flat `EmailMessage[]` array:

```typescript
interface EmailThread {
  id: string;           // threadId (or email.id if no thread)
  subject: string;      // First email's subject, stripped of Re:/Fwd: prefixes
  messages: EmailMessage[];  // Sorted chronologically
  latestAt: string;     // Most recent message timestamp
  unreadCount: number;  // Count of unread messages in thread
  participants: string[]; // Unique from/to addresses
  leadId?: string;      // First email in thread with a leadId
}
```

**Thread grouping algorithm:**
1. Iterate all emails, group by `threadId` (or `email.id` if no threadId)
2. Sort messages within each thread by `sentAt` ascending (oldest first)
3. Extract thread metadata: subject from first message (strip `Re:/Fwd:` prefixes), participants via Set deduplication, unread count
4. Sort threads by `latestAt` descending (most recent first)

#### Split Pane Layout

- **Left panel (360px):** Thread list
- **Right panel (fill):** Conversation view (or empty state)

#### Thread List (Left Panel)

Each thread entry shows:
- Unread indicator (blue dot, 8x8px) if `unreadCount > 0`
- Contact name (non-current-user participant, falls back to "Unknown")
- Relative timestamp (calculated: "<X>m ago", "<X>h ago", "Yesterday", or date)
- Subject line
- Message preview (first 80 chars of latest message body)
- Message count badge

**Search:** Filters threads by subject, participants, or message body content (case-insensitive)

**Refresh button:** Calls `queryClient.invalidateQueries` to refetch emails from Supabase, with an 800ms `refreshing` animation state.

#### Conversation View (Right Panel)

When a thread is selected:
- **Header:** Subject, participant count, message count
- **Messages:** Scrollable list, each message shows:
  - **Outbound** (from current user): right-aligned, primary bg, white text
  - **Inbound:** left-aligned, muted bg
  - Sender name/email, formatted timestamp, body (whitespace-pre-line)
- **Actions:** Reply and Forward buttons at bottom
- **Reply mode:** Textarea appears below messages, with Send and Cancel buttons

**On thread select:** All unread messages in the thread are marked as read via `markEmailRead()`

#### Inbound Email

Inbound emails are received via Resend webhooks. When someone replies to a CRM email, Resend delivers the reply to the configured inbound domain and fires an `email.received` event to the `email-events` Edge Function. The function fetches the full message body from the Resend API, matches the message to an existing thread (via `In-Reply-To` header), matches the sender to a lead, inserts the email as an inbound `EmailMessage`, and logs an `email_received` activity. The reply then appears automatically in the inbox with correct threading — no manual refresh required.

#### Reply/Forward

**Reply:**
- Creates new EmailMessage with:
  - `subject`: "Re: [original subject]"
  - `to`: last message's `from` address
  - `from`: current user's email
  - `threadId`: current thread's ID
  - `replyToId`: last message's ID
  - `direction`: 'outbound'
- Threading headers (`In-Reply-To` and `References`) are set on the outgoing message so email clients and servers group replies into the correct thread
- Also creates `email_sent` activity linked to thread's lead

**Forward:**
- Same as reply but with `subject`: "Fwd: [original subject]"
- `to` is left as the original recipient (implementation detail)

---

### Tab: Compose

Single-email composition form.

**Fields:**
- **To:** Autocomplete search dropdown
  - Searches leads by firstName, lastName, email, company
  - Shows max 10 results
  - Displays: "FirstName LastName (email)" with company below
  - Sets `toLeadId` on selection
- **Subject:** Text input
- **Body:** Textarea (6 rows)

**Send button:** Disabled until lead + subject + body are all filled

**On send:**
1. Creates `EmailMessage` (outbound, from current user's email, to selected lead's email)
2. Delivers the email via Resend — the message is not just saved to the database; it is dispatched to Resend's API and delivered to the recipient's inbox
3. Creates `email_sent` activity linked to the lead
4. Clears all form fields
5. Uses `toast()` for success notification

---

### Tab: Campaigns

#### Mode Toggle
Switch between "AI Assistant" and "Manual" modes via toggle buttons at the top.

#### AI Mode (CampaignAIChat Component)

The `CampaignAIChat` component provides a chat interface for campaign creation.

**Props:**
```typescript
interface CampaignAIChatProps {
  leads: Lead[];           // All available leads
  industries: string[];    // Unique industries for filtering
  onApplyResult: (result: {
    matchedLeadIds: string[];
    subject: string;
    body: string;
    statusFilter?: string;
    industryFilter?: string;
  }) => void;
}
```

**How AI parsing works** (LLM-based flow):

`CampaignAIChat` calls `generateCampaignCopy()` from `@/lib/api/campaign-ai`, which invokes the `campaign-ai` Supabase Edge Function. That Edge Function proxies the request to DeepSeek V3.2 via OpenRouter.

1. The component builds a lead summary array (id, name, company, status, industry only — no sensitive fields) and sends it alongside the user's prompt and the full conversation history
2. The LLM parses the prompt semantically — no keyword matching — and selects matching leads intelligently based on context
3. The LLM generates contextual email copy (subject + body) with merge fields: `{{firstName}}`, `{{company}}`
4. Follow-up messages in the same chat session work because the full conversation history is forwarded to the LLM on every turn
5. An empty `matchedLeadIds` array in the response means "all leads" — the frontend interprets this as selecting all available leads

**After AI returns result:**
- Parent page shows a compose card with:
  - Recipient count
  - Subject (editable)
  - Body (editable)
  - "Send to X recipients" button

#### Manual Mode (Two-Step Workflow)

**Step 1 — Select Recipients:**
- Search bar (filters by name, company, email)
- Status filter dropdown (All, Cold, Lukewarm, Warm, Dead)
- Industry filter dropdown (dynamically populated from leads)
- Table with checkboxes for each lead
- Select-all checkbox in header
- Selected count badge
- "Next" button to proceed to compose

> **Email status filtering:** The available recipient pool (both in manual mode and the compose To: autocomplete) is pre-filtered to only include leads with `email_status` of `'verified'` or `'likely_to_engage'`. Leads with status `'unverified'`, `'guessed'`, `'extrapolated'`, or `'invalid'` are excluded from campaign and compose recipient selection to reduce bounce rates.

**Step 2 — Compose:**
- Subject input
- Body textarea
- Merge field documentation: `{{firstName}}`, `{{company}}`
- "Send to X recipients" button
- "Back" button to return to selection

#### Campaign Send Logic (Both Modes)

When "Send to X recipients" is clicked:
1. For each recipient lead:
   - Create `EmailMessage` with subject/body (merge fields replaced)
   - Merge field replacement: `{{firstName}}` → `lead.firstName`, `{{company}}` → `lead.company`
2. Bulk send dispatched via Resend's batch API — all personalised messages are submitted in a single batch request rather than individual API calls
3. Create `Campaign` record with all recipient IDs
4. Add campaign to context via `addCampaign()`
5. Clear form state
6. Show success toast

#### Campaign Management List (CampaignList Component)

The Campaigns tab now shows the `CampaignList` component — a full management dashboard replacing the old expandable history cards. Features:
- All campaigns displayed with status badges (draft/active/paused/completed)
- Per-campaign analytics inline: sent count, opened rate (%), clicked count, bounced count — computed from the `emails` table via `campaign_id` FK
- Actions per campaign: view detail (navigates to `/outreach/campaign/:id`), clone, delete
- The old campaign history expandable cards have been removed

#### Campaign Detail Page (`/outreach/campaign/:id`)

Accessible from the campaign list. Displays:
- Full analytics via the `CampaignAnalytics` component (sent/opened/clicked/bounced/unsubscribed)
- Email content preview: subject and body
- Recipient list with per-recipient delivery status (delivered/opened/clicked/bounced)
- Clone campaign button — clones name, subject, body, A/B variants; does NOT copy `recipient_ids` (stale data)

See [campaigns.md](./campaigns.md) for full campaign engine documentation.

---

### Tab: Sequences

Display-only view of sequences fetched via `useSequences()` from Supabase.

Each sequence card shows:
- Sequence name
- Step count + creator name
- Active/Paused status badge
- Step list: order number, subject, delay in days
- Info note: "Sequence execution will be powered by email API integration"

No CRUD operations — sequences are read-only.

---

## Component & Function Reference

### OutreachPage (default export)

**Hooks:** `useEmails()`, `useLeads()`, `useCampaigns()`, `useSequences()`, `useProfiles()`, `useAuth()`, `useQueryClient()`, `useState`, `useMemo`

**State (organized by tab):**

| State | Tab | Type | Purpose |
|-------|-----|------|---------|
| `tab` | All | `string` | Active tab ('inbox', 'compose', 'campaigns', 'sequences') |
| `selectedThreadId` | Inbox | `string \| null` | Currently viewed thread |
| `replyMode` | Inbox | `'reply' \| 'forward' \| null` | Reply/forward mode |
| `replyBody` | Inbox | `string` | Reply textarea content |
| `inboxSearch` | Inbox | `string` | Inbox search query |
| `refreshing` | Inbox | `boolean` | Refresh animation state |
| `toSearch` | Compose | `string` | Lead search in compose |
| `toLeadId` | Compose | `string` | Selected lead ID |
| `subject` | Compose | `string` | Email subject |
| `body` | Compose | `string` | Email body |
| `campaignStep` | Campaigns | `'select' \| 'compose'` | Manual mode step |
| `selectedLeadIds` | Campaigns | `Set<string>` | Selected recipients |
| `statusFilter` | Campaigns | `string` | Lead status filter |
| `industryFilter` | Campaigns | `string` | Lead industry filter |
| `campaignSearch` | Campaigns | `string` | Recipient search query |
| `campaignSubject` | Campaigns | `string` | Campaign subject |
| `campaignBody` | Campaigns | `string` | Campaign body |
| `expandedCampaign` | Campaigns | `string \| null` | Expanded campaign ID |
| `campaignMode` | Campaigns | `'manual' \| 'ai'` | Campaign creation mode |

**Computed values (useMemo):**
- `threads` — built from emails array
- `filteredThreads` — threads filtered by search
- `filteredComposeLeads` — leads matching compose search
- `industries` — unique industries from all leads
- `filteredLeads` — leads filtered for campaign recipient selection

### CampaignAIChat (default export)

**Props:** `leads`, `industries`, `onApplyResult`

**State:**
- `messages: {role, content}[]` — chat history
- `input: string` — current input
- `isThinking: boolean` — processing state

**Key function:** `generateCampaignCopy()` from `@/lib/api/campaign-ai` — sends prompt, conversation history, and lead summaries to the `campaign-ai` Edge Function (DeepSeek V3.2 via OpenRouter)

---

## Data Dependencies

| Data | Source | Used In |
|------|--------|---------|
| Emails | `useEmails()` | Inbox thread building |
| Leads | `useLeads()` | Compose (recipient search), Campaigns (recipient selection), thread-to-lead lookup |
| Campaigns | `useCampaigns()` | Campaign history display |
| Profiles | `useProfiles()` | Campaign history (sender name) |
| Sequences | `useSequences()` | Sequences tab |
| Current User | `useAuth().user` | Email from address, activity logging |

### Hook Mutations Used
- `addEmail()` — compose send, reply, campaign send
- `addActivity()` — email sent logging
- `addCampaign()` — campaign creation (async/try-catch)
- `markEmailRead()` — mark thread messages as read

---

## Known Limitations & TODOs

- Forward sends to the original recipient rather than a user-specified new address (existing implementation limitation)
- Inbound email attachments are not downloaded/stored (metadata only)
- No email scheduling (send later)
- No email templates library
- No attachment support
- No rich text / HTML email editor
- No email signatures
- Sequences are display-only (no execution engine)
- Campaign AI depends on external LLM service (OpenRouter/DeepSeek V3.2) — requires internet connectivity and valid API key
- Unsubscribe infrastructure implemented (Phase 1a) — token-based, public `/unsubscribe/:token` route; full opt-out management UI is Phase 1b
- No email validation
- Refresh button triggers a real query invalidation but has no server-push/realtime subscription
- No thread archiving or deletion
- No email labels/folders/categories
- Large state object — all campaign/compose/inbox state in one component

---

## Future Considerations

- Integrate with Gmail/Outlook API for real email send/receive
- Implement sequence execution engine with scheduling
- Add rich text editor for email composition
- Add email tracking (pixel tracking for opens, link wrapping for clicks)
- Consider splitting OutreachPage into sub-components (InboxTab, ComposeTab, CampaignsTab, SequencesTab) for maintainability
- Add email templates CRUD
- Add A/B testing for campaign subjects

---

## Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| 2026-03-22 | Initial documentation created | — |
| 2026-03-22 | Gmail-style inbox threading implemented | `OutreachPage.tsx` |
| 2026-03-23 | Data from Supabase, campaign send async, refresh real, mockUsers/mockSequences removed | `OutreachPage.tsx` |
| 2026-03-23 | Campaign AI wired to real LLM (DeepSeek V3.2 via OpenRouter Edge Function) | `CampaignAIChat.tsx`, `campaign-ai.ts` |
| 2026-03-23 | Campaign and compose recipients filtered by email_status (verified/likely_to_engage only) | `OutreachPage.tsx` |
| 2026-03-23 | Emails now delivered via Resend — compose, reply, campaigns send real emails. Bounce/open/click tracking via webhooks | `OutreachPage.tsx`, `send-email.ts`, Edge Functions |
| 2026-03-23 | Inbound email receiving via Resend webhook — replies appear in inbox with threading | email-events Edge Function |
| 2026-03-23 | Email tracking indicators added to inbox — Opened/Clicked/Bounced on sent emails, thread-level opened indicator | OutreachPage.tsx |
| 2026-03-23 | Email UI redesign: Gmail-style message cards, formatting toolbar on reply/compose, dual-mode To field (lead search + raw email) | OutreachPage.tsx |
| 2026-03-23 | Gmail-style folder sidebar: Inbox/Sent/All Mail filters in the inbox tab | OutreachPage.tsx |
| 2026-03-23 | Campaign Engine Phase 1a: management list with analytics, detail page, cloning, unsubscribe infrastructure | OutreachPage.tsx, CampaignList, CampaignDetailPage, send-email |
