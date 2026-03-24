# Dashboard

> KPI stat cards, charts (lead funnel, weekly activity, revenue pipeline), and team leaderboard.

**Status:** Partial (some chart data is hardcoded)
**Last Updated:** 2026-03-23
**Related Docs:** [OVERVIEW.md](./OVERVIEW.md) | [state-management.md](./state-management.md) | [leads.md](./leads.md) | [pipeline.md](./pipeline.md)

---

## Overview

The Dashboard is the landing page after login (`/`). It provides a KPI overview of CRM performance through stat cards, three charts, and an admin-only team leaderboard. Data is filtered by role — admins see aggregate data across all users, employees see only their assigned items.

---

## File Map

| File | Purpose |
|------|---------|
| `src/pages/DashboardPage.tsx` | Entire dashboard UI and logic (single file) |

---

## Detailed Behavior

### Page Header
- **Admin:** "Team Dashboard" with subtitle "Overview of all team activity"
- **Employee:** "Welcome back, [FirstName]" with subtitle "Your personal performance overview"

### KPI Stat Cards (5 cards in a row)

| Stat | Source | Calculation |
|------|--------|-------------|
| Total Leads | `leads` array | `myLeads.length` |
| Calls Made | `activities` array | `myActivities.filter(type === 'call').length` |
| Emails Sent | `activities` array | `myActivities.filter(type === 'email_sent').length` |
| Conversion Rate | `leads` array | `(warmLeads / totalLeads * 100).toFixed(1)` — where warm = `status === 'warm'` |
| Pipeline Value | `deals` array | `myDeals.filter(stage !== 'closed_lost').reduce(sum values)` — formatted as `$Xk` |

Each card also shows a **% change indicator** (e.g., "+12%", "+8%") — these are **hardcoded strings**, not computed from historical data.

**Layout:** 2 columns on mobile, 5 columns on large screens (`grid-cols-2 lg:grid-cols-5`)

### Charts (3 charts in a row, `lg:grid-cols-3`)

#### 1. Lead Funnel (Donut/Pie Chart)
- **Type:** `PieChart` with inner radius (donut)
- **Data:** Dynamically computed from `myLeads` — counts per status (Cold, Lukewarm, Warm, Dead)
- **Colors:** HSL values matching status color system: blue (cold), amber (lukewarm), orange (warm), red (dead)
- **Legend:** Below chart showing status name + count

#### 2. Weekly Activity (Bar Chart)
- **Type:** `BarChart` with two bar series
- **Data:** **HARDCODED** — `[Mon:3/5, Tue:5/4, Wed:2/7, Thu:6/3, Fri:4/6]` (calls/emails)
- **Colors:** Primary blue (calls), lighter blue (emails)
- **Note:** This does NOT reflect actual activity data from the CRM context

#### 3. Revenue Pipeline (Line Chart)
- **Type:** `LineChart` with CartesianGrid
- **Data:** **PARTIALLY HARDCODED** — Oct through Feb values are hardcoded ($12k→$45k); March value is the live `pipelineValue`
- **Y-axis:** Formatted as `$Xk`
- **Color:** Primary blue with dot markers

### Team Leaderboard (Admin Only)

- Only rendered when `isAdmin === true`
- Shows two team members: Marcus Rivera and Aisha Patel
- **Dynamic data:** Lead count (`leads.filter(assignedTo === userId).length`)
- **Hardcoded data:** Call count and email count per rep (8/12 for Marcus, 6/9 for Aisha)
- Each row shows: avatar initials, name, lead count, calls badge, emails badge

### Hottest Leads Leaderboard

- Visible to all roles (admin and employee)
- Ranks leads by `engagement_score` descending — score derived from campaign interactions (opens×1 + clicks×3 + replies×5)
- Displays top 5 leads by default
- Each row shows: lead name, company, engagement score badge, current status badge
- Links to the lead detail page on row click
- Empty state shown when no leads have a non-zero engagement score

---

## Component & Function Reference

### DashboardPage (default export)

**Hooks used:**
- `useLeads()` → `leads`
- `useActivities()` → `activities`
- `useDeals()` → `deals`
- `useProfiles()` → `profiles` (leaderboard)
- `useAuth()` → `user`, `isAdmin`

**Key computed values:**
```typescript
const myLeads = isAdmin ? leads : leads.filter(l => l.assignedTo === user?.id);
const myActivities = isAdmin ? activities : activities.filter(a => a.userId === user?.id);
const myDeals = isAdmin ? deals : deals.filter(d => d.assignedTo === user?.id);
```

**Constants:**
- `statusColors` — HSL color map for lead statuses used in the funnel chart

**UI Components used:** `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge` (from shadcn/ui); `ResponsiveContainer`, `PieChart`, `Pie`, `Cell`, `BarChart`, `Bar`, `LineChart`, `Line`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip` (from recharts); `Users`, `Phone`, `Mail`, `TrendingUp`, `DollarSign`, `ArrowUpRight` (from lucide-react)

---

## Data Dependencies

| Data | Source | Filtering |
|------|--------|-----------|
| Leads | `useLeads()` | By RLS (employees scoped at DB level) |
| Activities | `useActivities()` | By RLS (employees scoped at DB level) |
| Deals | `useDeals()` | By RLS (employees scoped at DB level) |
| Profiles | `useProfiles()` | Leaderboard team member list |
| User | `useAuth().user` | — |
| isAdmin | `useAuth().isAdmin` | — |

---

## Known Limitations & TODOs

- Weekly Activity chart data is still hardcoded sample values, not computed from actual activity records
- Leaderboard only visible to admins (employees don't see team performance)
- % change indicators on stat cards are decorative strings
- Revenue data for Oct–Feb is hardcoded
- No date range selector or time period filtering
- No drill-down from stats to detailed views
- No refresh/real-time update mechanism
- No mobile-optimized chart rendering
- Missing chart: no deal stage distribution visualization

---

## Future Considerations

- Replace hardcoded chart data with computed values from activities/deals
- Add date range picker for filtering dashboard metrics
- Make leaderboard dynamic based on all employees
- Add click-through from stats to filtered views (e.g., click "Calls Made" → filtered activity list)
- Consider adding a "recent activity" feed

---

## Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| 2026-03-22 | Initial documentation created | — |
| 2026-03-23 | Data from Supabase via React Query hooks, leaderboard now fully dynamic | `DashboardPage.tsx` |
| 2026-03-23 | "Hottest Leads" engagement leaderboard added — ranks leads by engagement score (opens×1 + clicks×3 + replies×5), visible to all roles | `DashboardPage.tsx` |
