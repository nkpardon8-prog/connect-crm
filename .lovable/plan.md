

## Gmail-Style Inbox & Compose — Build Plan

Transform the Outreach inbox and compose into a Gmail-like email client with clickable messages, threaded conversations, reply/forward, and a unified reading experience.

### What changes

**Inbox becomes a two-panel layout:**
- **Left panel:** Email list (sender/subject/preview/time), clickable rows with read/unread styling
- **Right panel:** Selected email detail view showing full body, sender info, timestamp, and action buttons (Reply, Forward, Delete/Archive)
- Clicking an email marks it as read and opens it in the detail pane

**Threaded conversations:**
- Emails are grouped by `leadId` into conversation threads
- Thread view shows all messages in chronological order (both inbound and outbound) in a scrollable stack
- Each message bubble distinguishes sent vs received (aligned right/left or color-coded)

**Reply & Forward inline:**
- Reply pre-fills the "to" field and subject (`Re: ...`), opens a compose area at the bottom of the thread
- Forward opens compose with the original body quoted
- Sending a reply adds the email to the thread and logs activity

**Compose upgrades:**
- Compose tab becomes a full Gmail-style compose form: To field with lead search/autocomplete, CC/BCC toggle, subject, rich body area
- Can also be triggered from "Reply" or "Forward" within the inbox
- Compose can target any lead (not just assigned ones — remove `myLeads` filter)

**Mark as read/unread:**
- Add `markEmailRead` method to CRMContext
- Clicking an email auto-marks as read
- Option to toggle back to unread

### Technical changes

| File | Change |
|------|--------|
| `src/types/crm.ts` | Add optional `threadId` and `replyToId` fields to `EmailMessage` |
| `src/contexts/CRMContext.tsx` | Add `markEmailRead(id)` and `updateEmail(id, updates)` methods |
| `src/pages/OutreachPage.tsx` | Rebuild inbox tab as split-pane (list + detail). Group emails by leadId into threads. Add reply/forward flows. Upgrade compose to allow any lead with search. Wire up read/unread toggling. |
| `src/data/mockData.ts` | Add more mock emails with realistic back-and-forth threads per lead |

### Layout detail

```text
┌──────────────────────┬────────────────────────────┐
│  Thread List         │  Conversation View         │
│                      │                            │
│  ● John D. (3)       │  From: john@acme.com       │
│    Re: API Pricing   │  Subject: Re: API Pricing  │
│    2 hours ago       │  ─────────────────────────  │
│                      │  Hey Sarah, thanks for...  │
│  Sarah K. (1)        │                            │
│    Meeting followup  │  ▸ You (Mar 20):           │
│    Yesterday         │    Hi John, following up.. │
│                      │                            │
│                      │  ▸ John (Mar 21):          │
│                      │    Sounds good, let's...   │
│                      │                            │
│                      │  ┌─── Reply ────────────┐  │
│                      │  │ Type your reply...    │  │
│                      │  │          [Send]       │  │
│                      │  └──────────────────────┘  │
└──────────────────────┴────────────────────────────┘
```

### Design notes
- Unread threads shown with bold text and blue dot indicator
- Selected thread highlighted with blue-50 background
- Reply area appears inline at bottom of thread (no tab switch needed)
- Compose tab still available for new conversations
- All leads selectable as recipients (not just assigned)
- Responsive: on smaller screens, detail panel replaces list with a back button

