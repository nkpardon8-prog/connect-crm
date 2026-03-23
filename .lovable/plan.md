

## Bulk Email Campaigns — Build Plan

The current Outreach page supports only individual emails. This plan adds a new **"Campaigns"** tab to the Outreach page for managing bulk email sends with lead selection, filtering, and template-based composition.

---

### What gets built

**New tab on OutreachPage: "Campaigns"**

A dedicated campaign workflow with three steps:

1. **Select Recipients** — Full lead table with:
   - Multi-select checkboxes (select all / individual)
   - Filter by **lead status** (Cold / Lukewarm / Warm / Dead)
   - Filter by **industry** (dynamically populated from lead data)
   - Search by name/company
   - Selected count displayed prominently
   - "Next" button to proceed

2. **Compose Email** — Campaign editor:
   - Subject line input
   - Body textarea with merge-field hints (e.g. `{{firstName}}`, `{{company}}`)
   - Preview of how many recipients are selected
   - "Send Campaign" button

3. **Campaign Log** — History of sent campaigns:
   - Campaign name/subject, recipient count, date sent
   - Expandable to see individual recipients and status

### Technical changes

| File | Change |
|------|--------|
| `src/types/crm.ts` | Add `Campaign` interface (id, subject, body, recipientIds, sentAt, sentBy) |
| `src/data/mockData.ts` | Add 2-3 mock campaigns |
| `src/contexts/CRMContext.tsx` | Add `campaigns` state, `addCampaign` method |
| `src/pages/OutreachPage.tsx` | Add "Campaigns" tab with the 3-step flow described above |

### Design notes

- Reuses existing card-based layout, table components, and filter patterns from LeadsPage
- Industry filter options derived dynamically from `leads.map(l => l.industry)`
- Sending a campaign auto-logs an `email_sent` activity for each recipient
- Mocked — structured to wire into email API later
- Follows existing blue accent (#2563EB), shadow-sm card style

