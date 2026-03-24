# Campaign Engine

> Campaign management dashboard with analytics, unsubscribe infrastructure, and template support.

**Status:** Active (Phase 1a complete — Phase 1b pending)
**Last Updated:** 2026-03-23
**Related Docs:** [OVERVIEW.md](./OVERVIEW.md) | [outreach.md](./outreach.md) | [schema.md](./schema.md)

---

## Overview

The campaign engine provides a full campaign management dashboard within the Outreach page. Users can create campaigns (via AI or manual mode), view campaign analytics (sent/opened/clicked/bounced), clone campaigns, and manage unsubscribes. Campaigns are linked to individual emails via `campaign_id` for analytics tracking.

---

## Features

### Campaign Management List
- All campaigns displayed with status badges (draft/active/paused/completed)
- Per-campaign analytics: sent, opened (%), clicked, bounced
- Actions: view detail, clone, delete
- Replaces the old campaign history expandable cards

### Campaign Detail Page
- Route: `/outreach/campaign/:id`
- Full analytics display (CampaignAnalytics component)
- Email content preview (subject + body)
- Recipient list with per-recipient delivery status (delivered/opened/clicked/bounced)
- Clone campaign button

### Campaign Cloning
- Clones name, subject, body, A/B variants
- Does NOT clone recipient_ids (stale data) — user must re-select audience

### Unsubscribe Infrastructure
- Route: `/unsubscribe/:token?email=...` (public, no auth)
- `{{unsubscribeLink}}` merge field auto-injected in campaign emails
- Unsubscribe tokens generated per-recipient at send time in send-email Edge Function
- Unsubscribe Edge Function handles token validation + record creation
- Unsubscribed leads excluded from future campaign recipient selection

### Analytics
- Computed from `emails` table via `campaign_id` foreign key
- Metrics: sent count, opened count + rate, clicked count, bounced count, unsubscribed count
- Real-time from webhook data (email-events Edge Function populates opened_at/clicked_at/bounced_at)

---

## Database Tables

### campaigns (expanded)
New columns: `name`, `status` (draft/active/paused/completed), `scheduled_at`, `drip_config` (jsonb), `variant_b_subject`, `variant_b_body`, `ab_test_enabled`, `sequence_id`

### emails.campaign_id
New FK column linking emails to campaigns for analytics queries.

### campaign_templates (Phase 1b)
Template library for reusable email templates.

### campaign_sequences (Phase 2)
Links campaigns to follow-up sequences.

### campaign_steps (Phase 2)
Individual steps in a follow-up sequence with delay_days, subject, body.

### unsubscribes
Tracks unsubscribed leads. Token-based lookup. Indexed on lead_id and email.

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `send-email` | Batch sends now include campaign_id on email rows + inject {{unsubscribeLink}} |
| `unsubscribe` | Public endpoint — validates token, inserts unsubscribe record |

---

## Phase Roadmap

- **Phase 1a (complete):** DB schema, campaign list + analytics, detail page, unsubscribe infrastructure, cloning
- **Phase 1b (next):** Multi-step campaign builder, template library, AI template generation
- **Phase 2:** Scheduling, drip sends, follow-up sequences, suspend/resume/edit
- **Phase 3:** Apollo auto-gen pipeline, A/B test execution, smart send timing, lead engagement scoring

---

## Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| 2026-03-23 | Campaign Engine Phase 1a: DB schema, campaign list, analytics, detail page, unsubscribe, cloning | All campaign files |
