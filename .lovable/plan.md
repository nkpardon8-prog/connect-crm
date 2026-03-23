

## IntegrateAPI CRM — Full Build Plan

**Branding:** Match integrateapi.ai — clean white background, blue accent (#2563EB), modern sans-serif typography, card-based layouts.

### Pages & Navigation

**Sidebar navigation** with IntegrateAPI branding:
- Dashboard (KPIs)
- Leads / CRM
- Lead Generator
- Outreach / Email
- Pipeline (Kanban)
- Settings

**Auth system** (mocked): Login page with email/password, role-based routing (admin vs employee). Admin sees all data; employees see only their own leads.

---

### 1. KPI Dashboard
- **Top-row stat cards:** Total leads, calls made, emails sent, conversion rate, revenue pipeline value
- **Charts:** Lead funnel (cold → warm → closed), weekly activity (calls + emails), revenue forecast
- **Leaderboard widget:** Top reps by activity volume
- **Admin view** shows team-wide data; employee view shows personal stats

### 2. CRM / Lead Management
- **Table view** with columns: Name, Email, Phone, Job Title, Company, Company Size, Status (Cold/Lukewarm/Warm/Dead), Assigned Rep, Last Contacted
- **Filters & search:** Filter by status (Cold/Lukewarm/Warm/Dead), search by name/company, sort by any column
- **Bulk actions:** Multi-select to change status or assign
- **Phone numbers** as `tel:` links (triggers native phone dialer on iPhone)
- **Email addresses** as `mailto:` links
- Clicking phone/email **auto-logs** the interaction to the lead's activity history

### 3. Lead Detail Page
- **Contact info card** with all Apollo-style fields
- **Status badge** (easily changeable via dropdown)
- **Activity timeline:** Chronological feed of all calls, emails, notes, status changes
- **AI Action Items panel:** Mock AI-generated suggestions (e.g., "Follow up — no response in 5 days", "Company just raised funding — upgrade priority")
- **Notes section:** Free-form notes with timestamps
- **Tags**

### 4. Lead Generator (Chat-based)
- **Chat interface** where user describes ideal customer profile (e.g., "CTOs at SaaS companies, 50-200 employees, based in Austin")
- Bot responds with a **mock lead list** (table of generated contacts)
- **"Import to CRM" button** — one click to add all as Cold leads
- Designed to wire into Apollo MCP later

### 5. Outreach Portal / Emailer
- **Compose view:** Write and send individual emails to leads (mocked)
- **Sequence builder:** Create multi-step email campaigns with delays (mocked)
- **Inbox feed** with a **Refresh** button (mocked inbox showing sent/received)
- **Email templates** — save and reuse
- Sending an email auto-logs to the lead's activity timeline
- Ready to wire into email APIs later

### 6. Pipeline (Kanban)
- **Kanban board** with stages: New → Contacted → Qualified → Proposal → Negotiation → Closed Won / Closed Lost
- **Drag-and-drop** leads between stages
- **Deal value** on each card
- Summary stats at top (total pipeline value, deals per stage)

### 7. Settings & Admin
- **Employee management** (admin only): View team members, mock add/remove
- **Profile settings:** Name, email, role display
- **Integration placeholders:** Apollo API, Email API — shown as "Coming soon" connection cards

---

### Data Architecture (All Mocked)
Clean TypeScript interfaces for: User, Lead, Activity, EmailMessage, Deal, Campaign — structured to map directly to Apollo and email API schemas when wired up later. All mock data stored in local state with realistic sample data (20+ leads, activity history, etc.).

