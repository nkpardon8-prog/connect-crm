# Settings

> User profile display, admin team management, and integration placeholders.

**Status:** Active
**Last Updated:** 2026-03-23
**Related Docs:** [OVERVIEW.md](./OVERVIEW.md) | [authentication.md](./authentication.md) | [state-management.md](./state-management.md)

---

## Overview

The Settings page (`/settings`) provides three sections: an editable user profile card, an admin-only team management panel, and a list of integrations. Profile name and sending email are now editable — changes are persisted to Supabase via `updateProfile` and the AuthContext user state is refreshed immediately. Team management buttons are currently non-functional placeholders. Integrations reflect current connection status.

---

## File Map

| File | Purpose |
|------|---------|
| `src/pages/SettingsPage.tsx` | Entire settings page — profile, team, integrations |

---

## Detailed Behavior

### Profile Card

- **Name:** Editable `Input` pre-filled with `user.name` — bound to `editName` state
- **Email:** Read-only `Input` pre-filled with `user.email` — this is the Supabase Auth email and cannot be changed here
- **Sending Email:** Editable `Input` for the CRM outbound address used when sending emails — bound to `editSendingEmail` state. Separate from the auth email. **This field is required before users can send any email** (compose, reply, or campaign). If `sendingEmail` is not set on the user's profile, send actions are blocked and an error message is shown prompting the user to configure it in Settings first.
- **Role:** `Badge` showing capitalized role (admin/employee)
- **Save Changes button:** Calls `handleSave()`, shows a loading state (`saving`) while the Supabase write is in flight. On success, calls `refreshUser()` so the header and rest of the UI reflect the updated name immediately.

### Team Management Card (Admin Only)

Only rendered when `isAdmin === true`.

**Team member list:**
- Iterates over profiles fetched via `useProfiles()` from Supabase
- Each row shows:
  - Avatar circle with initials (e.g., "SC" for Sarah Chen)
  - Full name
  - Email
  - Role badge (secondary variant, capitalized)
  - Delete button (Trash2 icon) — **only shown for non-admin users**

**Delete button behavior:**
- Shows `text-muted-foreground` normally, `hover:text-destructive` on hover
- **Has no onClick handler** — clicking does nothing
- Purely visual placeholder

**"+ Add Team Member" button:**
- Outline variant, small size
- **Has no onClick handler** — clicking does nothing
- Purely visual placeholder

### Integrations Card

Available to all users (both admin and employee).

| Integration | Description | Status |
|-------------|-------------|--------|
| Apollo.io | Lead generation and enrichment | Connected |
| Email Provider | Outbound email via Resend (sending_email configurable in profile) | Setting Up |
| Slack | Get notifications in your Slack workspace | Coming Soon |

Each integration row shows:
- Icon square (first letter of integration name)
- Name and description
- Status badge (outline variant)

No connection/configuration flow exists.

---

## Component & Function Reference

### SettingsPage (default export)

**Hooks:** `useAuth()`, `useProfiles()`

**State:**
| State | Type | Purpose |
|-------|------|---------|
| `editName` | `string` | Controlled value for the Name input, initialized from `user.name` |
| `editSendingEmail` | `string` | Controlled value for the Sending Email input, initialized from `user.sendingEmail` |
| `saving` | `boolean` | `true` while the Supabase updateProfile write is in flight |

**Functions:**
- `handleSave()` — sets `saving` to `true`, calls `updateProfile({ name: editName, sendingEmail: editSendingEmail })`, then calls `refreshUser()` so the global user state reflects the change, then sets `saving` to `false`

**Mutations used:**
- `updateProfile` from `useProfiles()` — persists name and sending email changes to Supabase
- `refreshUser` from `useAuth()` — re-fetches the user profile after save so the UI updates immediately

**UI Components:** `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Input`, `Label` (from shadcn/ui); `User`, `Shield`, `Plug`, `Trash2` (from lucide-react)

---

## Data Dependencies

| Data | Source | Used For |
|------|--------|----------|
| Current User | `useAuth().user` | Profile display and edit initialization |
| isAdmin | `useAuth().isAdmin` | Team management visibility |
| refreshUser | `useAuth().refreshUser` | Re-fetch user after profile save |
| Profiles | `useProfiles()` | Team member list |
| updateProfile | `useProfiles().updateProfile` | Persist profile name and sending email changes |

---

## Known Limitations & TODOs

- No profile photo upload
- Team management delete button has no handler
- Team management add button has no handler
- No actual team member CRUD (no addUser/removeUser)
- No integration connection/configuration flow
- No notification preferences
- No theme/appearance settings (dark mode toggle, etc.)
- No data export/import functionality
- No account deletion
- No password change
- No API key management

---

## Future Considerations

- Add profile photo upload
- Implement team member CRUD (requires adding User management to context/backend)
- Build integration connection flows (OAuth for Gmail, API key for Apollo.io, webhook for Slack)
- Add notification preferences (email, in-app, Slack)
- Add theme toggle (dark/light mode)
- Add data export (CSV/JSON export of leads, deals, activities)
- Add API key management for programmatic access
- Consider moving integrations to a dedicated page if they become complex

---

## Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| 2026-03-22 | Initial documentation created | — |
| 2026-03-23 | Team management uses real profiles from Supabase | `SettingsPage.tsx` |
| 2026-03-23 | Profile editing: name and sending email are now editable with save | `SettingsPage.tsx` |
| 2026-03-23 | sendingEmail required for email sending — users must set it before compose/reply/campaign | `SettingsPage.tsx` |
